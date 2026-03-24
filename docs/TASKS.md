# SentinelAI — Sprint 1 Tasks (Week 1) — ALL COMPLETE
> All Week 1 tasks are done. See [BACKLOG.md](./BACKLOG.md) for Weeks 2-4 (also all done).
> → See [STATUS.md](./STATUS.md) for current build state.
> → See [ARCHITECTURE.md](./ARCHITECTURE.md) for code patterns.

**Status values**: `TODO` | `IN_PROGRESS` | `DONE`

---

## Sprint 1 — Week 1: Foundation

All Week 1 tasks must be completed before the frontend shows any live data.

**Critical path order:**
```
W1-1 (sim loop) → W1-2 (chaos) → W1-3 (routes) → W1-4a (camelCase) → W1-4b (queue routes)
      ↓
W1-5 (queue balancer) → W1-6 (orchestrator) → W1-7 (predictive prevention) → W1-8 (alert/agent routes)
```

---

### TASK W1-1: Background Simulation Loop
- **Status**: `DONE`
- **File**: `backend/app/main.py`
- **Priority**: 🔴 CRITICAL — nothing works without this
- **Depends on**: Nothing (all singletons already exist)
- **Blocked by**: Nothing
- **Patterns**: [Background Loop Pattern](./ARCHITECTURE.md#background-loop-implementation-pattern)

**What to build:**

Add an asyncio background task in the `lifespan` context manager. Every 2 seconds it should:
1. Check `simulation_engine.running` — skip tick if False
2. Call `simulation_engine.generate_metrics()` → 5 `QueueMetrics` objects
3. For each metric → call `anomaly_engine.evaluate(metric)` → get `Alert` list
4. Broadcast `queue:update` for each metric (camelCase serialized)
5. Broadcast `alert:new` for each alert
6. Append to in-memory `_latest_metrics`, `_recent_alerts` dicts/lists
7. Call `orchestrator.process_metrics(metrics_as_dicts)` → get decisions
8. Broadcast `agent:reasoning` for each decision
9. Append decisions to `_recent_decisions`

**Add these module-level vars to `main.py`** (imported by routes):
```python
_latest_metrics: dict[str, dict] = {}     # queue_id → latest QueueMetrics (camelCase)
_recent_decisions: list[dict] = []         # newest first, max 200
_recent_alerts: list[dict] = []            # newest first, max 100
_recent_negotiations: list[dict] = []      # newest first, max 50
```

**Loop scaffold:**
```python
import asyncio
from app.services.simulation import simulation_engine
from app.services.anomaly import anomaly_engine
from app.agents.orchestrator import orchestrator
from app.api.websocket import manager

async def _simulation_loop():
    await orchestrator.initialize()
    while True:
        try:
            if simulation_engine.running:
                await _tick()
        except Exception as e:
            print(f"[loop] tick error: {e}")
        await asyncio.sleep(2)

async def _tick():
    metrics = simulation_engine.generate_metrics()
    for m in metrics:
        alerts = anomaly_engine.evaluate(m)
        m_dict = m.model_dump(by_alias=True, mode="json")  # camelCase
        _latest_metrics[m.queue_id] = m_dict
        await manager.broadcast("queue:update", m_dict)
        for a in alerts:
            a_dict = a.model_dump(by_alias=True, mode="json")
            _recent_alerts.insert(0, a_dict)
            if len(_recent_alerts) > 100: _recent_alerts.pop()
            await manager.broadcast("alert:new", a_dict)
    metrics_dicts = [m.model_dump(by_alias=True, mode="json") for m in metrics]
    decisions = await orchestrator.process_metrics(metrics_dicts)
    for d in decisions:
        _recent_decisions.insert(0, d)
        if len(_recent_decisions) > 200: _recent_decisions.pop()

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_simulation_loop())
    yield
    task.cancel()
    try: await task
    except asyncio.CancelledError: pass
```

**Acceptance criteria:**
- [ ] `GET /api/health` → 200 OK
- [ ] Connect to ws://localhost:8000/ws/dashboard → after `POST /api/simulation/start`, `queue:update` events arrive every 2s
- [ ] Terminal logs show tick running without errors
- [ ] Chaos injection produces `alert:new` events

---

### TASK W1-2: Simulation Chaos Event Application
- **Status**: `DONE`
- **File**: `backend/app/services/simulation.py`
- **Priority**: 🔴 HIGH
- **Depends on**: W1-1 (loop calls generate_metrics which will apply chaos)

**What to build:**

Modify `generate_metrics()` to apply any pending chaos events from `self._chaos_events` AFTER generating base metrics.

**Chaos types and effects:**

| Type | Params | Effect |
|------|--------|--------|
| `spike_queue` | `queue_id`, `multiplier` (default 4.0) | `contacts_in_queue *= multiplier`, `abandonment_rate *= 1.5`, `service_level *= 0.5` |
| `kill_agents` | `queue_id`, `agents_count` | `agents_online -= agents_count` (min 1), `agents_available = max(0, agents_available - agents_count)` |
| `restore_agents` | `queue_id` | Reset agents_online/available to base values for that queue |
| `cascade_failure` | `source_queue` | source_queue: 5x multiplier; all other queues: 1.5x multiplier |
| `network_delay` | `delay_ms` | All queues: `avg_wait_time += delay_ms / 1000` |

**Also add:**
```python
def adjust_queue(self, queue_id: str, agents_delta: int):
    """Adjust agent count for a queue. Called by Queue Balancer execute()."""
    for q in SIMULATED_QUEUES:
        if q["id"] == queue_id:
            q["agents"] = max(1, q["agents"] + agents_delta)
            break

def clear_chaos(self):
    """Remove all chaos events (called by stop() and restore scenarios)."""
    self._chaos_events.clear()
    # Reset queues to original base values
```

**Implementation approach:**
- After generating base metrics list, iterate `self._chaos_events` and mutate the metrics in-place
- Chaos events persist across ticks (they're not consumed — they keep applying until cleared)
- `stop()` should call `clear_chaos()` and reset SIMULATED_QUEUES agents to original values

**Acceptance criteria:**
- [ ] POST `/api/simulation/chaos` with `{"type":"spike_queue","params":{"queue_id":"q-support","multiplier":4.0}}` → within 2s, `queue:update` for q-support shows ~4x contacts
- [ ] POST `{"type":"kill_agents","params":{"queue_id":"q-general","agents_count":5}}` → q-general agents_online drops by 5
- [ ] `adjust_queue("q-support", 2)` → q-support agents_online increases by 2 on next tick

---

### TASK W1-3: Wire Simulation API Routes
- **Status**: `DONE`
- **File**: `backend/app/api/routes/simulation.py`
- **Priority**: 🔴 HIGH
- **Depends on**: W1-1 (simulation_engine must exist), W1-2 (chaos application)

**What to build:**

Replace all TODO placeholders with real calls to `simulation_engine`:

```python
from app.services.simulation import simulation_engine

@router.post("/simulation/start")
async def start_simulation(request: SimulationStartRequest):
    await simulation_engine.start(scenario=request.scenario_id)
    return {"status": "started", "scenario_id": request.scenario_id}

@router.post("/simulation/stop")
async def stop_simulation():
    await simulation_engine.stop()
    return {"status": "stopped"}

@router.post("/simulation/chaos")
async def inject_chaos(request: ChaosRequest):
    simulation_engine.inject_chaos(request.type, request.params)
    return {"status": "injected", "type": request.type, "params": request.params}

@router.get("/simulation/status")
async def get_simulation_status():
    return {
        "running": simulation_engine.running,
        "scenario": simulation_engine.scenario,
        "tick": simulation_engine.tick,
    }
```

For `whatif`, return a mock for now:
```python
@router.post("/simulation/whatif")
async def what_if(request: WhatIfRequest):
    return {
        "query": request.query,
        "result": "Predicted: if 2 agents moved from Billing → Support, queue depth normalizes in ~3 min. Estimated savings: ~$180."
    }
```

**Acceptance criteria:**
- [ ] `POST /api/simulation/start {"scenario_id":"normal"}` → `{"status":"started"}`
- [ ] `POST /api/simulation/stop` → loop stops, no more WS events
- [ ] `POST /api/simulation/chaos {"type":"spike_queue","params":{"queue_id":"q-support","multiplier":4.0}}` → chaos applied
- [ ] `GET /api/simulation/scenarios` still returns 5 scenarios (already works)
- [ ] `GET /api/simulation/status` returns current state

---

### TASK W1-4a: Add camelCase Aliases to Pydantic Models
- **Status**: `DONE`
- **File**: `backend/app/models/__init__.py`, `queue.py`, `alert.py`, `agent.py`, `action.py`
- **Priority**: 🔴 CRITICAL — frontend CANNOT parse data without this
- **Depends on**: Nothing
- **Patterns**: [Serialization Pattern](./ARCHITECTURE.md#serialization-pattern-critical)

**What to build:**

Add a shared base model to `backend/app/models/__init__.py`:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # accepts both snake and camel on input
    )

# Re-export all models (keep existing imports working)
from app.models.queue import QueueMetrics
from app.models.alert import Alert, AlertSeverity
from app.models.agent import AgentType, DecisionPhase, AgentDecision, NegotiationProposal, AgentNegotiation
from app.models.action import CostImpact, ActionLog
```

Change each model to extend `CamelModel` instead of `BaseModel`:
- `backend/app/models/queue.py`: `class QueueMetrics(CamelModel):`
- `backend/app/models/alert.py`: `class Alert(CamelModel):`
- `backend/app/models/agent.py`: All 3 model classes → `(CamelModel)`

**Verify the mapping works:**
```python
from app.models import QueueMetrics
m = QueueMetrics(queue_id="q-test", queue_name="Test", ...)
m.model_dump(by_alias=True)
# → {"queueId": "q-test", "queueName": "Test", "contactsInQueue": 0, ...}
```

**Acceptance criteria:**
- [ ] `QueueMetrics(...).model_dump(by_alias=True)` returns `{"queueId": ..., "contactsInQueue": ...}`
- [ ] `Alert(...).model_dump(by_alias=True)` returns `{"queueId": ..., "recommendedAction": ...}`
- [ ] `AgentDecision(...).model_dump(by_alias=True)` returns `{"agentType": ..., "decisionPhase": ...}`
- [ ] Existing tests still pass

---

### TASK W1-4b: Wire Queue Routes to Return Live Data
- **Status**: `DONE`
- **File**: `backend/app/api/routes/queues.py`
- **Priority**: 🔴 HIGH — frontend loads initial state from REST
- **Depends on**: W1-1 (sim loop populates `_latest_metrics`), W1-4a (camelCase)

**What to build:**

```python
from fastapi import HTTPException
from app.main import _latest_metrics

@router.get("/queues")
async def list_queues():
    return {"queues": list(_latest_metrics.values())}

@router.get("/queues/{queue_id}/metrics")
async def get_queue_metrics(queue_id: str):
    if queue_id not in _latest_metrics:
        raise HTTPException(status_code=404, detail=f"Queue {queue_id} not found")
    return _latest_metrics[queue_id]
```

**⚠️ Import cycle risk**: If `main.py` imports routes and routes import `main.py`, you'll get a circular import. Avoid this by using `app.state` instead:

```python
# In main.py lifespan, store on app.state:
app.state.latest_metrics = _latest_metrics  # pass the reference

# In routes/queues.py, use Request:
from fastapi import Request
@router.get("/queues")
async def list_queues(request: Request):
    return {"queues": list(request.app.state.latest_metrics.values())}
```

Use whichever approach works without circular imports.

**Acceptance criteria:**
- [ ] `GET /api/queues` returns 5 queues with camelCase fields when simulation is running
- [ ] `GET /api/queues/q-support/metrics` returns single queue data
- [ ] Frontend MetricsSidebar populates on page load

---

### TASK W1-5: Implement Queue Balancer Agent
- **Status**: `DONE`
- **File**: `backend/app/agents/queue_balancer.py`
- **Priority**: 🔴 HIGH — first agent, enables agent decision feed
- **Depends on**: W1-4a (model serialization)
- **Patterns**: [Agent Template](./ARCHITECTURE.md#adding-a-new-agent--template)

**What to build:**

The Queue Balancer detects pressure imbalances (overloaded vs idle queues) and proposes agent rebalancing.

**`evaluate()` algorithm:**
1. Calculate `pressure[queue_id] = contacts_in_queue / max(agents_available, 1)` for each queue
2. If `max_pressure - min_pressure < 2.0`: return empty (no significant imbalance)
3. Identify the most overloaded and most idle queues
4. Check that idle queue won't drop below `min_staffing` (default: 2 agents) after move
5. Return an `AgentDecision` with:
   - `phase=DecisionPhase.DECIDED`
   - `summary`: one-line description
   - `reasoning`: includes pressure values, threshold, recommended move
   - `action`: parseable string e.g. `"move_agents:from=q-billing:to=q-support:count=2"`

**`execute()` algorithm:**
1. Parse the action string to extract `from_queue`, `to_queue`, `count`
2. Call `simulation_engine.adjust_queue(from_queue, -count)` and `adjust_queue(to_queue, +count)`
3. Return `True`

**Full implementation:**
```python
from datetime import datetime, timezone
from app.models import AgentDecision, AgentType, DecisionPhase

class QueueBalancerAgent:
    def __init__(self):
        self.min_staffing: dict[str, int] = {}

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        if not queue_states:
            return []
        decisions = []
        pressures = {
            q["queueId"]: q["contactsInQueue"] / max(q["agentsAvailable"], 1)
            for q in queue_states
        }
        max_p = max(pressures.values())
        min_p = min(pressures.values())
        if max_p - min_p < 2.0:
            return []
        overloaded_id = max(pressures, key=pressures.get)
        idle_id = min(pressures, key=pressures.get)
        overloaded_q = next(q for q in queue_states if q["queueId"] == overloaded_id)
        idle_q = next(q for q in queue_states if q["queueId"] == idle_id)
        min_agents = self.min_staffing.get(idle_id, 2)
        if idle_q["agentsOnline"] - 2 < min_agents:
            return []
        decisions.append(AgentDecision(
            id=f"qb-{datetime.now(timezone.utc).timestamp():.0f}",
            agent_type=AgentType.QUEUE_BALANCER,
            phase=DecisionPhase.DECIDED,
            summary=f"Move 2 agents: {idle_q['queueName']} → {overloaded_q['queueName']}",
            reasoning=(
                f"Pressure imbalance: {overloaded_q['queueName']} at {max_p:.1f}x, "
                f"{idle_q['queueName']} at {min_p:.1f}x. "
                f"Diff={max_p-min_p:.1f} exceeds threshold 2.0. "
                f"Moving 2 agents will reduce imbalance by ~{(max_p-min_p)*0.4:.1f}x."
            ),
            action=f"move_agents:from={idle_id}:to={overloaded_id}:count=2",
        ))
        return decisions

    async def execute(self, action: dict) -> bool:
        from app.services.simulation import simulation_engine
        from_q = action.get("from_queue")
        to_q = action.get("to_queue")
        count = int(action.get("count", 2))
        if from_q and to_q:
            simulation_engine.adjust_queue(from_q, -count)
            simulation_engine.adjust_queue(to_q, count)
            return True
        return False
```

**Note**: Queue states passed in are already camelCase (from WS broadcast). Access with `q["queueId"]`, `q["contactsInQueue"]`, etc.

**Acceptance criteria:**
- [ ] When a queue has 2x+ pressure vs lowest-pressure queue, a `DECIDED` decision is returned
- [ ] Decision has non-empty `reasoning` with actual pressure values
- [ ] `execute()` calls `simulation_engine.adjust_queue()` and returns True
- [ ] Never proposes move that drops source queue below 2 agents

---

### TASK W1-6: Implement Orchestrator Core
- **Status**: `DONE`
- **File**: `backend/app/agents/orchestrator.py`
- **Priority**: 🔴 HIGH
- **Depends on**: W1-5

**What to build:**

Plain Python sequential agent calls (no LangGraph yet — that's optional Week 2 enhancement):

```python
from app.models import AgentType
from app.agents.queue_balancer import QueueBalancerAgent
from app.api.websocket import manager

class AgentOrchestrator:
    def __init__(self):
        self.agents = {}
        self._initialized = False

    async def initialize(self):
        self.agents[AgentType.QUEUE_BALANCER] = QueueBalancerAgent()
        # Add more agents as implemented
        self._initialized = True

    async def process_metrics(self, metrics: list[dict]) -> list[dict]:
        if not self._initialized:
            return []
        all_decisions = []
        # Queue Balancer
        if AgentType.QUEUE_BALANCER in self.agents:
            decisions = await self.agents[AgentType.QUEUE_BALANCER].evaluate(metrics)
            for d in decisions:
                d_dict = d.model_dump(by_alias=True, mode="json")
                await manager.broadcast("agent:reasoning", d_dict)
                all_decisions.append(d_dict)
        return all_decisions

    async def execute_decision(self, decision_id: str, decisions_list: list[dict]) -> bool:
        """Execute an approved decision. Called from WS approve handler."""
        decision = next((d for d in decisions_list if d.get("id") == decision_id), None)
        if not decision:
            return False
        action_str = decision.get("action", "")
        if action_str.startswith("move_agents"):
            parts = dict(p.split("=") for p in action_str.split(":")[1:])
            agent = self.agents.get(AgentType.QUEUE_BALANCER)
            if agent:
                return await agent.execute({"from_queue": parts.get("from"), "to_queue": parts.get("to"), "count": parts.get("count", 2)})
        return False

    async def handle_chat(self, message: str) -> dict:
        return {
            "message": f"Processing: '{message}'. Analytics agent will be available in Week 3.",
            "reasoning": "Analytics agent not yet initialized."
        }
```

**Acceptance criteria:**
- [ ] After simulation starts, `agent:reasoning` WS events appear when queue imbalance occurs
- [ ] `orchestrator.initialize()` creates QueueBalancerAgent
- [ ] `orchestrator.process_metrics(metrics)` returns list of decision dicts
- [ ] Decisions appear in AIDecisionFeed on frontend

---

### TASK W1-7: Implement Predictive Prevention Agent
- **Status**: `DONE`
- **File**: `backend/app/agents/predictive_prevention.py`
- **Priority**: 🟡 HIGH (high wow-factor, good for demo)
- **Depends on**: W1-6 (orchestrator must register it)
- **Patterns**: [Agent Template](./ARCHITECTURE.md#adding-a-new-agent--template)

**What to build:**

Tracks velocity (rate of change) per queue and predicts future problems before they become critical.

**Algorithm:**
1. Maintain `self.history[queue_id]` — deque of `(timestamp, contacts)` pairs, max 10 items
2. On each evaluate call, append current readings
3. If < 3 data points: skip (not enough history)
4. Calculate velocity: `(latest_contacts - oldest_contacts) / (latest_time - oldest_time)` contacts/second
5. Predict in 60s: `contacts_now + velocity * 60`
6. Threshold: `agents_online * 2.5` = "critical level"
7. If predicted > threshold AND velocity > 0.1: generate `ANALYZED` decision with cascade warning
8. Also broadcast `prediction:warning` event

**Key imports:** `from collections import defaultdict, deque`

**Decision should include:**
- `phase=DecisionPhase.ANALYZED` (not yet DECIDED — it's a warning)
- `reasoning`: shows velocity, current, predicted, threshold
- `action`: `"preemptive_reinforce:{queue_id}"`

**After implementing**: Register in `orchestrator.initialize()`:
```python
from app.agents.predictive_prevention import PredictivePreventionAgent
self.agents[AgentType.PREDICTIVE_PREVENTION] = PredictivePreventionAgent()
```

And call it in `process_metrics()` alongside Queue Balancer.

**Acceptance criteria:**
- [ ] After chaos spike, predictive agent generates ANALYZED decisions within 6s (3 ticks of history)
- [ ] Decision reasoning shows: current contacts, velocity (contacts/sec), predicted in 60s, threshold
- [ ] `prediction:warning` WS event is broadcast for each analyzed decision
- [ ] In AIDecisionFeed, decisions appear with "Analyzed" phase (different color than "Decided")

---

### TASK W1-8: Implement Alert and Agent Routes
- **Status**: `DONE`
- **File**: `backend/app/api/routes/alerts.py`, `backend/app/api/routes/agents.py`
- **Priority**: 🟡 MEDIUM
- **Depends on**: W1-1 (in-memory lists populated)

**What to build:**

**`routes/alerts.py`:**
```python
from fastapi import HTTPException
from datetime import datetime, timezone

# Use app.state to avoid circular imports
@router.get("/alerts")
async def list_alerts(request: Request):
    return {"alerts": request.app.state.recent_alerts}

@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, request: Request):
    alerts = request.app.state.recent_alerts
    for alert in alerts:
        if alert["id"] == alert_id:
            alert["resolvedAt"] = datetime.now(timezone.utc).isoformat()
            alert["resolvedBy"] = "human"
            from app.api.websocket import manager
            await manager.broadcast("alert:resolved", {"id": alert_id})
            return {"status": "acknowledged", "id": alert_id}
    raise HTTPException(status_code=404, detail="Alert not found")
```

**`routes/agents.py`:**
```python
@router.get("/agents")
async def list_agents():
    return {"agents": [
        {"type": "queue_balancer", "name": "Queue Balancer", "status": "active", "description": "Monitors queue pressure and rebalances agents"},
        {"type": "predictive_prevention", "name": "Predictive Prevention", "status": "active", "description": "Tracks velocity trends to predict future spikes"},
        {"type": "escalation_handler", "name": "Escalation Handler", "status": "active", "description": "Routes critical alerts to human supervisors"},
        {"type": "analytics", "name": "Analytics Agent", "status": "active", "description": "Answers natural language questions about system state"},
    ]}

@router.get("/agents/decisions")
async def list_decisions(request: Request):
    return {"decisions": request.app.state.recent_decisions}

@router.get("/agents/negotiations")
async def list_negotiations(request: Request):
    return {"negotiations": request.app.state.recent_negotiations}
```

**In `main.py` lifespan**, attach state:
```python
app.state.latest_metrics = _latest_metrics
app.state.recent_decisions = _recent_decisions
app.state.recent_alerts = _recent_alerts
app.state.recent_negotiations = _recent_negotiations
```

**Acceptance criteria:**
- [ ] `GET /api/alerts` returns active alerts during simulation
- [ ] `POST /api/alerts/{id}/acknowledge` marks alert as resolved, broadcasts `alert:resolved`
- [ ] `GET /api/agents` returns 4 agent cards
- [ ] `GET /api/agents/decisions` returns recent decisions
- [ ] Alerts page in frontend shows live alerts with acknowledge button

---

## Sprint 1 Completion Checklist

Before moving to [BACKLOG.md Week 2](./BACKLOG.md):

- [ ] Simulation starts via UI button → metrics update every 2s in MetricsSidebar
- [ ] Chaos injection via UI → CRITICAL alert appears in AlertPanel
- [ ] Queue Balancer fires decisions → decisions appear in AIDecisionFeed
- [ ] Predictive Prevention fires ANALYZED warnings → appear in feed
- [ ] All 5 queues visible on page load from REST `GET /api/queues`
- [ ] Alerts can be acknowledged from AlertsPage
- [ ] No console errors in frontend related to WS or data parsing

→ Continue to [BACKLOG.md](./BACKLOG.md) for Week 2 tasks
