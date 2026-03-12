import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import alerts, agents, chat, health, queues, simulation
from app.api.websocket import router as ws_router
from app.config import settings

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


async def _simulation_loop():
    """Background asyncio task that drives the entire data pipeline at 2s intervals."""
    from app.services.simulation import simulation_engine
    from app.agents.orchestrator import orchestrator

    await orchestrator.initialize()
    print("[loop] Simulation loop started — waiting for simulation.start()")

    while True:
        try:
            if simulation_engine.running:
                await _tick()
        except Exception as e:
            print(f"[loop] tick error: {e}")
        await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attach in-memory state to app.state so routes can access without circular imports
    app.state.latest_metrics = _latest_metrics
    app.state.recent_decisions = _recent_decisions
    app.state.recent_alerts = _recent_alerts
    app.state.recent_negotiations = _recent_negotiations

    print("SentinelAI backend starting...")
    print(f"  Simulation mode: {settings.simulation_mode}")
    print(f"  Redis: {settings.redis_url}")

    task = asyncio.create_task(_simulation_loop())
    yield

    # Shutdown
    print("SentinelAI backend shutting down...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="SentinelAI",
    description="Autonomous AI Operations Layer for AWS Connect",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
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
