# SentinelAI

**Autonomous AI Operations Layer for AWS Connect**

> **Early Alpha** — Live in production. Built by [CirrusLabs](https://www.cirruslabs.io/) — Enterprise AI Strategy & Compliance Consulting

---

## What is SentinelAI?

AWS Connect gives you the data. SentinelAI gives you the AI that acts on it.

SentinelAI is an autonomous intelligence platform that sits on top of AWS Connect contact centers. While Connect provides metrics, dashboards, and forecasting, SentinelAI adds a layer of **AI agents that continuously watch your contact center, detect problems before they escalate, and take action** — with every decision fully visible, explainable, and governed by human-in-the-loop approval.

---

## The Problem

Contact center supervisors face three critical gaps:

- **No one is watching 24/7.** Connect shows metrics — but no system is autonomously analyzing and acting on them in real time.
- **Manual queue rebalancing.** Moving agents between queues requires manual steps, even when the solution is obvious.
- **No AI reasoning transparency.** When decisions are made, there's no way to see *why* — what was considered, what trade-offs were made, what it cost.

---

## Six Core Capabilities

### 1. AI Operations Center
A live feed of AI agent activity, reasoning chains, and cost impact. Not a metrics dashboard — a window into the AI brain making decisions on your behalf. Includes an **Operational Performance Trends** chart that persists across page navigations.

### 2. AI Anomaly Engine
Statistical detection that catches problems before they become crises. Tracks velocity (how fast conditions are deteriorating), predicts cascade failures across queues, and fires alerts with severity levels.

### 3. Autonomous AI Agents
Five specialized agents powered by AWS Bedrock / Anthropic Claude (with NoKeyLLM fallback):

| Agent | Role |
|-------|------|
| **Queue Balancer** | Detects staffing imbalances, proposes agent reallocation between queues |
| **Predictive Prevention** | Identifies risk patterns and cascade failures before they trigger alerts |
| **Escalation Handler** | Responds to critical situations and coordinates resolution |
| **Skill Router** | Zero-LLM latency skill-based contact routing with weighted scoring |
| **Analytics Agent** | Powers natural language queries, incident summaries, and what-if analysis |

When agents disagree, a **Multi-Agent Negotiation Protocol** mediates the conflict and surfaces the result for human review.

### 4. AI Governance (Human-in-the-Loop)
Every agent decision carries a confidence score (0-100%). The system enforces approval gates:

| Confidence | Behavior |
|-----------|----------|
| 90%+ | Auto-approved (routine, low-risk) |
| 70-90% | Requires human approval (auto-approves after 30s in demo mode) |
| Below 70% | Blocked until human reviews |

Approve/reject buttons appear on decision cards with live countdown timers. Every decision is logged for audit. An **Explain Decision** feature lets users drill into any decision's reasoning chain.

### 5. Conversational Command
Ask the system anything in plain English:
- "What just happened?" — full incident summary with reasoning chain
- "What if we lose 3 more agents?" — predictive what-if simulation
- "Show me cost impact" — real-time savings analysis

The chat supports a full **NL Policy Engine** — create, list, and delete governance policies via natural language. A `/clear` command resets conversation history.

### 6. Contact Lens Sentiment
Live customer sentiment tracking per queue, powered by simulated Contact Lens data. Each queue displays a real-time mood indicator that updates every tick.

---

## Live Demo (3 Minutes)

SentinelAI includes a choreographed demo scenario that runs completely without an AWS Connect instance:

| Phase | What Happens | What You See |
|-------|-------------|-------------|
| **The Calm** (0:00) | Normal operations | Live metrics, agents observing, cost at $0, green status |
| **The Storm** (0:30) | Chaos injection — queue spike + agent dropout | 4x queue depth, CRITICAL alerts, agents analyzing in real time |
| **The Negotiation** (1:15) | Queue Balancer vs Escalation Handler conflict | Competing proposals, negotiation resolves, approval prompt appears |
| **The Resolution** (1:45) | Human approves action | Metrics stabilize, cost ticker climbs ($450 to $1,240 saved) |
| **The Intelligence** (2:30) | "What just happened?" in chat | AI summarizes the full incident with reasoning |

You can also inject chaos events manually (Kill Agents, Spike Queue, Network Delay, Cascade Failure) and watch the AI respond in real time.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript 5.6, Zustand 5, TailwindCSS 3, shadcn/ui, Aceternity UI, Framer Motion, Recharts, jsPDF, html2canvas |
| **Backend** | Python 3.10+, FastAPI 0.115, Uvicorn 0.34, LangGraph 1.1.2 (parallel agent orchestration) |
| **AI/LLM** | AWS Bedrock (Converse API, primary), Anthropic Claude API (fallback), NoKeyLLM (no-key fallback) |
| **Auth** | Google & Microsoft OAuth + JWT authentication |
| **Real-time** | WebSocket (bidirectional, ping/pong keep-alive) + SSE fallback + HTTP action fallback |
| **Database** | SQLite (agent proficiency DB — 24 agents, 12 skills, 5 departments) |
| **State** | Redis (optional, graceful in-memory fallback) |
| **Infra** | AWS CDK, Docker, Docker Compose |
| **Integrations** | Microsoft Teams Bot Framework (chat, approval cards, PDF reports), SMTP email |
| **Target Platform** | AWS Connect (simulation-first, real integration optional) |

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd SentinelAI

# Install all dependencies (frontend + backend)
npm install

# Start both frontend and backend
npm run dev
```

This starts:
- Frontend at `http://localhost:5173`
- Backend at `http://localhost:8000`

### Environment Variables

Copy the example env file and add your keys:

```bash
cd backend
cp .env.example .env
```

Required for AI features (set one — falls back to NoKeyLLM without either):

**Option 1 — AWS Bedrock (recommended):**
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

**Option 2 — Anthropic API:**
```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Optional:
```
REDIS_URL=redis://localhost:6379    # Optional, in-memory fallback works fine
```

### Running the Demo

1. Open `http://localhost:5173`
2. Navigate to **Simulation** page
3. Click **SentinelAI Demo (3 min)** — the recommended scenario
4. Watch AI agents respond in the **Operations Center**
5. Approve/reject decisions in the **AI Decision Feed**
6. Ask "What just happened?" in the **Chat** page

---

## Project Structure

```
SentinelAI/
├── frontend/                          # React + TypeScript dashboard
│   ├── src/
│   │   ├── components/                # Reusable UI components
│   │   │   ├── layout/                # AppLayout, Sidebar, Header
│   │   │   ├── operations-center/     # AI Decision Feed, Queue Cards, Cost Ticker
│   │   │   ├── auth/                  # RequireAuth
│   │   │   ├── theme/                 # ThemeToggle (dark/light)
│   │   │   └── ui/                    # shadcn/ui + Aceternity components
│   │   ├── pages/                     # 10 pages
│   │   │   ├── LandingPage            # Animated hero + feature cards + tech stack
│   │   │   ├── LoginPage              # Authentication gate
│   │   │   ├── OperationsCenter       # Main dashboard — live AI activity
│   │   │   ├── AgentsPage             # Agent status and decision history
│   │   │   ├── WorkforcePage          # Human agent profiles, skills, department fitness
│   │   │   ├── AlertsPage             # Anomaly alerts with severity levels
│   │   │   ├── ChatPage               # Natural language command interface
│   │   │   ├── SimulationPage         # Scenario runner + chaos engine
│   │   │   ├── ReportsPage            # Session reports with Recharts charts
│   │   │   └── SettingsPage           # Connection status and configuration
│   │   ├── stores/                    # Zustand state management
│   │   ├── services/                  # API client + WebSocket service
│   │   └── types/                     # TypeScript type definitions
│   └── package.json
│
├── backend/                           # Python FastAPI server
│   ├── app/
│   │   ├── agents/                    # AI agent implementations (8 files)
│   │   │   ├── orchestrator.py        # LangGraph parallel agent orchestration
│   │   │   ├── queue_balancer.py      # Queue rebalancing agent
│   │   │   ├── predictive_prevention.py # Cascade risk detection agent
│   │   │   ├── escalation_handler.py  # Critical alert response agent
│   │   │   ├── skill_router.py        # Zero-LLM skill-based contact routing
│   │   │   ├── analytics.py           # Natural language query agent
│   │   │   ├── negotiation.py         # Multi-agent conflict resolution
│   │   │   └── guardrails.py          # Action scopes, rate limits, approval logic
│   │   ├── api/                       # API routes and WebSocket
│   │   │   ├── websocket.py           # Bidirectional WebSocket manager
│   │   │   └── routes/                # REST endpoints (13 route files, 51 endpoints)
│   │   │       ├── agents.py          # Agent status, decisions, negotiations, human agents
│   │   │       ├── agent_chat.py      # Agent-to-agent chat
│   │   │       ├── alerts.py          # Alert list + acknowledge
│   │   │       ├── auth.py            # OAuth login (Google/Microsoft), JWT, verify
│   │   │       ├── chat.py            # NL chat, policy CRUD
│   │   │       ├── governance.py      # Scorecard, audit, policies
│   │   │       ├── health.py          # Health check
│   │   │       ├── history.py         # Metrics time-series
│   │   │       ├── notifications.py   # Email preferences
│   │   │       ├── queues.py          # Queue metrics
│   │   │       ├── reports.py         # Session export, email, PDF
│   │   │       ├── simulation.py      # Start/stop/chaos/whatif/scenarios
│   │   │       └── teams.py           # Teams Bot Framework
│   │   ├── models/                    # Pydantic data models (7 files)
│   │   │   ├── action.py              # Action, ActionLog
│   │   │   ├── agent.py               # AgentStatus, AgentDecision, AgentType
│   │   │   ├── alert.py               # Alert, Severity
│   │   │   ├── guardrails.py          # ApprovalStatus, GuardrailDecision
│   │   │   ├── proficiency.py         # SkillProficiency, DepartmentFitness, HumanAgentProfile
│   │   │   └── queue.py               # QueueMetrics, QueueUpdate
│   │   ├── services/                  # External service integrations (13 files)
│   │   │   ├── bedrock.py             # LLM service (Bedrock > Anthropic API > NoKeyLLM)
│   │   │   ├── simulation.py          # Contact center simulation engine
│   │   │   ├── anomaly.py             # Statistical anomaly detection
│   │   │   ├── sanitizer.py           # PII sanitizer
│   │   │   ├── agent_database.py      # SQLite workforce DB (24 agents, 12 skills, 5 depts)
│   │   │   ├── chat_tools.py          # Chat command tools (MOVE_AGENT, etc.)
│   │   │   ├── connect.py             # AWS Connect integration (stub)
│   │   │   ├── notifications.py       # SMTP email with attachment support
│   │   │   ├── pdf_report.py          # Server-side PDF generation (fpdf2)
│   │   │   ├── raia_tracer.py         # RAIA tracing instrumentation
│   │   │   ├── redis_client.py        # Redis with in-memory fallback
│   │   │   └── teams_bot.py           # Microsoft Teams Bot Framework
│   │   ├── config.py                  # Environment configuration
│   │   └── main.py                    # FastAPI app + background tick loop (3s)
│   ├── tests/                         # 20 tests (16 passing, 4 env-dependent)
│   └── requirements.txt
│
├── infra/                             # AWS CDK infrastructure
│   ├── app.py                         # CDK app entry
│   └── stacks/sentinelai_stack.py     # CloudFormation stack
│
├── teams-manifest/                    # Microsoft Teams bot manifest
│
├── docs/                              # Technical documentation
│   ├── INDEX.md                       # Documentation navigation
│   ├── ARCHITECTURE.md                # Code patterns and conventions
│   ├── CONTEXT.md                     # Product vision and decisions
│   ├── STATUS.md                      # Build progress tracker
│   ├── TASKS.md                       # Sprint task specifications
│   ├── BACKLOG.md                     # Future sprint backlog (all done)
│   └── COMPETITIVE_ANALYSIS.md        # Market analysis
│
├── OVERVIEW.md                        # Non-technical project explanation
├── PRD.md                             # Product Requirements Document
├── CLAUDE.md                          # Claude Code context file
├── GEMINI.md                          # AI model handoff context
├── Dockerfile                         # Container configuration
└── docker-compose.yml                 # Docker Compose config
```

---

## How It Works (Architecture)

```
Every 3 seconds, the system runs a "tick":

  Simulation Engine generates contact center metrics
         |
         v
  Anomaly Engine checks for problems --> Fires alerts
         |
         v
  Agent Orchestrator (LangGraph) runs 4 agents IN PARALLEL:
    - Queue Balancer: "Should I move agents between queues?"
    - Predictive Prevention: "Is a cascade failure developing?"
    - Escalation Handler: "Are there critical alerts to resolve?"
    - Skill Router: "Should contacts be rerouted by skill match?"
         |
         v
  If agents conflict --> Negotiation Protocol resolves it
         |
         v
  Guardrails check confidence --> AUTO_APPROVE / PENDING_HUMAN / BLOCKED
         |
         v
  WebSocket broadcasts everything to the frontend IN REAL TIME
         |
         v
  React dashboard updates instantly (Zustand state management)
```

The LLM powers each agent's reasoning — analyzing metrics, generating explanations, and producing confidence scores. A 3-tier fallback ensures the system always works: AWS Bedrock (Converse API with native tool-use) > Anthropic Claude API > NoKeyLLM (shows setup instructions).

---

## API Endpoints (51 Total)

| Method | Path | Description |
|--------|------|------------|
| GET | `/api/health` | System health + service status |
| GET | `/api/queues` | Current queue metrics |
| GET | `/api/queues/{id}/metrics` | Single queue metrics |
| GET | `/api/alerts` | Active anomaly alerts |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/api/agents` | AI agent status overview |
| GET | `/api/agents/decisions` | Decision history |
| GET | `/api/agents/negotiations` | Negotiation log |
| GET | `/api/agents/governance` | Governance scorecard |
| GET | `/api/agents/human` | List all human agents with proficiencies |
| GET | `/api/agents/human/{id}` | Single human agent profile |
| GET | `/api/agents/human/by-department/{dept_id}` | Agents ranked by department fitness |
| POST | `/api/chat` | Send natural language query |
| POST | `/api/chat/policy` | Create NL governance policy |
| GET | `/api/chat/policies` | List active policies |
| DELETE | `/api/chat/policy/{id}` | Delete a policy |
| GET | `/api/governance/scorecard` | Governance scorecard |
| GET | `/api/governance/audit` | Audit trail |
| GET | `/api/governance/policies` | Policy list |
| POST | `/api/auth/login` | OAuth login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/verify` | Verify JWT token |
| GET | `/api/simulation/scenarios` | List available scenarios |
| GET | `/api/simulation/status` | Simulation state |
| POST | `/api/simulation/start` | Start a simulation |
| POST | `/api/simulation/stop` | Stop simulation |
| POST | `/api/simulation/chaos` | Inject chaos event |
| POST | `/api/simulation/whatif` | Run what-if analysis |
| GET | `/api/reports/session` | Export session report |
| POST | `/api/reports/email` | Email report with PDF attachment |
| GET | `/api/metrics/history` | Metrics time-series |
| POST | `/api/agent-chat` | Agent chat message |
| GET | `/api/agent-chat/agents` | List agents for chat |
| GET | `/api/agent-chat/{id}` | Get agent chat history |
| POST | `/api/notifications/email` | Send notification email |
| POST | `/api/teams/messages` | Teams Bot Framework endpoint |
| POST | `/api/ws-action` | HTTP fallback for client-to-server actions |
| GET | `/api/stream` | SSE fallback for real-time events |

WebSocket: `ws://localhost:8000/ws/dashboard` — bidirectional real-time events with ping/pong keep-alive.
SSE fallback: `http://localhost:8000/api/stream` — for environments that block WebSocket (e.g., App Runner).

---

## Testing

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

20 tests total — 16 passing, 4 environment-dependent (require AWS Bedrock credentials or SMTP config). Tests cover health endpoints, simulation lifecycle, agent orchestration, chat, governance, reports, skill router, chaos injection, and API routes. Frontend compiles cleanly (`npx tsc --noEmit`).

---

## Key Differentiators

| Feature | Why It Matters |
|---------|---------------|
| **Multi-agent negotiation** | Agents visibly disagree and resolve — judges see AI collaboration, not just automation |
| **Human-in-the-loop governance** | Confidence scores + approval gates = responsible AI, not a black box |
| **Real-time reasoning visibility** | Every AI decision shows its reasoning chain — full transparency |
| **Cost impact quantification** | Dollar amounts ($1,240 saved), not just metrics — clear business value |
| **Simulation-first architecture** | Demo always works, no AWS dependency — reliable under any conditions |
| **LLM with smart fallback** | AWS Bedrock > Anthropic API > NoKeyLLM — 3-tier resilience |
| **OAuth authentication** | Google & Microsoft login with JWT — enterprise-ready |
| **Contact Lens sentiment** | Live customer mood per queue — real-time emotional intelligence |
| **RAIA tracing** | Full observability with navigation counters and trace instrumentation |

---

> **Status**: Early Alpha — deployed to production. All core features functional. Demo-ready.

*CirrusLabs Internal Buildathon — 2026*
