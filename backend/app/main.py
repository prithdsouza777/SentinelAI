import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import alerts, agents, chat, health, queues, simulation
from app.api.websocket import router as ws_router
from app.config import settings

# Configure logging for the entire sentinelai namespace
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
# Quiet noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

logger = logging.getLogger("sentinelai")

# ── In-memory state (imported by routes via app.state) ────────────────────────
_latest_metrics: dict[str, dict] = {}       # queue_id → latest QueueMetrics (camelCase)
_recent_decisions: list[dict] = []          # newest first, max 200
_recent_alerts: list[dict] = []             # newest first, max 100
_recent_negotiations: list[dict] = []       # newest first, max 50


# ── Simulation tick loop ───────────────────────────────────────────────────────

async def _tick():
    """Single simulation tick: generate metrics, detect anomalies, run agents, broadcast."""
    from app.services.simulation import simulation_engine
    from app.services.anomaly import anomaly_engine
    from app.agents.orchestrator import orchestrator
    from app.api.websocket import manager
    from app.services.redis_client import redis_client

    metrics = simulation_engine.generate_metrics()

    for m in metrics:
        # Anomaly detection (takes QueueMetrics object)
        alerts_list = anomaly_engine.evaluate(m)

        # Serialize to camelCase for WS broadcast + REST cache
        m_dict = m.model_dump(by_alias=True, mode="json")
        _latest_metrics[m.queue_id] = m_dict
        await manager.broadcast("queue:update", m_dict)

        for a in alerts_list:
            a_dict = a.model_dump(by_alias=True, mode="json")
            _recent_alerts.insert(0, a_dict)
            if len(_recent_alerts) > 100:
                _recent_alerts.pop()
            await manager.broadcast("alert:new", a_dict)
            await redis_client.push_json("sentinelai:alerts", a_dict, maxlen=100)

    # Run agents with camelCase dicts
    metrics_dicts = [m.model_dump(by_alias=True, mode="json") for m in metrics]
    decisions = await orchestrator.process_metrics(
        metrics_dicts,
        active_alerts=_recent_alerts,
        recent_negotiations=_recent_negotiations,
    )

    # Tick revenue-at-risk: count unresolved critical alerts
    critical_count = sum(
        1 for a in _recent_alerts[:20]
        if a.get("severity") == "critical" and not a.get("resolvedAt")
    )
    await orchestrator.tick_revenue_at_risk(critical_count)

    for d in decisions:
        _recent_decisions.insert(0, d)
        if len(_recent_decisions) > 200:
            _recent_decisions.pop()
        await redis_client.push_json("sentinelai:decisions", d, maxlen=200)


async def _simulation_loop():
    """Background asyncio task that drives the entire data pipeline at 2s intervals."""
    from app.services.simulation import simulation_engine
    from app.agents.orchestrator import orchestrator

    await orchestrator.initialize()
    logger.info("Simulation loop started — waiting for simulation.start()")

    while True:
        try:
            if simulation_engine.running:
                await _tick()
        except Exception as e:
            logger.exception("Tick error")
        await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attach in-memory state to app.state so routes can access without circular imports
    app.state.latest_metrics = _latest_metrics
    app.state.recent_decisions = _recent_decisions
    app.state.recent_alerts = _recent_alerts
    app.state.recent_negotiations = _recent_negotiations

    # Connect to Redis (graceful fallback to in-memory if unavailable)
    from app.services.redis_client import redis_client
    await redis_client.connect()

    logger.info("SentinelAI backend starting...")
    logger.info("  Simulation mode: %s", settings.simulation_mode)
    logger.info("  Redis: %s", "connected" if redis_client.available else "in-memory fallback")

    task = asyncio.create_task(_simulation_loop())
    yield

    # Shutdown
    logger.info("SentinelAI backend shutting down...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await redis_client.close()


app = FastAPI(
    title="SentinelAI",
    description="Autonomous AI Operations Layer for AWS Connect",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
_origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=("*" not in _origins),  # credentials incompatible with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(queues.router, prefix="/api", tags=["queues"])
app.include_router(agents.router, prefix="/api", tags=["agents"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(simulation.router, prefix="/api", tags=["simulation"])

# WebSocket
app.include_router(ws_router)

# Initialize state immediately so tests and pre-lifespan requests work
app.state.latest_metrics = _latest_metrics
app.state.recent_decisions = _recent_decisions
app.state.recent_alerts = _recent_alerts
app.state.recent_negotiations = _recent_negotiations

# ── Serve frontend static files in production ────────────────────────────────
# When deployed via the root Dockerfile, built frontend lives in /app/static
_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.is_dir():
    from starlette.responses import FileResponse as StarletteFileResponse
    from starlette.types import ASGIApp, Receive, Scope, Send

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    # SPA fallback middleware — serves index.html for non-API/non-WS 404s
    class SPAFallbackMiddleware:
        def __init__(self, app: ASGIApp):
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send):
            if scope["type"] == "http":
                path = scope.get("path", "")
                # Don't intercept API or WS routes
                if not path.startswith("/api") and not path.startswith("/ws"):
                    # Try serving a static file first
                    file_path = _static_dir / path.lstrip("/")
                    if file_path.is_file():
                        response = StarletteFileResponse(str(file_path))
                        await response(scope, receive, send)
                        return
                    # For SPA routes (not a real file), serve index.html
                    if "." not in path.split("/")[-1]:
                        response = StarletteFileResponse(str(_static_dir / "index.html"))
                        await response(scope, receive, send)
                        return
            await self.app(scope, receive, send)

    app = SPAFallbackMiddleware(app)  # type: ignore[assignment]
