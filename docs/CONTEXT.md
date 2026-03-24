# SentinelAI — Project Context & Product Vision
> Answers WHY. Covers the product, the company, the demo, and the key decisions.
> → See [STATUS.md](./STATUS.md) for current build state.
> → See [TASKS.md](./TASKS.md) for what to build.
> → See [ARCHITECTURE.md](./ARCHITECTURE.md) for how to build it.

---

## Company & Project

| | |
|--|--|
| **Company** | CirrusLabs — Enterprise AI Strategy & Compliance Consulting (cirruslabs.io) |
| **Project** | SentinelAI — Autonomous AI Contact Center Intelligence Platform for AWS Connect |
| **Event** | Internal buildathon — 1 month, 4-6 person team, goal: win with demo-ready product |
| **Score** | 19/20 across: wow factor, business value, technical depth, feasibility |

---

## What SentinelAI Does (The Elevator Pitch)

SentinelAI is an **autonomous AI operations layer that sits on top of AWS Connect**. It doesn't compete with Connect's native dashboards — it adds a layer of AI that watches, reasons, and acts.

**The 3 jobs it does:**
1. **Watches**: Monitors queue metrics for anomalies in real-time (statistical detection)
2. **Reasons**: 4 AI agents analyze the situation and propose actions
3. **Acts**: With human approval (or auto-approve after 30s), executes rebalancing decisions

---

## The 5 Pillars

| Pillar | What It Is | Key Feature |
|--------|-----------|-------------|
| **AI Operations Center** | Live AI decision feed, agent reasoning, cost ticker | NOT a metrics dashboard — agents are the star |
| **AI Anomaly Engine** | Statistical detection with velocity scoring | Cascade correlation (one queue affects others) |
| **Autonomous Agents** | 5 agents + multi-agent negotiation + proficiency DB | Agents disagree, negotiate, resolve — visible to user |
| **Conversational Command** | Natural language interface | "What just happened?" returns reasoned summary |
| **Simulation Engine** | Built-in demo mode with chaos injection | Primary demo path, not fallback |

---

## Architecture Decisions (Why We Built It This Way)

### Decision 1: Simulation-First
**Decision**: The simulation engine is the primary demo path. Real AWS Connect is Week 4 optional.
**Why**: De-risks the demo completely. No dependency on AWS sandbox availability. Lets us choreograph the perfect demo scenario.
**Implication**: Every backend component must work with `simulation_mode=True`. Never block startup on AWS connectivity.

### Decision 2: Frontend-First
**Decision**: Build all frontend UI before connecting to real data.
**Why**: Lets frontend and backend develop in parallel. Gives visual proof of concept early.
**Implication**: The frontend is 100% complete. It's a waiting receiver — just feed it data via WS events and REST.

### Decision 3: Simple Agent Architecture Before LangGraph
**Decision**: Implement agents as plain Python sequential calls first. Add LangGraph wrapper later (optional).
**Why**: LangGraph adds complexity without changing the demo output. We can say "LangGraph-powered" in Week 2 if needed.
**Implication**: `orchestrator.py` should work without `langgraph` installed.

### Decision 4: Mock LLM Before Real LLM
**Decision**: `MockBedrockLLM` (context-aware) handles all demo queries. Real Anthropic Claude optional.
**Why**: Can't depend on API access being available during the demo.
**Implication**: Chat works perfectly without API credentials. MockLLM builds dynamic responses from live telemetry.

### Decision 5: camelCase on the Wire
**Decision**: All WS events and REST responses use camelCase JSON.
**Why**: Frontend TypeScript uses camelCase. Converting on the frontend is messy.
**Implication**: Always serialize with `model.model_dump(by_alias=True, mode="json")`.

---

## The 3-Minute Demo Script

This is what the demo MUST achieve. All development decisions flow from this.

| Time | Act | What Happens | What Audience Sees |
|------|-----|-------------|-------------------|
| 0:00–0:30 | **The Calm** | Normal simulation running | Live metrics updating, agents "Observing", $0 cost, green status |
| 0:30–1:15 | **The Storm** | Chaos inject: spike q-support 4x + kill 4 agents in q-general | Queue depth spikes, CRITICAL alerts fire, agents light up: Observed → Analyzed → Decided |
| 1:15–1:45 | **The Negotiation** | Queue Balancer vs Escalation Handler both want to act on q-support | AgentCollaborationPanel shows competing proposals, negotiation resolves, approval prompt appears |
| 1:45–2:30 | **The Resolution** | Human approves action | Metrics stabilize, cost ticker climbs ($450→$890→$1,240), alerts auto-resolve |
| 2:30–3:00 | **The Intelligence** | Ask chat: "What just happened?" | AI summarizes: incident, agents involved, actions taken, cost saved, reasoning visible |

