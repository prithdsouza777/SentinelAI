# PRD: SentinelAI — Autonomous AI Operations Layer for AWS Connect

**Version**: 3.0
**Date**: 2026-02-25
**Author**: CirrusLabs Buildathon Team
**Status**: Active

---

## 1. Executive Summary

SentinelAI is an autonomous AI operations layer that sits on top of AWS Connect. While Connect provides metrics, dashboards, and forecasting tools, SentinelAI adds the intelligence that *acts* on that data — autonomous agents that detect, predict, decide, and execute in real time, with full reasoning transparency.

**The pitch**: *"Connect gives you the data. SentinelAI gives you the AI that acts on it."*

SentinelAI combines autonomous AI agents, predictive anomaly prevention, a Conversational Command interface with natural language query processing and lightweight policy creation, an AI Governance Overlay with confidence scoring and approval gates, and an AI Operations Center that makes every decision visible and explainable — all built as an operations layer on top of native AWS Connect.

**Origin**: CirrusLabs 1-month company buildathon. Combines ideas #9 (AWS Connect Queue Monitoring), #11 (AWS Connect Auto Assignment), and elements of #14 (Conversational Command).

**Positioning**: Autonomous AI operations layer ON TOP of AWS Connect — not competing with native dashboards or forecasting.

**Architecture Principle — Simulation-First**: Simulation is the *primary* demo path, not a fallback. All data pipelines, agent logic, and UI are designed to run flawlessly in simulation mode. Real AWS Connect integration is a Week 4 bonus, not a requirement.

---

## 2. Problem Statement

AWS Connect provides real-time metrics dashboards, ML-based forecasting, capacity planning, scheduling, and rules-based alerting natively. But critical gaps remain:

- **Nobody is watching 24/7**: Connect shows metrics after the fact — but there is no autonomous intelligence continuously monitoring and acting on them in real time.
- **No real-time anomaly response**: Connect forecasts staffing on a schedule, but it can't detect and preemptively respond to anomalies forming *right now* — like a cascade failure building across queues.
- **Manual queue rebalancing**: Moving agents between queues requires manual UI clicks through Connect admin screens. There is no autonomous agent reassignment based on live conditions.
- **Fragmented supervisor experience**: Supervisors must navigate multiple Connect admin screens to understand and act on contact center state. There is no unified conversational interface.
- **No AI reasoning transparency**: When decisions are made (manually or by rules), there is no way to see the reasoning chain — *why* a particular action was the right call, what alternatives were considered, and what the cost/impact trade-offs are.

---

## 3. Product Vision

> An autonomous AI operations layer where intelligent agents continuously monitor, predict, decide, and act on an AWS Connect contact center — with every decision visible and explainable through natural language.

**The 3-Minute Demo Script:**

| Time | Act | What Happens | What Audience Sees |
|------|-----|-------------|-------------------|
| 0:00–0:30 | **The Calm** | Normal simulation running | Live metrics, agents "Observing", cost at $0, green alerts |
| 0:30–1:15 | **The Storm** | Inject spike on Support + kill agents on General | Queue depth 4x, CRITICAL alerts, agents light up with Observed → Analyzed → Decided phases |
| 1:15–1:45 | **The Negotiation** | Queue Balancer vs Escalation Handler conflict | Agent Collaboration Panel shows competing proposals, negotiation resolves, approval prompt appears |
| 1:45–2:30 | **The Resolution** | Approve action, agents execute | Metrics stabilize, cost ticker climbs ($450→$890→$1,240), alerts resolve, cascade risk downgraded |
| 2:30–3:00 | **The Intelligence** | Ask chat: "What just happened?" | AI summarizes incident, actions taken, cost saved, reasoning chain visible |

---

## 4. Target Users

