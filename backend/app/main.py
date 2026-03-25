import asyncio
import logging
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import alerts, agents, chat, health, queues, simulation
from app.api.routes import reports, history, notifications, agent_chat, teams
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
_recent_decisions: deque[dict] = deque(maxlen=200)    # newest first
_recent_alerts: deque[dict] = deque(maxlen=100)       # newest first
_recent_negotiations: deque[dict] = deque(maxlen=50)  # newest first
_metrics_history: deque[dict] = deque(maxlen=600)     # trending (≈ 30 min @ 3s ticks)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_fire_and_forget(coro):
    """Schedule a coroutine as a fire-and-forget task with exception logging."""
    def _log_exception(t):
        if not t.cancelled() and t.exception():
            logger.warning("Fire-and-forget task failed: %s", t.exception())
    task = asyncio.create_task(coro)
    task.add_done_callback(_log_exception)
    return task


# ── Simulation tick loop ───────────────────────────────────────────────────────

async def _tick():
    """Single simulation tick: generate metrics, detect anomalies, run agents, broadcast."""
    from app.services.simulation import simulation_engine
    from app.services.anomaly import anomaly_engine
    from app.agents.orchestrator import orchestrator
    from app.api.websocket import manager
    from app.services.redis_client import redis_client
    from app.services.notifications import notification_service

    metrics = simulation_engine.generate_metrics()

    # Sync agent statuses (available/busy/on_break) based on queue load
    simulation_engine.sync_agent_statuses(metrics)

    # Collect all WS events for batch broadcast (reduces per-message overhead)
    ws_batch: list[tuple[str, dict]] = []

    for m in metrics:
        # Anomaly detection (takes QueueMetrics object)
        alerts_list = anomaly_engine.evaluate(m)

        # Serialize to camelCase for WS broadcast + REST cache
        m_dict = m.model_dump(by_alias=True, mode="json")
        _latest_metrics[m.queue_id] = m_dict
        ws_batch.append(("queue:update", m_dict))

        # Track history for trending (deque auto-caps at 600 snapshots)
        _metrics_history.append(m_dict)

        for a in alerts_list:
            a_dict = a.model_dump(by_alias=True, mode="json")
            _recent_alerts.appendleft(a_dict)
            ws_batch.append(("alert:new", a_dict))
            await redis_client.push_json("sentinelai:alerts", a_dict, maxlen=100)
            # Fire-and-forget external notifications (Teams + Gmail)
            _safe_fire_and_forget(notification_service.notify(a_dict))

    # Send all queue updates + alerts in a single WS frame
    await manager.broadcast_batch(ws_batch)

    # Run agents with camelCase dicts (10s timeout prevents tick loop from hanging)
    metrics_dicts = [m.model_dump(by_alias=True, mode="json") for m in metrics]
    try:
        decisions = await asyncio.wait_for(
            orchestrator.process_metrics(
                metrics_dicts,
                active_alerts=_recent_alerts,
                recent_negotiations=_recent_negotiations,
            ),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        logger.warning("Orchestrator timed out (10s) — skipping this tick")
        decisions = []

    # Collect predictive alerts from the PredictivePreventionAgent
    from app.models import AgentType
    pp_agent = orchestrator.agents.get(AgentType.PREDICTIVE_PREVENTION)
    if pp_agent and hasattr(pp_agent, "pending_alerts") and pp_agent.pending_alerts:
        for pa in pp_agent.pending_alerts:
            pa_dict = pa.model_dump(by_alias=True, mode="json")
            _recent_alerts.appendleft(pa_dict)
            await manager.broadcast("alert:new", pa_dict)
            await redis_client.push_json("sentinelai:alerts", pa_dict, maxlen=100)
            _safe_fire_and_forget(notification_service.notify(pa_dict))
        pp_agent.pending_alerts.clear()

    # Tick revenue-at-risk: count unresolved critical alerts
    critical_count = sum(
        1 for a in list(_recent_alerts)[:20]
        if a.get("severity") == "critical" and not a.get("resolvedAt")
    )
    await orchestrator.tick_revenue_at_risk(critical_count)

    for d in decisions:
        _recent_decisions.appendleft(d)
        await redis_client.push_json("sentinelai:decisions", d, maxlen=200)
        # Fire-and-forget approval email + Teams bot card for pending decisions
        if d.get("guardrailResult") == "PENDING_HUMAN":
            asyncio.create_task(notification_service.notify_pending_decision(d))
            from app.services.teams_bot import teams_bot
            if teams_bot.has_conversations():
                _safe_fire_and_forget(teams_bot.send_proactive_approval_card(d))


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
    app.state.metrics_history = _metrics_history

    # Initialize agent workforce database
    from app.services.agent_database import agent_database
    agent_database.initialize()
    app.state.agent_database = agent_database

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
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(agent_chat.router, prefix="/api", tags=["agent-chat"])
app.include_router(teams.router, prefix="/api", tags=["teams-bot"])

# WebSocket
app.include_router(ws_router)

# Initialize state immediately so tests and pre-lifespan requests work
app.state.latest_metrics = _latest_metrics
app.state.recent_decisions = _recent_decisions
app.state.recent_alerts = _recent_alerts
app.state.recent_negotiations = _recent_negotiations
app.state.metrics_history = _metrics_history

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
