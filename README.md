# SentinelAI

**Autonomous AI Operations Layer for AWS Connect**

Built by [CirrusLabs](https://www.cirruslabs.io/) — Enterprise AI Strategy & Compliance Consulting

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

## Five Core Capabilities

### 1. AI Operations Center
A live feed of AI agent activity, reasoning chains, and cost impact. Not a metrics dashboard — a window into the AI brain making decisions on your behalf.

### 2. AI Anomaly Engine
Statistical detection that catches problems before they become crises. Tracks velocity (how fast conditions are deteriorating), predicts cascade failures across queues, and fires alerts with severity levels.

### 3. Autonomous AI Agents
Five specialized agents powered by Anthropic Claude (with MockLLM fallback):

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

Approve/reject buttons appear on decision cards with live countdown timers. Every decision is logged for audit.

### 5. Conversational Command
Ask the system anything in plain English:
- "What just happened?" — full incident summary with reasoning chain
- "What if we lose 3 more agents?" — predictive what-if simulation
- "Show me cost impact" — real-time savings analysis

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
| **Frontend** | React 18, TypeScript, Zustand 5, TailwindCSS, shadcn/ui, Aceternity UI, Framer Motion |
| **Backend** | Python 3.10, FastAPI, LangGraph (parallel agent orchestration) |
| **AI/LLM** | Anthropic Claude (claude-sonnet-4-20250514, primary), Mock LLM (context-aware fallback) |
| **Real-time** | WebSocket (bidirectional), Server-Sent Events pattern |
| **State** | Redis (optional, graceful in-memory fallback) |
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

Required for AI features (optional — falls back to mock responses):
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
│   │   ├── pages/                     # 9 pages
│   │   │   ├── LandingPage            # Animated hero + feature cards + tech stack
│   │   │   ├── LoginPage              # Authentication gate
│   │   │   ├── OperationsCenter       # Main dashboard — live AI activity
│   │   │   ├── AgentsPage             # Agent status and decision history
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
│   │   ├── agents/                    # AI agent implementations
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
│   │   │   └── routes/                # REST endpoints (8 route files)
│   │   ├── models/                    # Pydantic data models
│   │   ├── services/                  # External service integrations
│   │   │   ├── bedrock.py             # LLM service (Anthropic Claude / MockLLM)
│   │   │   ├── simulation.py          # Contact center simulation engine
│   │   │   ├── anomaly.py             # Statistical anomaly detection
│   │   │   ├── sanitizer.py           # PII sanitizer
│   │   │   └── redis_client.py        # Redis with in-memory fallback
│   │   ├── config.py                  # Environment configuration
│   │   └── main.py                    # FastAPI app + background tick loop (3s)
│   ├── tests/                         # 19 passing tests
│   └── requirements.txt
│
├── docs/                              # Technical documentation
│   ├── INDEX.md                       # Documentation navigation
│   ├── ARCHITECTURE.md                # Code patterns and conventions
│   ├── CONTEXT.md                     # Product vision and decisions
│   ├── STATUS.md                      # Build progress tracker
│   ├── TASKS.md                       # Sprint task specifications
│   └── BACKLOG.md                     # Future sprint backlog (all done)
│
├── OVERVIEW.md                        # Non-technical project explanation
├── PRD.md                             # Product Requirements Document
├── CLAUDE.md                          # Claude Code context file
└── GEMINI.md                          # AI model handoff context
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

The LLM (Anthropic Claude) powers each agent's reasoning — analyzing metrics, generating explanations, and producing confidence scores. A 2-tier fallback ensures the system always works: Anthropic Claude > Mock responses (context-aware, dynamic).

---

## API Endpoints

| Method | Path | Description |
|--------|------|------------|
| GET | `/api/health` | System health + service status |
| GET | `/api/queues` | Current queue metrics |
| GET | `/api/alerts` | Active anomaly alerts |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/api/agents` | Agent status overview |
| GET | `/api/agents/decisions` | Decision history |
| GET | `/api/agents/negotiations` | Negotiation log |
| POST | `/api/chat` | Send natural language query |
| GET | `/api/simulation/scenarios` | List available scenarios |
| POST | `/api/simulation/start` | Start a simulation |
| POST | `/api/simulation/stop` | Stop simulation |
| POST | `/api/simulation/chaos` | Inject chaos event |
| POST | `/api/simulation/whatif` | Run what-if analysis |

WebSocket: `ws://localhost:8000/ws/dashboard` — bidirectional real-time events.

---

## Testing

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

All 19 tests pass. Tests cover health endpoints, simulation lifecycle, agent orchestration, chat, governance, reports, skill router, and API routes.

---

## Key Differentiators

| Feature | Why It Matters |
|---------|---------------|
| **Multi-agent negotiation** | Agents visibly disagree and resolve — judges see AI collaboration, not just automation |
| **Human-in-the-loop governance** | Confidence scores + approval gates = responsible AI, not a black box |
| **Real-time reasoning visibility** | Every AI decision shows its reasoning chain — full transparency |
| **Cost impact quantification** | Dollar amounts ($1,240 saved), not just metrics — clear business value |
| **Simulation-first architecture** | Demo always works, no AWS dependency — reliable under any conditions |
| **LLM with smart fallback** | Anthropic Claude > context-aware MockLLM — never fails, always responds |

---

*CirrusLabs Internal Buildathon — 2026*