| User | Role | Primary Need |
|------|------|-------------|
| **Contact Center Supervisor** | Oversees day-to-day queue operations | Real-time AI-driven actions, anomaly alerts, conversational control |
| **Workforce Manager** | Plans staffing and schedules | Predictive prevention insights, cost impact analysis |
| **Operations Director** | Strategic oversight of contact center performance | Trend analytics, executive summaries, SLA tracking, ROI visibility |
| **IT Administrator** | Manages the AWS Connect instance | System health, integration status, configuration |

---

## 5. Product Pillars

### 5.1 AI Operations Center
**Description**: The primary dashboard — a live view of AI agent activity, reasoning chains, cost impact, and autonomous actions. This is NOT a metrics dashboard (Connect already provides that). This is a window into the AI brain.

**Requirements**:

- **AI Decision Feed** (centerpiece): Live stream of agent reasoning chains — "Observed → Analyzed → Decided → Acted" with timestamps. Every autonomous action is visible with full reasoning.
- **Agent Collaboration Panel**: When multiple AI agents interact (e.g., Queue Balancer wants agents but Predictive Prevention warns of an upcoming spike elsewhere), show the negotiation and resolution.
- **Cost Impact Ticker**: Running total of estimated savings — every AI action shows "prevented X abandoned calls ($Y saved) at cost of Z ($W). Net: $V."
- **Anomaly Timeline**: Visual timeline of detected anomalies, predictions, and AI responses — shows the system's history of decisions.
- **Metrics Context Sidebar**: Queue metrics still present but as compact supporting context cards, not the headline. Sourced from Connect APIs.
- **Alert Panel**: Active and historical alerts with severity indicators and AI-recommended actions.
- Auto-refresh via WebSocket (sub-second latency)
- Responsive layout — works on large monitor displays and laptops

**Metrics (context sidebar)**:
| Metric | Source | Update Frequency |
|--------|--------|-----------------|
| Contacts in Queue | GetCurrentMetricData | Real-time (5s) |
| Oldest Contact Age | GetCurrentMetricData | Real-time (5s) |
| Agents Online | GetCurrentMetricData | Real-time (5s) |
| Agents Available | GetCurrentMetricData | Real-time (5s) |
| Average Wait Time | GetMetricDataV2 | Every 60s |
| Average Handle Time | GetMetricDataV2 | Every 60s |
| Abandonment Rate | GetMetricDataV2 | Every 60s |
| Service Level (% answered in X sec) | GetMetricDataV2 | Every 60s |
| Contacts Handled | GetMetricDataV2 | Every 60s |

### 5.2 AI Anomaly Engine
**Description**: Detects unusual patterns in queue metrics using statistical analysis, triggers alerts, and feeds signals to autonomous agents. Goes beyond Connect's static threshold rules with rolling-baseline detection, anomaly velocity scoring, and cross-queue cascade correlation.

**Requirements**:
- Monitor all queue metrics for deviations from baseline (rolling average + standard deviation)
- Detect: sudden volume spikes, unusual abandon rates, wait time breaches, agent dropout patterns
- **Predictive Anomaly Patterns**: Detect early-warning signatures of cascade failures (e.g., if queue A spikes and historically queue B follows 5-8 minutes later, flag it now)
- **Anomaly Velocity Scoring**: Not just "is this metric above threshold" but "how fast is it moving" — a queue going from 5 to 15 in 30 seconds is more urgent than 5 to 15 over 10 minutes
- **Cross-Queue Correlation**: Detect when multiple queues show related anomaly patterns simultaneously (cascade detection)
- Generate alerts with severity levels (Info, Warning, Critical)
- Display alerts as toast notifications on dashboard + alert panel
- Each alert includes: what happened, which queue, severity, recommended action, anomaly velocity
- Alert history log with timestamps

**Detection Rules (configurable)**:
| Rule | Default Threshold | Severity |
|------|------------------|----------|
| Queue depth > 2x rolling average | 2x baseline | Warning |
| Queue depth > 3x rolling average | 3x baseline | Critical |
| Wait time > SLA target | Configurable per queue | Warning |
| Abandon rate > 15% | 15% | Warning |
| Abandon rate > 30% | 30% | Critical |
| Agent availability drops > 25% in 5min | 25% drop | Critical |
| Anomaly velocity > threshold | Configurable | Warning/Critical |
| Cross-queue cascade pattern detected | Pattern match | Critical |

