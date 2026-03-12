# SentinelAI — Project Context

---

## MODEL HANDOFF SYSTEM
> **Any AI model picking up this project: read `docs/INDEX.md` first. Everything is there.**

All living documentation lives in the **`docs/`** folder. These docs are interlinked and kept up to date as the build progresses.

| Doc | Purpose |
|-----|---------|
| **[`docs/INDEX.md`](./docs/INDEX.md)** | **Start here** — master navigation, quick status, what to build next |
| [`docs/STATUS.md`](./docs/STATUS.md) | Per-file build status (what's done, what's stub, what % complete) |
| [`docs/TASKS.md`](./docs/TASKS.md) | Current sprint tasks (Week 1) with full implementation specs |
| [`docs/BACKLOG.md`](./docs/BACKLOG.md) | Future sprint tasks (Weeks 2–4) |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Code patterns, serialization, agent template, WS events |
| [`docs/CONTEXT.md`](./docs/CONTEXT.md) | Product vision, demo script, architectural decisions |

### Current Build State (2026-03-02)
- Frontend: **100% complete**
- Backend models/config/anomaly: **100% complete**
- **Background simulation loop: 0% — first task → [`docs/TASKS.md` W1-1](./docs/TASKS.md)**
- All agents (queue_balancer, predictive_prevention, etc.): **stubs only**
- API routes (queues, agents, alerts, chat): **stubs only**

### Quick Start
```bash
cd C:\Users\prith\Downloads\Buildathon
npm run dev          # starts frontend (:5173) + backend (:8000)
```

---

