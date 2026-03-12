# SentinelAI — Backlog (Weeks 2–4)
> Tasks planned for after Sprint 1 (Week 1) is complete.
> → See [TASKS.md](./TASKS.md) for the current sprint (Week 1).
> → See [STATUS.md](./STATUS.md) for overall build state.

**Status values**: `TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED`

---

## Sprint 2 — Week 2: Core Features

Week 2 focuses on completing the remaining agents, wiring human-in-the-loop governance, and adding cost tracking.

**Tracks (can work in parallel):**
- **Track A**: Remaining agents (Escalation Handler + Negotiation)
- **Track B**: WebSocket action handlers + cost accumulation
- **Track C**: Frontend integration (WS wiring, approve/reject buttons)

---

### TASK W2-1: Escalation Handler Agent
- **Status**: `TODO`
- **File**: `backend/app/agents/escalation_handler.py`
- **Priority**: 🔴 HIGH — needed for the demo's negotiation scene
- **Depends on**: W1-6 (orchestrator)
- **Patterns**: [Agent Template](./ARCHITECTURE.md#adding-a-new-agent--template)

**What to build:**

The Escalation Handler responds to CRITICAL alerts by proposing escalation actions. It intentionally conflicts with Queue Balancer on the same overloaded queue — that conflict is what triggers the negotiation protocol and is the dramatic centerpiece of the 3-minute demo.

**Algorithm for `evaluate()`:**
- Takes `queue_states: list[dict]` AND `alerts: list[dict]` (current active alerts)
- For each CRITICAL alert: generate a `DECIDED` decision proposing escalation
- `action` format: `"escalate:{queue_id}:priority=urgent"`

```python
async def evaluate(self, queue_states: list[dict], alerts: list[dict] = []) -> list[AgentDecision]:
    decisions = []
    for alert in alerts:
        if alert.get("severity") == "critical":
            qid = alert.get("queueId")
            qname = alert.get("queueName", qid)
            decisions.append(AgentDecision(
                id=f"eh-{qid}-{datetime.now(timezone.utc).timestamp():.0f}",
                agent_type=AgentType.ESCALATION_HANDLER,
                phase=DecisionPhase.DECIDED,
                summary=f"Escalate {qname}: notify supervisor + emergency pull",
                reasoning=(
                    f"CRITICAL alert on {qname}. Abandonment or depth threshold crossed. "
                    f"Recommending: (1) page duty supervisor, (2) pull 3 agents from low-priority queues immediately."
                ),
                action=f"escalate:{qid}:priority=urgent",
            ))
    return decisions
```

**After implementing**, register in `orchestrator.initialize()` and call from `process_metrics()`.

Pass `active_alerts` (from `request.app.state.recent_alerts`) to the orchestrator so Escalation Handler has them.

**Acceptance criteria:**
- [ ] CRITICAL alert → Escalation Handler generates DECIDED decision within 1 tick
- [ ] Decision conflicts with Queue Balancer proposal on same queue (both want resources from same pool)
- [ ] Both decisions appear in AIDecisionFeed simultaneously

---

### TASK W2-2: Multi-Agent Negotiation Protocol
- **Status**: `TODO`
- **File**: `backend/app/agents/negotiation.py`, `backend/app/agents/orchestrator.py`
- **Priority**: 🔴 HIGH — the key demo differentiator
- **Depends on**: W2-1

**What to build:**

When Queue Balancer and Escalation Handler both want to act on the same queue, a conflict is detected and the negotiation protocol resolves it.

**Step 1 — Conflict Detection** (add to `orchestrator.py`):
```python
from collections import defaultdict

def _detect_conflicts(self, decisions: list[dict]) -> list[list[dict]]:
    """Group decisions that affect the same queue resource."""
    queue_groups: dict[str, list[dict]] = defaultdict(list)
    for d in decisions:
        action = d.get("action", "")
        # Extract queue ID from action string
        for segment in action.split(":"):
            if segment.startswith("q-"):
                queue_groups[segment].append(d)
                break
            if segment.startswith("from="):
                queue_groups[segment[5:]].append(d)
                break
    return [g for g in queue_groups.values() if len(g) > 1]
```

**Step 2 — Negotiation Resolution** (enhance `negotiation.py`):
```python
import uuid
from app.models import AgentNegotiation, NegotiationProposal

def resolve(self, proposals: list[NegotiationProposal]) -> AgentNegotiation:
    # Score: priority (0-10) * 0.4 + confidence (0-1) * 0.3
    scored = sorted(proposals, key=lambda p: p.priority * 0.4 + p.confidence * 0.3, reverse=True)
    winner = scored[0]
    losers = scored[1:]
    return AgentNegotiation(
        id=str(uuid.uuid4())[:8],
        agents=[p.agent_type for p in proposals],
        topic="Resource allocation conflict",
        proposals=proposals,
        resolution=(
            f"{winner.agent_type.value} proposal accepted: '{winner.proposal}'. "
            f"Score: {winner.priority * 0.4 + winner.confidence * 0.3:.2f}. "
            f"Rejected: {', '.join(l.agent_type.value for l in losers)}."
        ),
    )
```

**Step 3 — Orchestrator Integration** (wire in `process_metrics()`):
```python
conflicts = self._detect_conflicts(all_decisions)
for conflict_group in conflicts:
    proposals = [NegotiationProposal(
        agent_type=d["agentType"],
        proposal=d["summary"],
        priority=d.get("priority", 5),
        confidence=d.get("confidence", 0.8),
    ) for d in conflict_group]
    negotiation = negotiation_protocol.resolve(proposals)
    neg_dict = negotiation.model_dump(by_alias=True, mode="json")
    await manager.broadcast("agent:negotiation", neg_dict)
    _recent_negotiations.insert(0, neg_dict)
    # Remove loser decisions from all_decisions
```

**Acceptance criteria:**
- [ ] Chaos spike on q-support → Queue Balancer + Escalation Handler both fire
- [ ] Conflict detected → `agent:negotiation` WS event with both proposals
- [ ] AgentCollaborationPanel in UI shows the negotiation with proposals from both agents
- [ ] Resolution shown: which agent won and why

---

### TASK W2-3: WebSocket Action:Approve / Action:Reject Handlers
- **Status**: `TODO`
- **File**: `backend/app/api/websocket.py`
- **Priority**: 🔴 HIGH — human-in-the-loop is a core demo moment
- **Depends on**: W1-6 (orchestrator.execute_decision), W2-2

**What to build:**

Wire the existing TODO stubs in the WebSocket receive loop:

```python
elif event == "action:approve":
    decision_id = message.get("data", {}).get("decisionId")
    decisions = websocket.app.state.recent_decisions
    success = await orchestrator.execute_decision(decision_id, decisions)
    if success:
        for d in decisions:
            if d["id"] == decision_id:
                d["phase"] = "acted"
                await manager.broadcast("agent:reasoning", d)
                break

elif event == "action:reject":
    decision_id = message.get("data", {}).get("decisionId")
    decisions = websocket.app.state.recent_decisions
    for d in decisions:
        if d["id"] == decision_id:
            d["rejected"] = True
            d["phase"] = "decided"  # remains decided but won't execute
            break
```

**Acceptance criteria:**
- [ ] Click approve on a decision card → decision phase changes to "acted" in UI
- [ ] Click reject → decision disappears from pending queue
- [ ] After approve, metrics visibly change (agents move) on next tick

---

### TASK W2-4: Cost Accumulator + cost:update Broadcast
- **Status**: `TODO`
- **File**: `backend/app/agents/orchestrator.py`
- **Priority**: 🟡 MEDIUM — makes the cost ticker tick (visually impressive)
- **Depends on**: W2-3

**What to build:**

Track cost savings whenever an agent action executes:

```python
# Add to AgentOrchestrator.__init__:
self._total_saved = 0.0
self._prevented_abandoned = 0
self._actions_today = 0

# Add method:
async def _record_action_cost(self, action_type: str):
    savings_map = {
        "move_agents": 50.0,
        "escalate": -30.0,      # costs money
        "preemptive_reinforce": 80.0,
    }
    prefix = action_type.split(":")[0]
    amount = savings_map.get(prefix, 20.0)
    self._total_saved += amount
    self._actions_today += 1
    self._prevented_abandoned += 12  # estimated calls saved per action
    await manager.broadcast("cost:update", {
        "totalSaved": round(self._total_saved, 2),
        "totalPreventedAbandoned": self._prevented_abandoned,
        "actionsToday": self._actions_today,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    })
```

Call `_record_action_cost(action_str)` inside `execute_decision()` after successful execution.

**Acceptance criteria:**
- [ ] After approving an action, `cost:update` WS event fires
- [ ] CostImpactTicker in UI shows incrementing dollar amount
- [ ] Values accumulate across the demo session (don't reset unless simulation restarted)

---

### TASK W2-5: Redis State Cache
- **Status**: `TODO`
- **File**: `backend/app/services/redis_client.py`
- **Priority**: 🟢 LOW-MEDIUM (nice-to-have, not demo-critical)
- **Depends on**: Nothing (parallel track)

**What to build:**

Add `push_json()` and `get_list()` helpers with graceful fallback when Redis is unavailable:

```python
import json
import redis.asyncio as aioredis
from app.config import settings

class RedisClient:
    def __init__(self):
        self._client = None
        self._available = False

    async def connect(self):
        try:
            self._client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await self._client.ping()
            self._available = True
            print("[redis] Connected")
        except Exception as e:
            print(f"[redis] Not available: {e}. Using in-memory fallback.")
            self._available = False

    async def push_json(self, key: str, value: dict, maxlen: int = 200):
        if not self._available:
            return
        await self._client.lpush(key, json.dumps(value))
        await self._client.ltrim(key, 0, maxlen - 1)

    async def get_list(self, key: str) -> list[dict]:
        if not self._available:
            return []
        items = await self._client.lrange(key, 0, -1)
        return [json.loads(i) for i in items]

redis_client = RedisClient()
```

Connect in `main.py` lifespan (don't block startup if Redis fails):
```python
await redis_client.connect()  # non-blocking, handles failure gracefully
```

**Acceptance criteria:**
- [ ] If Redis running: decisions/alerts are persisted in Redis
- [ ] If Redis NOT running: app starts normally, uses in-memory lists
- [ ] No error on startup if Redis is absent

---

### TASK W2-6: Frontend WebSocketProvider
- **Status**: `TODO`
- **File**: `frontend/src/components/WebSocketProvider.tsx` (NEW)
- **Priority**: 🔴 HIGH — frontend doesn't auto-update without this
- **Depends on**: W1-1 (backend must be sending events)

**What to build:**

Check `frontend/src/hooks/useWebSocket.ts` first — it may already have WS event routing logic. If it does, the main missing piece is just wrapping App in `<WebSocketProvider>`.

Create `WebSocketProvider.tsx`:
```tsx
import { useEffect } from "react";
import { useDashboardStore } from "../stores/dashboardStore";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const store = useDashboardStore();

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket("ws://localhost:8000/ws/dashboard");

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.event) {
          case "queue:update":
            store.updateQueue(msg.data);
            break;
          case "alert:new":
            store.addAlert(msg.data);
            break;
          case "alert:resolved":
            store.resolveAlert(msg.data.id);
            break;
          case "agent:reasoning":
            store.addDecision(msg.data);
            break;
          case "agent:negotiation":
            store.addNegotiation(msg.data);
            break;
          case "cost:update":
            store.updateCost(msg.data);
            break;
        }
      };

      ws.onclose = () => setTimeout(connect, 3000); // reconnect
      return ws;
    };

    const ws = connect();
    return () => ws.close();
  }, []);

  return <>{children}</>;
}
```

Wrap in `frontend/src/App.tsx` or `main.tsx`:
```tsx
<WebSocketProvider>
  <RouterProvider router={router} />
</WebSocketProvider>
```

**Acceptance criteria:**
- [ ] Opening localhost:5173 shows live-updating queue data within 2s of simulation start
- [ ] New agent decisions appear in AIDecisionFeed in real-time
- [ ] WebSocket reconnects automatically if backend restarts

---

## Sprint 3 — Week 3: Intelligence Layer

---

### TASK W3-1: MockBedrockLLM + BedrockService
- **Status**: `TODO`
- **File**: `backend/app/services/bedrock.py` (NEW FILE)
- **Priority**: 🔴 HIGH — chat depends on this
- **Depends on**: Nothing

**What to build:**

A Bedrock service with a mock fallback that handles the top 10 demo queries:

Mock queries to handle (pattern match on prompt.lower()):
- `"what just happened"` → explain the incident
- `"why did"` → explain cascade origin
- `"what if"` → predictive scenario
- `"cost"` → cost savings summary
- `"agents"` → agent count and status
- `"recommend"` → action recommendations
- `"spike"` → explain the spike
- `"queue"` → queue-specific info
- `"alert"` → alert summary
- default → general status summary

Real Bedrock call uses `boto3.client("bedrock-runtime")` and the `anthropic.claude-3-5-sonnet-20241022-v2:0` model ID (from `settings.bedrock_model_id`).

See [ARCHITECTURE.md Bedrock Pattern](./ARCHITECTURE.md#bedrock-mock-pattern) for full implementation.

**Acceptance criteria:**
- [ ] `bedrock_service.invoke("what just happened")` returns a meaningful response
- [ ] Works without AWS credentials (MockBedrockLLM handles it)
- [ ] When AWS creds available, automatically uses real Bedrock

---

### TASK W3-2: Analytics Agent + Chat Routes
- **Status**: `TODO`
- **File**: `backend/app/agents/analytics.py`, `backend/app/api/routes/chat.py`
- **Priority**: 🔴 HIGH — the demo ends with a chat question
- **Depends on**: W3-1

**What to build:**

`analytics.py` — builds context from system state + calls bedrock:
```python
class AnalyticsAgent:
    async def query(self, message: str, context: dict = {}) -> dict:
        prompt = build_prompt(message, context)
        return await bedrock_service.invoke(prompt)
```

`routes/chat.py` — wire to analytics agent:
```python
@router.post("/chat")
async def chat(request_body: ChatRequest, request: Request):
    context = {
        "recent_alerts": request.app.state.recent_alerts[:5],
        "recent_decisions": request.app.state.recent_decisions[:5],
    }
    result = await orchestrator.handle_chat(request_body.message)
    return {"message": result["message"], "reasoning": result.get("reasoning", ""), "timestamp": now_iso()}
```

Wire `orchestrator.handle_chat()` to call `analytics_agent.query()`.

**Acceptance criteria:**
- [ ] Chat page can send a message and receive a response
- [ ] "What just happened?" returns a coherent multi-sentence summary
- [ ] Response includes `reasoning` field for display

---

### TASK W3-3: AI Governance Overlay (Confidence + Approval Gates)
- **Status**: `TODO`
- **File**: `backend/app/models/agent.py`, `backend/app/agents/orchestrator.py`
- **Priority**: 🟡 MEDIUM-HIGH
- **Depends on**: W1-6

**What to build:**

Add governance fields to `AgentDecision`:
```python
class AgentDecision(CamelModel):
    confidence: float = 1.0
    requires_approval: bool = False
    approved: bool | None = None
    auto_approve_at: str | None = None
```

Agents set confidence based on signal strength:
- `queue_pressure > 5x`: confidence=0.95
- `queue_pressure 2-5x`: confidence=0.75
- Predictive (not yet critical): confidence=0.60

If `confidence < 0.7`: set `requires_approval=True`, compute `auto_approve_at = now + 30s`

In orchestrator, check for expired auto-approvals each tick (broadcast update when auto-approved).

Frontend should show approve/reject buttons on decisions with `requires_approval=True`.

See [CONTEXT.md Governance](./CONTEXT.md#ai-governance-overlay) for full spec.

**Acceptance criteria:**
- [ ] Every decision has `confidence` (0-1) and `requires_approval` fields
- [ ] Low-confidence decisions show approve/reject buttons in AIDecisionFeed
- [ ] Auto-approve fires after 30s if no human response
- [ ] Confidence shown as colored bar on decision card

---

### TASK W3-4: Scripted 3-Minute Demo Scenario
- **Status**: `TODO`
- **File**: `backend/app/services/simulation.py`
- **Priority**: 🔴 HIGH — needed for the actual buildathon demo
- **Depends on**: W1-2, W1-3

**What to build:**

A `"sentinelai_demo"` scenario that auto-fires a scripted sequence:

```python
DEMO_SCRIPT = [
    # tick 0-14: normal operations (~30s)
    {"tick": 15, "event": "spike_queue",   "params": {"queue_id": "q-support", "multiplier": 4.0}},
    {"tick": 15, "event": "kill_agents",   "params": {"queue_id": "q-general", "agents_count": 4}},
    # tick 15-36: storm (~42s) — agents react, negotiation occurs
    # tick 37: restore
    {"tick": 37, "event": "restore_agents","params": {"queue_id": "q-general"}},
    # tick 52: clear spike
    {"tick": 52, "event": "clear_spike",   "params": {"queue_id": "q-support"}},
    # tick 60+: stabilization
]
```

In `generate_metrics()`, when `self.scenario == "sentinelai_demo"`:
- Check `self.tick` against `DEMO_SCRIPT`
- Auto-apply the scripted chaos events
- Clear the spike events at the right tick

Also add `"sentinelai_demo"` to the `SCENARIOS` list in `routes/simulation.py`.

**Acceptance criteria:**
- [ ] Starting the "sentinelai_demo" scenario auto-drives the 3-minute demo without manual clicks
- [ ] At tick 15, q-support spikes and q-general loses agents
- [ ] At tick 52, metrics begin to stabilize
- [ ] Demo can be restarted cleanly (stop + start again)

---

## Sprint 4 — Week 4: Polish & Demo Prep

### TASK W4-1: Demo Mode "One Click Start" Button
- **Status**: `TODO`
- **Priority**: 🔴 HIGH for demo
- **File**: `frontend/src/pages/SimulationPage.tsx` or `Header.tsx`

Add a large, unmissable "▶ Start Demo" button that calls `POST /api/simulation/start {"scenario_id":"sentinelai_demo"}`. Should be visible on every page during the demo.

---

### TASK W4-2: Empty State UX
- **Status**: `TODO`
- **Priority**: 🟡 MEDIUM
- **File**: Multiple frontend components

When simulation is not running:
- MetricsSidebar: "Start a simulation to see live metrics"
- AIDecisionFeed: "Agents are standing by. Start simulation to activate."
- AlertPanel: "No active alerts — system healthy"
- Cost ticker: "–" (dash) instead of $0

---

### TASK W4-3: Animation Polish
- **Status**: `TODO`
- **Priority**: 🟢 LOW-MEDIUM
- **File**: Frontend CSS/components

- CostImpactTicker: pulse/glow animation when value updates
- AIDecisionFeed: slide-in from right for new decisions
- AlertPanel: red border flash on new CRITICAL alert
- Phase badges: smooth transition between Observed → Analyzed → Decided → Acted

---

### TASK W4-4: WebSocket Reconnect Polish
- **Status**: `TODO`
- **Priority**: 🟢 LOW
- **File**: `frontend/src/services/websocket.ts`

Implement exponential backoff: 1s → 2s → 4s → 8s → cap at 30s. Show "Reconnecting..." indicator in Header when disconnected.

---

### TASK W4-5: Demo Rehearsal Checklist
- **Status**: `TODO`
- **Priority**: 🔴 HIGH (Week 4 final)

Run 3 full timed rehearsals with the team. Each run:
1. Click "Start Demo" → watch metrics
2. Chaos injects at 30s → watch agents react
3. Negotiation at 75s → approve action
4. Metrics stabilize at 105s
5. Chat question at 150s → see summary
6. Total: ~3 min

Record backup video in case of live demo issues.

---

## Milestone Tracker

| Milestone | Target | Status |
|-----------|--------|--------|
| Live metrics in UI | End of W1 | ⬜ |
| Agent decisions visible | End of W1 | ⬜ |
| Chaos → alerts → negotiation | End of W2 | ⬜ |
| Approve/reject working | End of W2 | ⬜ |
| Chat answers questions | End of W3 | ⬜ |
| Governance overlay visible | End of W3 | ⬜ |
| 3-min demo scripted | End of W3 | ⬜ |
| Demo rehearsed 3x | End of W4 | ⬜ |
| Backup video recorded | End of W4 | ⬜ |

→ Update `[STATUS.md](./STATUS.md)` when milestones are hit.