### 5.3 Autonomous AI Agents
**Description**: Four specialized AI agents that observe, reason, and act on the contact center — with a multi-agent negotiation protocol for resolving conflicts.

#### Agent 1: Queue Balancer
- **Trigger**: Queue imbalance detected (one queue overloaded, another idle)
- **Action**: Reassign agents between queues via Connect routing profile APIs
- **Constraint**: Never leave any queue below minimum staffing threshold
- **Output**: Action log entry with reasoning ("Moved 2 agents from Sales to Support because Support queue depth is 3x normal while Sales is at 0.5x")

#### Agent 2: Predictive Prevention Agent
- **Trigger**: Continuous monitoring + anomaly velocity thresholds from Anomaly Engine
- **Action**: Correlate current anomaly patterns with historical incident data to predict problems 5-15 minutes before they fully manifest. Preemptively rebalance or alert before the crisis hits.
- **Key difference from Connect forecasting**: Connect predicts "you'll need X agents at 3 PM on Tuesday based on historical patterns." This agent says "I see the early signature of a cascade failure forming RIGHT NOW — queue A spike + agent dropout rate increasing + handle times climbing = billing queue will be overwhelmed in 8 minutes. Acting preemptively."
- **Input**: Real-time anomaly signals, historical incident patterns (DynamoDB), current state (Redis)
- **Output**: Prediction with confidence score, reasoning chain, and preemptive action taken

#### Agent 3: Escalation Handler
- **Trigger**: Critical alert from Anomaly Engine
- **Action**: Escalate via configured channels (dashboard alert, webhook, SNS notification)
- **Enhancement**: When escalating, include cost impact estimate and AI-recommended resolution options with trade-offs. Not just "this is critical" but "this is critical, here are 3 options ranked by impact, and here's what each costs."
- **Constraint**: Must log all decisions with full reasoning for audit
- **Output**: Escalation record with timeline, actions taken, resolution options with cost/impact analysis, and resolution status

#### Agent 4: Analytics Agent
- **Trigger**: Natural language query from supervisor
- **Action**: Query historical and real-time data, generate insights
- **Capabilities**: Answer questions like "What was our busiest hour today?", "Compare this week to last week", "Which queue has the worst SLA?"
- **Output**: Natural language response with supporting data/charts

**Agent Orchestration**: LangGraph state machine coordinating all four agents. Each agent has:
- Defined tools (Connect APIs, Redis queries, DynamoDB queries)
- Observation → Reasoning → Action loop
- Human-in-the-loop override capability (supervisor can approve/reject actions)

**Multi-Agent Negotiation Protocol**:
- **Agent Negotiation**: When agents have conflicting recommendations (e.g., Queue Balancer wants to pull from Sales, Predictive Prevention warns Sales will spike), they negotiate. The resolution is logged and displayed on the Agent Collaboration Panel.
- **Conflict Resolution**: Weighted priority system based on severity, confidence, and time horizon. Higher severity + higher confidence + shorter time horizon wins. All negotiations visible on the dashboard.

### 5.4 Conversational Command Interface
**Description**: Natural language chat panel for supervisors to query the system and create lightweight policy rules. Query-focused with lighter policy creation (not a full NL programming engine).

**Requirements**:
- Chat panel embedded in dashboard sidebar
- Supports queries: "What's the status of the billing queue?", "Why is wait time high?", "What just happened?"
- Supports commands: "Move 2 agents from sales to support", "Set support queue to high priority"
- **Lightweight NL Policy Rules**: Supervisors can create simple persistent rules via conversation — "If support queue exceeds 20 contacts, pull from sales first." Stored in memory, enforced per tick. Focus is on query quality over complex policy creation.
- **What-If Queries**: "What would happen if 3 agents go offline right now?" — system runs a micro-simulation and shows projected impact.
- Shows AI reasoning steps (thinking → action → result)
- Command confirmation for destructive/significant actions
- Conversation history within session

