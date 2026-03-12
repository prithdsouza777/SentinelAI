from fastapi import APIRouter
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
async def start_simulation(request: SimulationStartRequest):
    """Start a simulation scenario."""
    await simulation_engine.start(scenario=request.scenario_id)
    return {"status": "started", "scenario_id": request.scenario_id}


@router.post("/simulation/stop")
async def stop_simulation():
    """Stop the current simulation."""
    await simulation_engine.stop()
    return {"status": "stopped"}


@router.post("/simulation/chaos")
async def inject_chaos(request: ChaosRequest):
    """Inject a chaos event into the running simulation."""
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
async def what_if(request: WhatIfRequest):
    """Run a what-if simulation (mock response until Bedrock integration in Week 3)."""
    return {
        "query": request.query,
        "result": (
            "Predicted: if 2 agents moved from Billing → Support, "
            "queue depth normalizes in ~3 min. Estimated savings: ~$180."
        ),
    }