**The scripted scenario** (`sentinelai_demo`) auto-fires the chaos events at the right ticks so the demo runs consistently without manual timing. See [BACKLOG.md W3-4](./BACKLOG.md#task-w3-4-scripted-3-minute-demo-scenario).

---

## AI Governance Overlay

Every `AgentDecision` carries:
- `confidence: float` — 0.0–1.0, how certain the agent is
- `requires_approval: bool` — True if human must approve before executing
- `auto_approve_at: str` — ISO timestamp; auto-approves after 30s in demo mode

**Approval gate rules:**
- `confidence >= 0.9` AND routine action → auto-approve immediately
- `confidence 0.7–0.9` → show approve/reject, auto-approve after 30s
- `confidence < 0.7` → requires human approval, no auto-approve

**Why this matters for the demo**: When the agents start negotiating, the approved decision needs a human to click "Approve" — that's the dramatic moment at 1:45 in the demo script.

→ Full implementation spec in [BACKLOG.md W3-3](./BACKLOG.md#task-w3-3-ai-governance-overlay-confidence--approval-gates)

---

## Data Flow

```
SimulationEngine.generate_metrics()
    │
    ▼
Background Loop in main.py (3s tick)
    │
    ├──→ AnomalyEngine.evaluate(metric) ────→ Alert objects
    │                                              │
    ├──→ AgentOrchestrator.process_metrics()       │
    │         ├──→ QueueBalancerAgent.evaluate()   │
    │         ├──→ PredictivePreventionAgent.eval()│
    │         ├──→ EscalationHandlerAgent.eval()   │
    │         ├──→ SkillRouterAgent.eval()         │
    │         └──→ NegotiationProtocol.resolve()   │
    │               └──→ AgentDecision objects     │
    │                          │                   │
    └──→ ConnectionManager.broadcast() ←───────────┘
                   │
                   ▼
          Frontend WebSocket
                   │
                   ▼
        Zustand dashboardStore
                   │
                   ▼
          React components re-render
```

---

## Judging Criteria (What Wins Buildathons)

The project was scored 19/20 on:
1. **Wow Factor** — The negotiation protocol + reasoning chain are visually impressive. The cost ticker is satisfying to watch climb.
2. **Business Value** — Quantified in dollars (cost savings), not just metrics. Clear ROI story.
3. **Technical Depth** — 5 autonomous agents, LangGraph, multi-agent negotiation, Bedrock, WebSocket real-time
4. **Feasibility** — Simulation-first means the demo ALWAYS works. No dependency hell.

**What judges will respond to:**
- Something moving on screen (live metrics updating every 3s)
- AI "thinking" visibly (the decision feed with reasoning)
- A conflict resolving autonomously (negotiation panel)
- A number going up (cost ticker)
- Natural language interaction ("What just happened?" → smart answer)

---

## Five Simulated Queues

| Queue ID | Name | Base Load | Default Agents | Role in Demo |
|----------|------|-----------|----------------|-------------|
| `q-support` | Support | 8 contacts | 12 agents | Gets spiked in demo |
| `q-billing` | Billing | 5 contacts | 8 agents | Source for agent moves |
| `q-sales` | Sales | 3 contacts | 6 agents | Low-priority, often idle |
| `q-general` | General | 4 contacts | 7 agents | Loses agents in demo |
| `q-vip` | VIP | 2 contacts | 4 agents | Always protected (high priority) |

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Anthropic API unavailable | Medium | Context-aware MockLLM handles all demo queries |
| AWS Connect unavailable | High | simulation_mode=True is the primary path |
| WebSocket instability | Medium | Auto-reconnect + REST polling fallback |
| LangGraph too complex | Low | Plain Python sequential calls work identically |
| camelCase/snake_case bugs | High | CamelModel base class + always by_alias=True |
| Demo timing off | Medium | Scripted scenario (sentinelai_demo) auto-fires events |

---

## All Ideas Considered (Why SentinelAI Won)

| Rank | Idea | Score |
|------|------|-------|
| 1 | **SentinelAI (chosen)** | 19 |
| 2 | API MCP Server Automation | 17 |
| 3 | Reducing P1 Cloud Incidents | 16 |
| 4 | Conversational Command | 16 |

SentinelAI combined ideas #9 (queue monitoring), #11 (auto assignment), and #14 (conversational command) into one platform with a coherent story.
