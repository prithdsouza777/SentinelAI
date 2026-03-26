from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.simulation import simulation_engine

router = APIRouter()


class SimulationStartRequest(BaseModel):
    scenario_id: str


class ChaosRequest(BaseModel):
    type: str
    params: dict = {}


class WhatIfRequest(BaseModel):
    query: str


SCENARIOS = [
    {
        "id": "sentinelai_demo",
        "name": "SentinelAI Demo (3 min)",
        "description": "Scripted 3-minute demo: calm → storm → negotiation → resolution → intelligence",
        "duration": 180,
        "featured": True,
    },
    {
        "id": "normal",
        "name": "Normal Operations",
        "description": "Steady-state with natural variation",
        "duration": 300,
    },
    {
        "id": "volume_spike",
        "name": "Volume Spike",
        "description": "Sudden 3-5x increase in one queue",
        "duration": 180,
    },
    {
        "id": "agent_dropout",
        "name": "Agent Dropout",
        "description": "Multiple agents go offline simultaneously",
        "duration": 180,
    },
    {
        "id": "cascade_failure",
        "name": "Cascading Failure",
        "description": "One queue overwhelms, spills into others",
        "duration": 240,
    },
    {
        "id": "peak_rush",
        "name": "Peak Hour Rush",
        "description": "Gradual ramp-up across all queues",
        "duration": 300,
    },
]


@router.get("/simulation/scenarios")
async def list_scenarios():
    """List available simulation scenarios."""
    return {"scenarios": SCENARIOS}


@router.post("/simulation/start")
async def start_simulation(request: SimulationStartRequest, req: Request):
    """Start a simulation scenario."""
    from app.agents.guardrails import guardrails
    from app.agents.orchestrator import orchestrator
    from app.services.anomaly import anomaly_engine
    # Reset all state for a clean demo
    guardrails.reset()
    anomaly_engine.reset()
    orchestrator._total_saved = 0.0
    orchestrator._revenue_at_risk = 0.0
    orchestrator._prevented_abandoned = 0
    orchestrator._actions_today = 0
    req.app.state.recent_decisions.clear()
    req.app.state.recent_alerts.clear()
    req.app.state.recent_negotiations.clear()
    # RAIA trace session is NOT auto-started here.
    # User must explicitly click "Connect RAIA" in the governance panel.

    await simulation_engine.start(scenario=request.scenario_id)
    return {"status": "started", "scenario_id": request.scenario_id}


@router.post("/simulation/stop")
async def stop_simulation(request: Request):
    """Stop the current simulation and clear in-memory state for clean restart."""
    await simulation_engine.stop()
    # End RAIA trace session
    from app.services.raia_tracer import end_session as raia_end
    raia_end()
    # Clear in-memory state so next demo starts fresh
    request.app.state.latest_metrics.clear()
    request.app.state.recent_decisions.clear()
    request.app.state.recent_alerts.clear()
    request.app.state.recent_negotiations.clear()
    # Reset guardrails + orchestrator cost accumulators
    from app.agents.guardrails import guardrails
    from app.agents.orchestrator import orchestrator
    guardrails.reset()
    orchestrator._total_saved = 0.0
    orchestrator._revenue_at_risk = 0.0
    orchestrator._prevented_abandoned = 0
    orchestrator._actions_today = 0
    return {"status": "stopped"}


@router.post("/session/reset")
async def reset_session(request: Request):
    """Clear accumulated metrics so a browser refresh starts with clean counters.

    Does NOT stop the simulation — the demo keeps running.  Only clears
    alerts, decisions, negotiations, cost accumulators, and governance
    counters.  Workforce data (from SQLite) is untouched.
    """
    from app.agents.guardrails import guardrails
    from app.agents.orchestrator import orchestrator

    # Clear in-memory collections (but keep simulation running)
    request.app.state.recent_decisions.clear()
    request.app.state.recent_alerts.clear()
    request.app.state.recent_negotiations.clear()
    if hasattr(request.app.state, "metrics_history"):
        request.app.state.metrics_history.clear()

    # Reset cost / governance accumulators
    guardrails.reset()
    orchestrator._total_saved = 0.0
    orchestrator._revenue_at_risk = 0.0
    orchestrator._prevented_abandoned = 0
    orchestrator._actions_today = 0

    # Reset tick counter and routing log so report shows 0
    simulation_engine.tick = 0
    simulation_engine._routing_log.clear()

    return {"status": "reset"}


@router.post("/simulation/chaos")
async def inject_chaos(request: ChaosRequest):
    """Inject a chaos event into the running simulation. Auto-starts if idle."""
    if not simulation_engine.running:
        await simulation_engine.start(scenario="normal")
    simulation_engine.inject_chaos(request.type, request.params)
    return {"status": "injected", "type": request.type, "params": request.params}


@router.get("/simulation/status")
async def get_simulation_status():
    """Get current simulation state."""
    return {
        "running": simulation_engine.running,
        "scenario": simulation_engine.scenario,
        "tick": simulation_engine.tick,
    }


@router.post("/simulation/whatif")
async def what_if(body: WhatIfRequest, request: Request):
    """Run a what-if simulation using the Analytics Agent."""
    from app.agents.analytics import analytics_agent
    context = {
        "recent_alerts": list(getattr(request.app.state, "recent_alerts", []))[:5],
        "recent_decisions": list(getattr(request.app.state, "recent_decisions", []))[:5],
        "queue_metrics": list(getattr(request.app.state, "latest_metrics", {}).values()),
    }
    result = await analytics_agent.query(f"what if {body.query}", context)
    return {
        "query": body.query,
        "result": result.get("message", "Unable to generate prediction."),
    }