**Example Interactions**:
```
Supervisor: What's happening in the support queue?
SentinelAI: The support queue has 23 contacts waiting (3x normal). Average wait
           time is 4m 32s, which exceeds your 2-minute SLA target. I've already
           moved 2 agents from Sales (which is idle) to help. Wait time is
           trending down.

Supervisor: Set a rule — if billing queue goes above 15, pull from sales first,
            then general, but never drop general below 3 agents.
SentinelAI: Rule created. I'll prioritize Sales → General for billing overflow,
           with General minimum of 3. This rule will apply until you remove it.
           Want me to simulate what would happen with current volumes?

Supervisor: What would happen if we lost 3 support agents right now?
SentinelAI: Simulating... Support queue would hit 35 contacts in ~4 minutes.
           Wait time would breach SLA within 2 minutes. I would move 2 agents
           from Sales (currently idle) and 1 from General. Estimated impact:
           ~15 abandoned calls ($750) before stabilization. Want me to set up
           a preemptive contingency plan?
```

### 5.5 Simulation Engine
**Description**: Built-in mode that generates realistic contact center data for demo and testing purposes, with interactive chaos capabilities for live demonstrations.

**Requirements**:
- Generate realistic queue metrics (contacts arriving, agents handling calls, wait times)
- Support pre-configured scenarios:
  - **Normal Operations**: Steady-state with natural variation
  - **Volume Spike**: Sudden 3-5x increase in one queue
  - **Agent Dropout**: Multiple agents go offline simultaneously
  - **Cascading Failure**: One queue overwhelms, spills into others
  - **Peak Hour Rush**: Gradual ramp-up across all queues
- Scenario timeline scripting (at T+0s: normal, T+30s: spike begins, T+60s: AI detects, T+65s: AI acts)
- Toggle between simulation mode and real Connect instance via config flag
- Simulation data flows through same pipeline as real data (no separate code paths)
- **Interactive Chaos Mode**: A panel (optionally accessible to judges during demo) where disruptions can be injected live — "kill N agents," "spike queue X by Nx," "add network delay." The AI responds to unscripted events in real-time, proving the system actually works.
- **Native Connect Comparison Mode**: Split-screen showing SentinelAI's autonomous response time vs. estimated manual response time using native Connect tools. Shows "time to detect," "time to decide," "time to act" comparison.

### 5.6 AI Governance Overlay (Cross-Cutting Concern)
**Description**: Lightweight governance layer ensuring every AI decision is auditable, confidence-scored, and subject to human approval when warranted. Not a separate pillar — woven into the agent system and UI.

