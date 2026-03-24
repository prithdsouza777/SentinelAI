# SentinelAI — Technical Architecture
> Reference manual. Read this when you need to know HOW to write the code.
> → See [TASKS.md](./TASKS.md) for WHAT to build.
> → See [CONTEXT.md](./CONTEXT.md) for WHY decisions were made.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TS)                 │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Operations │ │  Agents  │ │  Alerts  │ │   Chat   │ │
│  │  Center   │ │   Page   │ │   Page   │ │   Page   │ │
│  └─────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│        └────────────┴────────────┴────────────┘        │
│                           │                             │
│               ┌───────────▼───────────┐                │
│               │  Zustand dashboardStore│                │
│               └───────────┬───────────┘                │
│                           │                             │
│  ┌────────────────────────▼───────────────────────┐   │
│  │ WebSocketProvider  │  API Client (api.ts)       │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
              WS: ws://localhost:8000/ws/dashboard
              HTTP: http://localhost:8000/api/*
┌──────────────────────────▼──────────────────────────────┐
│                 BACKEND (FastAPI + Python)                │
│  ┌────────────────────────────────────────────────────┐ │
│  │          main.py — Background Loop (3s tick)        │ │
│  │                                                     │ │
│  │  simulation_engine.generate_metrics()               │ │
│  │    └─→ anomaly_engine.evaluate()  ──→ alerts        │ │
│  │    └─→ orchestrator.process_metrics()               │ │
│  │           ├─→ QueueBalancerAgent.evaluate()         │ │
│  │           ├─→ PredictivePreventionAgent.evaluate()  │ │
│  │           ├─→ EscalationHandlerAgent.evaluate()     │ │
│  │           ├─→ SkillRouterAgent.evaluate()           │ │
│  │           └─→ NegotiationProtocol.resolve() [if ⚡] │ │
│  │    └─→ manager.broadcast() ────────────────────────┼─┤→ Frontend
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  REST: /api/queues  /api/alerts  /api/agents  /api/chat  │
│        /api/simulation                                    │
└──────────────────────────────────────────────────────────┘
```

---

## Singleton Instances

**Always import these — never create new instances:**

```python
from app.services.simulation import simulation_engine   # SimulationEngine
from app.services.anomaly import anomaly_engine         # AnomalyEngine
from app.api.websocket import manager                   # ConnectionManager
from app.agents.orchestrator import orchestrator        # AgentOrchestrator
from app.agents.negotiation import negotiation_protocol # NegotiationProtocol
```

---

## Background Loop Implementation Pattern

```python
# backend/app/main.py — complete pattern

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

# Module-level shared state (used by REST routes)
_latest_metrics: dict[str, dict] = {}
_recent_decisions: list[dict] = []
_recent_alerts: list[dict] = []
_recent_negotiations: list[dict] = []


async def _simulation_loop():
    """Runs every 2s. Drives the entire system."""
    await orchestrator.initialize()
    while True:
        try:
            if simulation_engine.running:
                await _tick()
        except Exception as e:
            print(f"[loop] error: {e}")  # never crash the loop
        await asyncio.sleep(3)


async def _tick():
    metrics = simulation_engine.generate_metrics()
    for m in metrics:
        # Anomaly detection
        alerts = anomaly_engine.evaluate(m)
        m_dict = m.model_dump(by_alias=True, mode="json")
        _latest_metrics[m.queue_id] = m_dict
        await manager.broadcast("queue:update", m_dict)
        for a in alerts:
            a_dict = a.model_dump(by_alias=True, mode="json")
            _recent_alerts.insert(0, a_dict)
            if len(_recent_alerts) > 100: _recent_alerts.pop()
            await manager.broadcast("alert:new", a_dict)

    # Agent reasoning
    metrics_dicts = [m.model_dump(by_alias=True, mode="json") for m in metrics]
    active_alerts = [a for a in _recent_alerts if not a.get("resolvedAt")]
    decisions = await orchestrator.process_metrics(metrics_dicts, active_alerts)
    for d in decisions:
        _recent_decisions.insert(0, d)
        if len(_recent_decisions) > 200: _recent_decisions.pop()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Expose state on app.state (used by routes via Request)
    app.state.latest_metrics = _latest_metrics
    app.state.recent_decisions = _recent_decisions
    app.state.recent_alerts = _recent_alerts
    app.state.recent_negotiations = _recent_negotiations
    # Start loop
    task = asyncio.create_task(_simulation_loop())
    yield
    # Shutdown
    task.cancel()
    try: await task
    except asyncio.CancelledError: pass
```

---

## Serialization Pattern (CRITICAL)

**The Problem**: Backend Pydantic models use `snake_case`. Frontend TypeScript uses `camelCase`.

| Backend (Python) | Frontend (TypeScript) |
|------------------|-----------------------|
| `queue_id` | `queueId` |
| `contacts_in_queue` | `contactsInQueue` |
| `agent_type` | `agentType` |
| `avg_wait_time` | `avgWaitTime` |
| `requires_approval` | `requiresApproval` |

### Fix: CamelModel Base Class

Add to `backend/app/models/__init__.py`:
```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # accepts both snake and camel on input
    )