## Company
**CirrusLabs** (https://www.cirruslabs.io/) — Enterprise AI Strategy & Compliance Consulting

## Project
**SentinelAI** — Autonomous AI Contact Center Intelligence Platform for AWS Connect

## Buildathon Details
- **Duration**: 1 month
- **Team size**: 4-6 people (full-stack expertise across AWS, AI/ML, frontend, backend, DevOps)
- **Goal**: Win the buildathon by delivering a polished, demo-ready product

## Idea Selection
Combined three ideas from the internal list of 14:
- **#9**: AWS Connect Queues Monitoring using Agents
- **#11**: AWS Connect Queues Auto Assignment using AI Agents
- **#14**: Conversational Command (conversational interface element)

Scored highest (19/20) across all four criteria: wow factor, business value, technical depth, feasibility.

## Key Documents
| Document | Path | Description |
|----------|------|-------------|
| PRD | `PRD.md` | Full product requirements document |

## Architecture Summary
- **Frontend**: React + TypeScript + TailwindCSS + Recharts/D3 + WebSocket
- **Backend**: Python FastAPI + Redis + DynamoDB
- **AI**: Amazon Bedrock (Claude) + LangGraph (4 autonomous agents + negotiation protocol)
- **AWS**: Connect APIs, Lambda, EventBridge, Kinesis
- **Infra**: AWS CDK (Python)

**Positioning**: Autonomous AI operations layer ON TOP of AWS Connect — not competing with native dashboards/forecasting

**Architecture Principle — Simulation-First**: Simulation is the *primary* demo path, not a fallback. All data pipelines, agent logic, and UI are designed to run flawlessly in simulation mode. Real AWS Connect integration is a Week 4 bonus, not a requirement.

## Five Pillars
1. **AI Operations Center** — Live AI decision feed, agent reasoning visibility, cost impact ticker (NOT a metrics dashboard — Connect already does that)
2. **AI Anomaly Engine** — Statistical anomaly detection with predictive prevention and cascade correlation
3. **Autonomous Agents** — Queue Balancer, Predictive Prevention Agent, Escalation Handler, Analytics Agent + Multi-Agent Negotiation Protocol
4. **Conversational Command** — Natural language query interface (query-focused, lighter policy creation) with what-if simulation
5. **Simulation Engine** — Built-in demo mode with choreographed scenarios + interactive chaos mode

## Cross-Cutting Concern: AI Governance Overlay
- Every `AgentDecision` carries a `confidence` score (0.0–1.0) and a `requires_approval` flag
- Approval gates: confidence < 0.7 or high-impact actions require human approval before execution
- Auto-approve timeout: 30s in demo mode (keeps the demo moving)
- Governance summary: decisions made, auto vs human approved, avg confidence, audit export
- Confidence scores visualized as color-coded bars on frontend decision cards

## Data Flow
```
SimulationEngine.generate_metrics()
    |
    v
Background Loop (main.py lifespan, 2s tick)
    |
    +---> AnomalyEngine.evaluate(metrics) --> Alerts
    |
    +---> AgentOrchestrator.process_metrics()
    |         +---> QueueBalancerAgent.evaluate()
    |         +---> PredictivePreventionAgent.evaluate()
    |         +---> EscalationHandlerAgent.evaluate()
    |         +---> NegotiationProtocol.resolve() [if conflicts]
    |         --> AgentDecision objects
    |
    +---> ConnectionManager.broadcast() via WebSocket
              |
              v
         Frontend Zustand store --> React components re-render
```

## Current Status
- [x] Idea selection and analysis
- [x] PRD drafted
- [x] Project scaffolding
- [ ] Week 1: Foundation (simulation loop, WebSocket pipeline, Queue Balancer, Predictive Prevention, E2E integration)
- [ ] Week 2: Core Features (Escalation Handler, Negotiation Protocol, Redis cache, frontend live wiring, approve/reject)
- [ ] Week 3: Intelligence Layer (Bedrock/mock, Analytics Agent, chat, NL policies, governance overlay, scripted scenarios)
- [ ] Week 4: Polish & Demo Prep (bug fixes, animations, 3-min demo scenario, rehearsals, backup video)

## 3-Minute Demo Script
| Time | Act | What Happens | What Audience Sees |
|------|-----|-------------|-------------------|
| 0:00–0:30 | **The Calm** | Normal simulation running | Live metrics, agents "Observing", cost at $0, green alerts |
| 0:30–1:15 | **The Storm** | Inject spike on Support + kill agents on General | Queue depth 4x, CRITICAL alerts, agents light up with Observed → Analyzed → Decided phases |
| 1:15–1:45 | **The Negotiation** | Queue Balancer vs Escalation Handler conflict | Agent Collaboration Panel shows competing proposals, negotiation resolves, approval prompt appears |
| 1:45–2:30 | **The Resolution** | Approve action, agents execute | Metrics stabilize, cost ticker climbs ($450→$890→$1,240), alerts resolve, cascade risk downgraded |
| 2:30–3:00 | **The Intelligence** | Ask chat: "What just happened?" | AI summarizes incident, actions taken, cost saved, reasoning chain visible |

## Implementation Plan

### Week 1: Foundation (Day-Level)

**Day 1 — Simulation Loop + Pipeline**
| Task | File |
|------|------|
| Background simulation loop (asyncio task in lifespan, 2s tick) | `backend/app/main.py` |
| Wire simulation start/stop/chaos routes to actual engine | `backend/app/api/routes/simulation.py` |
| Enhance SimulationEngine with chaos event application + scenario modifiers | `backend/app/services/simulation.py` |

**Day 2 — WebSocket + Frontend Connection**
| Task | File |
|------|------|
| Broadcast `queue:update` and `alert:new` from simulation loop | `backend/app/api/websocket.py` |
| Wire queue routes to return latest metrics snapshot | `backend/app/api/routes/queues.py` |
| Create WebSocketProvider to dispatch WS events to Zustand | `frontend/src/components/WebSocketProvider.tsx` (new) |
| Wire Zustand store to consume all WS event types | `frontend/src/stores/dashboardStore.ts` |

**Day 3 — Queue Balancer Agent**
| Task | File |
|------|------|
| Implement `evaluate()`: pressure scoring, imbalance detection, min staffing | `backend/app/agents/queue_balancer.py` |
| Wire into orchestrator, broadcast decisions as `agent:reasoning` | `backend/app/agents/orchestrator.py` |
| Implement `execute()`: modify simulation state (adjust queue agents) | `backend/app/agents/queue_balancer.py` |
| Add `adjust_queue(queue_id, agents_delta)` to SimulationEngine | `backend/app/services/simulation.py` |

**Day 4 — LangGraph Orchestrator + Predictive Prevention Agent**
| Task | File |
|------|------|
| Build LangGraph StateGraph: queue_balancer → predictive_prevention → check_conflicts → negotiate/execute | `backend/app/agents/orchestrator.py` |
| Implement PredictivePreventionAgent: velocity tracking, cascade risk detection | `backend/app/agents/predictive_prevention.py` |
| Feed anomaly signals from AnomalyEngine into orchestrator | `backend/app/main.py` |

**Day 5 — End-to-End Integration**
| Task | File |
|------|------|
| Implement alert routes (list, acknowledge) | `backend/app/api/routes/alerts.py` |
| Implement agent decision routes (list decisions, negotiations) | `backend/app/api/routes/agents.py` |
| Full E2E smoke test | All |

### Week 2: Core Features (3 Parallel Tracks)

**Track A: Remaining Agents**
- Days 6–7: EscalationHandlerAgent (`backend/app/agents/escalation_handler.py`)
- Days 7–8: Negotiation Protocol enhancement (`backend/app/agents/negotiation.py`)
- Days 9–10: Full orchestrator wiring, cost accumulation, `cost:update` broadcast (`backend/app/agents/orchestrator.py`)

**Track B: Backend Services**
- Day 6: ConnectService simulation fallback (`backend/app/services/connect.py`)
- Day 7: Redis state cache (`backend/app/services/redis_client.py`)
- Days 8–9: WebSocket client→server handlers (action:approve, action:reject, chat:message, chaos:inject) (`backend/app/api/websocket.py`)
- Day 10: Optional DynamoDB persistence for audit trail

**Track C: Frontend Integration**
- Days 6–7: Operations Center live wiring (CostImpactTicker, AnomalyTimeline with Recharts)
- Days 7–8: Simulation Page live wiring (event log, chaos visual feedback)
- Days 8–9: Approve/Reject buttons on decision cards (human-in-the-loop governance)
- Day 10: Alerts Page full integration (acknowledge, resolution display)

### Week 3: Intelligence Layer (3 Parallel Tracks)

**Track D: Bedrock + Chat**
- Days 11–12: Bedrock service with MockBedrockLLM fallback (`backend/app/services/bedrock.py` — new)
- Days 12–13: AnalyticsAgent with Bedrock (`backend/app/agents/analytics.py`)
- Days 13–14: Chat route full implementation (`backend/app/api/routes/chat.py`)
- Days 14–15: Lightweight NL policy engine (`backend/app/api/routes/chat.py`)

**Track E: AI Governance Overlay**
- Days 11–12: Add `confidence` and `requires_approval` fields to AgentDecision (`backend/app/models/agent.py`)
- Days 12–13: Approval gates (confidence < 0.7 or high-impact → require human approval, auto-approve after 30s timeout)
- Days 13–14: Confidence score visualization on frontend decision cards
- Day 15: Governance summary card

**Track F: Simulation Enhancement**
- Days 11–12: Scripted scenario timelines (`backend/app/services/simulation.py`)
- Days 13–14: Simulation event log component (`frontend/src/pages/SimulationPage.tsx`)
- Day 15: Demo scenario tuning

### Week 4: Polish & Demo Prep
- Days 16–17: Bug fixes, edge cases (WS reconnect, Bedrock timeout, empty states, memory caps)
- Days 18–19: Demo polish (animations, "Demo Mode" button, cost ticker pulse)
- Day 19: Create "SentinelAI Demo" scenario — the scripted 3-minute showcase
- Day 20: Full team demo rehearsal (3 runs, timed, talking points)
- Day 21: Record backup video, write README, final deployment prep

## Critical Files (Priority Order)
1. `backend/app/main.py` — Background simulation loop (system heartbeat)
2. `backend/app/agents/orchestrator.py` — LangGraph state machine
3. `backend/app/agents/queue_balancer.py` — First agent, template for all others
4. `backend/app/api/websocket.py` — Bidirectional event bridge
5. `frontend/src/stores/dashboardStore.ts` — Frontend state hub
6. `backend/app/agents/predictive_prevention.py` — Cascade detection (high wow-factor)
7. `backend/app/agents/escalation_handler.py` — Critical alert resolution
8. `backend/app/agents/negotiation.py` — Multi-agent negotiation (key differentiator)
9. `backend/app/services/bedrock.py` (new) — LLM integration with mock fallback
10. `backend/app/agents/analytics.py` — NL query agent for chat
11. `backend/app/models/agent.py` — Governance fields (confidence, requires_approval)

## Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Bedrock access delayed | Build MockBedrockLLM first, real Bedrock second. Mock handles top 10 demo queries. |
| Connect instance unavailable | Already mitigated — simulation_mode=True is default. Real Connect is Week 4 bonus. |
| WebSocket reliability | Auto-reconnect exists. Add REST polling fallback. Server-side 30s event buffer. |
| LangGraph complexity | Keep graph simple (linear + 1 conditional). Fallback: plain Python calling agents sequentially. |
| camelCase/snake_case mismatch | Use Pydantic `alias_generator=to_camel` + `model_dump(by_alias=True)`. |

## Open Questions
- Cloud/AI constraints (AWS-only vs open)?
- Existing AWS Connect instance or sandbox?
- Budget constraints?
- Exact judging criteria?
- Existing code/templates to reuse?

## All 14 Buildathon Ideas (Ranked)
| Rank | Idea | Score |
|------|------|-------|
| 1 | **SentinelAI (chosen)** | 19 |
| 2 | API MCP Server Automation | 17 |
| 3 | Reducing P1 Cloud Incidents | 16 |
| 4 | Conversational Command | 16 |
| 5 | Unified Infra/DevOps/Network AI | 16 |
| 6 | AI Employee Support Chatbot | 14 |
| 7 | AI Internal Knowledge Hub | 14 |
| 8 | GenAI Governance & Security | 13 |
| 9 | APDIP | 13 |
| 10 | Contract Process Automation | 12 |
| 11 | AWS Connect Migration Toolkit | 12 |
| 12 | Security & Compliance (GRC) | 12 |
| 13 | Live Utilization/Bench Cost | 11 |