**Requirements**:
- Every `AgentDecision` carries a `confidence` score (0.0–1.0) and a `requires_approval` boolean
- **Approval Gates**: Actions with confidence < 0.7 or tagged as high-impact require human approval before execution
- **Auto-Approve Timeout**: In demo mode, unapproved actions auto-approve after 30 seconds to keep the demo flowing
- **Confidence Visualization**: Frontend decision cards show confidence as color-coded bars (green > 0.8, yellow 0.5–0.8, red < 0.5)
- **Governance Summary Card**: Displays total decisions made, auto vs human approved, average confidence, and audit export capability
- **Audit Trail**: All decisions, approvals, and rejections logged with timestamps and reasoning

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI Operations Center (React)                    │
│  ┌────────────────┐ ┌───────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ AI Decision Feed│ │ Cost      │ │ Alerts  │ │ Chat Panel   │  │
│  │ + Agent Collab  │ │ Ticker    │ │ + Timeline │ │ + NL Policies│ │
│  └────────────────┘ └───────────┘ └─────────┘ └──────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Queue Metrics (context sidebar)  │  Chaos Panel (demo)     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                      ▲ WebSocket ▲                                │
├──────────────────────────────────────────────────────────────────┤
│                      FastAPI Backend                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Connect API   │  │ Agent Orchestrator│  │ Conversational   │   │
│  │ Layer         │  │ + Negotiation     │  │ Interface + NL   │   │
│  │               │  │   Protocol        │  │ Policy Engine    │   │
│  └──────┬───────┘  └──────┬───────────┘  └────────┬─────────┘   │
│         │                 │                        │              │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌────────────┴──────────┐  │
│  │ Simulation   │  │ LangGraph    │  │ Amazon Bedrock         │  │
│  │ Engine +     │  │ Agents (x4)  │  │ (Claude)               │  │
│  │ Chaos Engine │  │              │  │                         │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Redis (real-time state + pub/sub)  │  DynamoDB (historical)     │
├──────────────────────────────────────────────────────────────────┤
│  AWS: Connect APIs  │  Lambda  │  EventBridge  │  Kinesis        │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Ingestion**: Connect APIs polled every 5s (or Kinesis stream) → raw metrics
2. **Processing**: Metrics written to Redis (current state) + DynamoDB (historical)
3. **Detection**: Anomaly engine evaluates metrics against rules + velocity scoring + cascade correlation → generates alerts
4. **Agent Loop**: LangGraph agents observe state → reason → negotiate (if conflicts) → decide → act via Connect APIs
5. **Broadcast**: All state changes, reasoning chains, and cost impact updates pushed to frontend via WebSocket
6. **Interaction**: User chat messages → Analytics Agent / NL Policy Engine → response via WebSocket

---

## 7. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + TypeScript | Component-based, strong ecosystem |
| Styling | TailwindCSS | Rapid UI development, consistent design |
| Charts | Recharts + D3.js | Recharts for standard charts, D3 for custom viz |
| Real-time (client) | WebSocket (native) | Low-latency bidirectional communication |
| Backend | Python 3.12 + FastAPI | Async-first, fast, great for AI integration |
| Real-time (server) | Redis pub/sub | Fast in-memory state + message broker |
| AI Orchestration | LangGraph | State-machine-based agent orchestration |
| LLM | Amazon Bedrock (Claude) | Enterprise-grade, AWS-native |
| Database | DynamoDB | Serverless, scalable, AWS-native |
| AWS Integration | boto3 | Official AWS Python SDK |
| Infrastructure | AWS CDK (Python) | Infrastructure as code, same language as backend |

---

## 8. API Design

### REST Endpoints

```
GET  /api/queues                    # List all queues with current metrics
GET  /api/queues/{id}/metrics       # Historical metrics for a queue
GET  /api/agents                    # List all Connect agents with status
GET  /api/alerts                    # List active and recent alerts
POST /api/alerts/{id}/acknowledge   # Acknowledge an alert
POST /api/chat                      # Send message to conversational interface
GET  /api/actions/log               # AI agent action history
GET  /api/agents/decisions          # AI agent decision log with reasoning chains
GET  /api/agents/negotiations       # Inter-agent negotiation history
GET  /api/cost-impact               # Running cost impact summary
POST /api/chat/policy               # Create NL policy rule
GET  /api/chat/policies             # List active NL-defined policies
DELETE /api/chat/policies/{id}      # Remove a policy
POST /api/simulation/start          # Start a simulation scenario
POST /api/simulation/stop           # Stop simulation
GET  /api/simulation/scenarios      # List available scenarios
POST /api/simulation/chaos          # Inject a chaos event
POST /api/simulation/whatif         # Run a what-if simulation
GET  /api/health                    # System health check
```

### WebSocket Events

```
ws://host/ws/dashboard

Events (server → client):
  queue:update          # Queue metrics updated
  agent:update          # Agent status changed
  alert:new             # New anomaly alert
  alert:resolved        # Alert resolved
  action:taken          # AI agent took an action
  agent:reasoning       # AI agent reasoning step (live stream)
  agent:negotiation     # Inter-agent negotiation event
  cost:update           # Cost impact ticker update
  prediction:warning    # Predictive Prevention Agent early warning
  chat:response         # Chat response from AI
  simulation:event      # Simulation scenario event
  chaos:injected        # Chaos event injected (demo)

Events (client → server):
  chat:message          # User sends chat message
  action:approve        # User approves proposed action
  action:reject         # User rejects proposed action
  chaos:inject          # User injects chaos event
```