```

Change all models to extend `CamelModel`:
```python
class QueueMetrics(CamelModel): ...
class Alert(CamelModel): ...
class AgentDecision(CamelModel): ...
```

### Always broadcast with by_alias=True

```python
# CORRECT — camelCase output
await manager.broadcast("queue:update", metric.model_dump(by_alias=True, mode="json"))
#                                                         ^^^^^^^^^^^^^^^^ REQUIRED

# WRONG — snake_case, frontend can't read it
await manager.broadcast("queue:update", metric.model_dump())
```

`mode="json"` converts datetime objects to ISO strings automatically.

---

## Adding a New Agent — Template

```python
"""[AgentName].

One-sentence description of what it detects and does.
"""
from datetime import datetime, timezone
from app.models import AgentDecision, AgentType, DecisionPhase


class [AgentName]Agent:
    def __init__(self):
        # State: history tracking, thresholds, etc.
        pass

    async def evaluate(self, queue_states: list[dict], alerts: list[dict] = []) -> list[AgentDecision]:
        """Evaluate system state. Return proposed decisions (empty = no action needed).

        Args:
            queue_states: camelCase queue metrics dicts (from WS broadcast format)
            alerts: active alert dicts (optional, needed by Escalation Handler)
        """
        decisions: list[AgentDecision] = []
        # ... detection logic ...
        decisions.append(AgentDecision(
            id=f"[prefix]-{datetime.now(timezone.utc).timestamp():.0f}",
            agent_type=AgentType.[ENUM_VALUE],
            phase=DecisionPhase.DECIDED,
            summary="One-line action description",
            reasoning="Multi-sentence explanation with actual metric values",
            action="action_type:param1=val1:param2=val2",
            confidence=0.85,
        ))
        return decisions

    async def execute(self, action: dict) -> bool:
        """Execute an approved action. Return True on success."""
        from app.services.simulation import simulation_engine
        # ... call simulation_engine.adjust_queue() etc. ...
        return True


# Module-level singleton
[agent_name]_agent = [AgentName]Agent()
```

### Register in Orchestrator

```python
# backend/app/agents/orchestrator.py — in initialize():
from app.agents.[module_name] import [agent_name]_agent
self.agents[AgentType.[ENUM_VALUE]] = [agent_name]_agent
```

### Queue State Field Names (camelCase, from WS broadcast)

When queue_states are passed to agents, they use camelCase keys:
```python
q["queueId"]           # str: "q-support"
q["queueName"]         # str: "Support"
q["contactsInQueue"]   # int
q["agentsOnline"]      # int
q["agentsAvailable"]   # int
q["avgWaitTime"]       # float (seconds)
q["abandonmentRate"]   # float (percentage 0-100)
q["serviceLevel"]      # float (percentage 0-100)
q["timestamp"]         # str (ISO datetime)
```

---

## WebSocket Events Reference

### Server → Client

| Event | When Fired | Data Type |
|-------|-----------|-----------|
| `queue:update` | Every tick per queue | `QueueMetrics` (camelCase) |
| `alert:new` | Anomaly detected | `Alert` (camelCase) |
| `alert:resolved` | Acknowledged | `{ id: string }` |
| `agent:reasoning` | Agent makes decision | `AgentDecision` (camelCase) |
| `agent:negotiation` | Conflict detected | `AgentNegotiation` (camelCase) |
| `cost:update` | After action executed | `CostSummary` (camelCase) |
| `prediction:warning` | Predictive agent fires | `{ queueId, riskLevel, message }` |
| `chat:response` | After chat message | `{ message, reasoning }` |
| `simulation:event` | Scenario milestone | `{ type, description }` |
| `chaos:injected` | After chaos inject | `{ type, params }` |

### Client → Server

| Event | Sent From | Data |
|-------|----------|------|
| `chat:message` | ChatPage | `{ message: string }` |
| `action:approve` | Decision card | `{ decisionId: string }` |
| `action:reject` | Decision card | `{ decisionId: string }` |
| `chaos:inject` | ChaosPanel | `{ type: string, params: object }` |

### Broadcast Helper

```python
# Always this exact pattern:
await manager.broadcast("event:name", camel_case_dict)