---

## 9. Team Allocation

| Person | Role | Responsibilities | Key Deliverables |
|--------|------|-----------------|------------------|
| **P1** | Frontend Lead | AI Operations Center UI, decision feed, cost ticker, WebSocket client, responsive layout | AI Decision Feed, Agent Collaboration Panel, Cost Ticker, alert panel, chat UI |
| **P2** | Integration Lead | AWS Connect API integration, simulation engine, chaos mode | Connect data layer, simulation scenarios, chaos engine, data pipeline |
| **P3** | AI Lead | LangGraph agents, anomaly detection, predictive prevention, negotiation protocol | 4 working agents, anomaly rules, velocity scoring, cascade detection, negotiation protocol |
| **P4** | NLP Lead | Conversational interface, Bedrock integration, NL policy engine, prompt engineering | Chat endpoint, intent parsing, NL policy CRUD, what-if queries, response generation |
| **P5** | Platform Lead | FastAPI backend, Redis/DynamoDB, WebSocket server, CDK infra | API endpoints, data stores, deployment pipeline |
| **P6** | Demo Lead (optional) | Testing, demo scripting, chaos mode testing, presentation, polish | Demo script, chaos scenarios, comparison recordings, slide deck, backup plans, QA |

---

## 10. Week-by-Week Milestones

### Week 1: Foundation (Simulation Loop + First Agents)
| Day | Task | Key Files | Definition of Done |
|-----|------|-----------|-------------------|
| 1 | Background simulation loop (2s tick), wire start/stop/chaos routes, enhance SimulationEngine with chaos + scenarios | `main.py`, `simulation.py`, `routes/simulation.py` | `POST /api/simulation/start` triggers metrics every 2s. Chaos modifies output. |
| 2 | Broadcast `queue:update` / `alert:new` via WebSocket, wire queue routes, create WebSocketProvider, wire Zustand store | `websocket.py`, `routes/queues.py`, `WebSocketProvider.tsx`, `dashboardStore.ts` | Start simulation → MetricsSidebar shows live numbers. Alerts appear in AlertPanel. |
| 3 | Queue Balancer Agent: pressure scoring, imbalance detection, min staffing, `adjust_queue()` on SimulationEngine | `queue_balancer.py`, `orchestrator.py`, `simulation.py` | Chaos spike → Queue Balancer detects → decision in AI Feed → simulation adjusts. |
| 4 | LangGraph orchestrator StateGraph, Predictive Prevention Agent (velocity tracking, cascade risk) | `orchestrator.py`, `predictive_prevention.py`, `main.py` | Both agents run per tick via LangGraph. Decisions stream to frontend. |
| 5 | Alert routes (list, acknowledge), agent decision routes, full E2E smoke test | `routes/alerts.py`, `routes/agents.py`, all | Uninstructed team member can start → simulate → chaos → see agents responding. |

**Week 1 DoD**: Start simulation → chaos inject → see agent decisions in browser.

### Week 2: Core Features (3 Parallel Tracks)
**Track A — Remaining Agents**: EscalationHandlerAgent (Days 6–7), Negotiation Protocol enhancement (Days 7–8), full orchestrator wiring with cost accumulation (Days 9–10).
**Track B — Backend Services**: ConnectService simulation fallback (Day 6), Redis state cache (Day 7), WebSocket client→server handlers for approve/reject/chat/chaos (Days 8–9), optional DynamoDB persistence (Day 10).
**Track C — Frontend Integration**: Operations Center live wiring with Recharts (Days 6–7), Simulation Page event log (Days 7–8), approve/reject buttons on decision cards (Days 8–9), Alerts Page full integration (Day 10).