# ConnectionManager.broadcast() wraps it in the envelope:
# { "event": "event:name", "data": {...}, "timestamp": "2026-..." }
```

---

## REST API Contract

All responses use camelCase (enforced by Pydantic alias serialization).

| Method | Path | Response |
|--------|------|---------|
| GET | `/api/health` | `{ status: "ok" }` |
| GET | `/api/queues` | `{ queues: QueueMetrics[] }` |
| GET | `/api/queues/{id}/metrics` | `QueueMetrics` |
| GET | `/api/alerts` | `{ alerts: Alert[] }` |
| POST | `/api/alerts/{id}/acknowledge` | `{ status, id }` |
| GET | `/api/agents` | `{ agents: AgentStatus[] }` |
| GET | `/api/agents/decisions` | `{ decisions: AgentDecision[] }` |
| GET | `/api/agents/negotiations` | `{ negotiations: AgentNegotiation[] }` |
| POST | `/api/chat` | `{ message, reasoning, timestamp }` |
| GET | `/api/simulation/scenarios` | `{ scenarios: Scenario[] }` |
| POST | `/api/simulation/start` | `{ status, scenario_id }` |
| POST | `/api/simulation/stop` | `{ status }` |
| POST | `/api/simulation/chaos` | `{ status, type }` |
| GET | `/api/simulation/status` | `{ running, scenario, tick }` |

---

## Simulated Queues

```python
SIMULATED_QUEUES = [
    {"id": "q-support",  "name": "Support", "base_load": 8,  "agents": 12},
    {"id": "q-billing",  "name": "Billing", "base_load": 5,  "agents": 8},
    {"id": "q-sales",    "name": "Sales",   "base_load": 3,  "agents": 6},
    {"id": "q-general",  "name": "General", "base_load": 4,  "agents": 7},
    {"id": "q-vip",      "name": "VIP",     "base_load": 2,  "agents": 4},
]
```

`base_load` = contacts_in_queue at normal steady state.
`agents` = default agents_online (mutated by chaos/agent execute).

---

## Bedrock Mock Pattern

```python
# backend/app/services/bedrock.py

MOCK_RESPONSES = {
    "what just happened": "A queue spike was detected on Support (4x normal volume). Queue Balancer moved 2 agents from Billing → Support. Escalation Handler flagged priority. Net: queue stabilized in ~4 min. Cost saved: ~$340.",
    "why did":    "The cascade originated in Support (abandonment 38%). Predictive Prevention flagged the velocity trend 90s earlier.",
    "what if":    "Simulation predicts: if 3 agents moved preemptively, queue stays below threshold 85% of scenarios. No action = ~23 abandoned calls (~$460).",
    "recommend":  "Recommend increasing Support staffing by 2 agents during 9am-11am peak. Historical data shows 40% spike probability during this window.",
    "cost":       "Total saved this session: ~$890. 14 actions taken. 168 abandoned calls prevented.",
}

class MockBedrockLLM:
    async def invoke(self, prompt: str, context: dict = {}) -> dict:
        pl = prompt.lower()
        for key, resp in MOCK_RESPONSES.items():
            if key in pl:
                return {"message": resp, "reasoning": f"Matched pattern: '{key}'"}
        return {"message": "System operating within normal parameters. Recent agent action resolved the detected imbalance.", "reasoning": "Default response"}
```

---

## Code Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Python vars/functions | snake_case | `queue_id`, `generate_metrics()` |
| Python classes | PascalCase | `QueueBalancerAgent` |
| Python constants | UPPER_SNAKE | `SIMULATED_QUEUES` |
| TypeScript vars | camelCase | `queueId`, `agentType` |
| TypeScript interfaces | PascalCase | `QueueMetrics` |
| WS event names | `namespace:action` | `queue:update`, `agent:reasoning` |

### Pydantic v2 Reminders (this project uses v2)

```python
model.model_dump()          # NOT .dict()
model.model_dump(by_alias=True, mode="json")  # for broadcast
Model.model_validate(data)  # NOT .parse_obj()
```

### datetime Defaults in Models

```python
# WRONG — evaluated once at class definition:
timestamp: datetime = datetime.now()

# CORRECT — evaluated at instantiation:
from datetime import datetime, timezone
from pydantic import Field
timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

---

## Import Cycle Prevention

`routes/*.py` importing from `main.py` will cause circular imports. Use `app.state` instead:

```python
# In main.py lifespan:
app.state.recent_decisions = _recent_decisions  # pass reference

# In routes/agents.py:
from fastapi import Request
@router.get("/agents/decisions")
async def list_decisions(request: Request):
    return {"decisions": request.app.state.recent_decisions}
```

---

## Testing Pattern

```python
# backend/tests/test_simulation.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_start_simulation():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.post("/api/simulation/start", json={"scenario_id": "normal"})
        assert r.status_code == 200
        assert r.json()["status"] == "started"
```

Run: `cd backend && pytest tests/ -v`

---

## Common Gotchas

1. **camelCase always** — every WS broadcast and REST response must use `by_alias=True` or frontend gets `undefined` fields silently.

2. **Never crash the loop** — wrap `_tick()` in `try/except Exception` so one bad tick doesn't stop everything.

3. **Queue states are camelCase in agents** — agents receive metrics from the loop as already-serialized camelCase dicts. Access `q["queueId"]`, not `q["queue_id"]`.

4. **Pydantic v2 not v1** — use `model_dump()`, not `.dict()`.

5. **LangGraph is optional** — plain Python sequential agent calls work fine for the demo. Only add LangGraph if needed for a talking point.

6. **simulation_mode=True always** — real AWS Connect integration is Week 4 optional. Never block on it.

7. **Mock Bedrock first** — implement `MockBedrockLLM` before trying real Bedrock. Demo works 100% on mock.