**Week 2 DoD**: All 4 agents running. Negotiation resolves conflicts visibly. Cost ticker works. Approve/reject works E2E.

### Week 3: Intelligence Layer (3 Parallel Tracks)
**Track D — Bedrock + Chat**: Bedrock service with MockBedrockLLM fallback (Days 11–12), AnalyticsAgent with Bedrock (Days 12–13), chat route full implementation (Days 13–14), lightweight NL policy engine (Days 14–15).
**Track E — AI Governance Overlay**: `confidence` and `requires_approval` fields on AgentDecision (Days 11–12), approval gates with 30s auto-approve (Days 12–13), confidence visualization on frontend (Days 13–14), governance summary card (Day 15).
**Track F — Simulation Enhancement**: Scripted scenario timelines (Days 11–12), simulation event log component (Days 13–14), demo scenario tuning (Day 15).

**Week 3 DoD**: Chat works with Bedrock/mock. NL policies enforced. Governance overlay complete. Scripted scenarios timed.

### Week 4: Polish & Demo Prep
| Task | Definition of Done |
|------|--------------------|
| Bug fixes + edge cases (WS reconnect, Bedrock timeout, empty states, memory caps) | All edge cases handled gracefully |
| Demo polish (animations, "Demo Mode" button, cost ticker pulse) | Smooth, visually impressive UI |
| Create "SentinelAI Demo" scenario — the scripted 3-minute showcase | Scenario file exists, runs flawlessly |
| Full team demo rehearsal (3 runs, timed, talking points) | Team delivers demo without hiccups in under 3 minutes |
| Record backup video, write README, final deployment prep | Backup video recorded, README complete |

**Week 4 DoD**: 3-minute demo runs flawlessly. All 5 pillars + governance demonstrable. Backup video recorded. Team rehearsed 3x.

---

## 11. Success Metrics (For Buildathon Judging)

| Criteria | How SentinelAI Delivers |
|----------|----------------------|
| **Wow Factor** | AI Operations Center showing live agent reasoning, multi-agent negotiation, interactive chaos mode where judges inject failures, and a 3-minute scripted demo scenario |
| **Business Value** | Real-time cost impact ticker quantifies ROI on every AI action; AI Governance Overlay ensures every decision is auditable with confidence scores and approval gates |
| **Technical Depth** | 4 autonomous AI agents with negotiation protocol, predictive prevention using anomaly velocity, LangGraph orchestration, governance overlay with confidence scoring |
| **Feasibility** | Simulation-first architecture ensures reliable demos without AWS dependencies; builds ON TOP of native Connect, not competing with it |
| **Innovation** | Autonomous agents that act + predict + negotiate + explain themselves with full governance transparency. Conversational Command interface. No native equivalent exists. |
| **Presentation** | Interactive chaos demo where judges trigger failures; 3-minute scripted showcase with calm → storm → negotiation → resolution → intelligence arc |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| No AWS Connect instance available | Can't show real data | Simulation engine provides realistic fake data |
| Bedrock API latency too high for real-time | AI responses feel slow | Cache common patterns, pre-compute predictions, async processing |
| Agent actions cause unintended side effects | Broken routing | Human-in-the-loop approval for destructive actions; simulation mode for testing |
| Scope creep | Can't finish in 4 weeks | Strict weekly milestones; cut features, not quality |
| Demo failure on stage | Embarrassment | Pre-recorded backup video; offline simulation mode |
| "How is this different from native Connect?" question from judges | Undermines credibility | Proactively address in pitch: "Connect shows you data. SentinelAI gives you AI that acts on it." Include comparison mode in demo. |

---

## 13. Open Questions

- [ ] Must we stay within AWS ecosystem, or can we use OpenAI/other services alongside Bedrock?
- [ ] Is there an existing AWS Connect instance available, or do we set up a sandbox?
- [ ] Any budget constraints for cloud resources during the buildathon?
- [ ] What are the exact judging criteria for the buildathon?
- [ ] Does the team have any existing code, templates, or boilerplate to reuse?
