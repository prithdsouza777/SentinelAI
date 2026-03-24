# SentinelAI — Project Overview (Non-Technical)

This document explains SentinelAI in plain language for anyone — managers, judges, stakeholders, or team members who want to understand the project without reading code.

---

## What Problem Does SentinelAI Solve?

Imagine you run a large call center with hundreds of agents handling customer calls across different departments (Support, Billing, Sales, VIP, General). Right now:

- **Someone has to manually watch** all the queues to spot problems
- **When one department gets overwhelmed**, a supervisor has to manually move agents from quiet departments to busy ones
- **Problems cascade** — if Support gets flooded, callers give up, call back on other lines, and suddenly Billing and General are overwhelmed too
- **There's no record** of why decisions were made or what they cost

**SentinelAI automates all of this with AI agents that watch, think, decide, and act — 24/7, in real time.**

---

## How Does It Work? (Simple Version)

Think of SentinelAI as having **five AI employees** who never sleep:

### Agent 1: The Queue Balancer
- Watches all department queues simultaneously
- Notices when one department has too many waiting callers and another has idle agents
- Proposes moving agents from the quiet department to the busy one
- Example: "Move 2 agents from Sales (only 3 callers) to Support (15 callers waiting)"

### Agent 2: The Predictive Prevention Agent
- Looks at trends, not just current numbers
- Predicts problems before they happen
- Detects "cascade failures" — when one department's problems will spread to others
- Example: "Support abandonment rate is climbing at 2% per minute — if this continues, Billing will overflow in 4 minutes"

### Agent 3: The Escalation Handler
- Responds to critical situations that need immediate action
- Coordinates emergency responses when multiple things go wrong at once
- Example: "5 agents just went offline in General queue — activating emergency reallocation"

### Agent 4: The Analytics Agent
- You can talk to this one in plain English
- Ask "What just happened?" and it explains the full incident
- Ask "What if we lose 3 more agents?" and it runs a prediction
- Example: "In the last 5 minutes, a spike hit Support queue. Queue Balancer moved 2 agents from Billing. Escalation Handler flagged priority. Result: queue stabilized, estimated $340 saved."

### Agent 5: The Skill Router
- Routes contacts to the best-matched agent based on skills, not just availability
- Uses weighted scoring: skill match (40%) + performance (25%) + experience (20%) + current load (15%)
- Zero-LLM latency — runs entirely on algorithmic scoring for speed
- Example: "Route this billing dispute to Agent #42 — highest skill match (95%) with low current load"

### The Negotiation Protocol
Sometimes agents disagree. The Queue Balancer might want to move agents from Billing, but the Escalation Handler might say Billing needs them. When this happens, they **negotiate** — compare their reasoning, weigh the trade-offs, and reach a consensus. This negotiation is **visible on screen** so humans can see the AI thinking through conflicts.

---

## The Safety Net: Human-in-the-Loop Governance

SentinelAI doesn't just let AI run wild. Every decision has a **confidence score** (like a certainty percentage):

- **90-100% confident** (routine decisions): The system auto-approves and acts immediately. Example: moving 1 agent between low-priority queues.
- **70-90% confident** (moderate decisions): The system shows an "Approve" and "Reject" button. A human supervisor must click to proceed. In demo mode, it auto-approves after 30 seconds to keep things moving.
- **Below 70% confident** (uncertain decisions): The system blocks the action entirely until a human reviews it. No auto-approve.

This means the AI is always transparent about how sure it is, and humans always have the final say on important decisions.

---

## What Does the Dashboard Look Like?

SentinelAI has **9 pages**, each with a specific purpose:

### Page 1: Operations Center (Main Dashboard)
The command center. Shows:
- **Live queue metrics** — how many callers are waiting in each department, how many agents are online, wait times
- **AI Decision Feed** — a live stream of what the AI agents are thinking and doing, with reasoning explanations
- **Cost Impact Ticker** — a running total of money saved by AI actions
- **Anomaly Timeline** — visual history of problems detected

### Page 2: Agents
Shows the status of all 4 AI agents:
- Whether each agent is currently observing, analyzing, deciding, or acting
- Their recent decisions with full reasoning
- The negotiation log (when agents disagreed and how they resolved it)

### Page 3: Alerts
A list of all anomalies detected:
- Color-coded by severity (Critical = red, Warning = amber, Info = blue)
- Each alert shows what was detected, which queue, and what action was taken
- Supervisors can acknowledge alerts to mark them as handled

### Page 4: Chat (Conversational Command)
A chat interface where you can ask questions in plain English:
- "What just happened?" — get an incident summary
- "What if we lose 3 agents?" — run a predictive scenario
- "Show me the cost impact" — see savings breakdown

### Page 5: Simulation Engine
The testing and demo control panel:
- **Scenarios** — pre-built situations to test the AI (Normal Operations, Volume Spike, Agent Dropout, Cascade Failure, Peak Rush, and the full 3-minute SentinelAI Demo)
- **Chaos Engine** — buttons to inject problems in real time and watch the AI respond (Kill Agents, Spike Queue, Network Delay, Cascade Failure)
- **Event Log** — live feed of everything happening during the simulation

### Page 6: Reports
Session analytics and export:
- Recharts-powered charts showing queue metrics, agent decisions, and cost impact over time
- Session summary with governance scorecard
- Exportable data (JSON format)

### Page 7: Settings
System configuration and connection status:
- Backend API connection status
- WebSocket (real-time connection) status
- LLM (AI brain) provider and model info
- Redis (database) status
- Operating mode (Simulation vs Live)

### Page 8: Landing Page
The public-facing entry point:
- Animated hero section with SentinelAI branding
- Feature pillar cards highlighting all 6 capabilities
- Tech stack ribbon with official logos
- Live agent feed and animated stats
- Grid pattern and glow effects for visual polish

### Page 9: Login
Authentication gate before accessing the dashboard

---

## The 3-Minute Demo

SentinelAI includes a choreographed demo that tells a complete story in 3 minutes:

**Act 1 — The Calm (0:00-0:30)**
Everything is normal. Queues are balanced, agents are online, the AI is quietly observing. The cost ticker shows $0.

**Act 2 — The Storm (0:30-1:15)**
Chaos hits: the Support queue gets flooded with 4x normal call volume, and 5 agents go offline in the General queue. CRITICAL alerts fire. The AI agents light up — observing the problem, analyzing the data, deciding what to do.

**Act 3 — The Negotiation (1:15-1:45)**
The Queue Balancer and Escalation Handler both want to act, but they disagree on the best approach. The negotiation panel shows them working through the conflict. They reach consensus. An approval prompt appears for the human supervisor.

**Act 4 — The Resolution (1:45-2:30)**
The supervisor clicks "Approve." The AI executes the plan. Queue metrics stabilize. The cost ticker starts climbing — $450... $890... $1,240 saved.

**Act 5 — The Intelligence (2:30-3:00)**
The supervisor types "What just happened?" in the chat. The Analytics Agent responds with a complete incident summary: what went wrong, what the AI did, how much money was saved, and the full reasoning chain.

---

## Technology Explained (In Simple Terms)

| Component | What It Is | Why We Use It |
|-----------|-----------|---------------|
| **React** | The framework that builds the web dashboard | Fast, interactive, used by Netflix/Facebook |
| **FastAPI** | The backend server that runs the AI logic | Very fast Python web server |
| **LangGraph** | The framework that orchestrates our AI agents | Lets agents run in parallel and coordinate |
| **Anthropic Claude** | The AI "brain" that powers agent reasoning | Capable AI model from Anthropic |
| **WebSocket** | Real-time communication between server and dashboard | Updates appear instantly, no page refresh needed |
| **Zustand** | Frontend state management | Keeps all dashboard data synchronized |
| **TailwindCSS + shadcn/ui** | The design system for the dashboard | Modern, dark-themed, professional look |
| **Framer Motion** | Animation library | Smooth transitions and visual polish |

### LLM Fallback Chain
The AI brain has a smart fallback so it never fails:
1. **Anthropic Claude** (primary) — powerful reasoning with live system context
2. **Mock LLM** (fallback) — context-aware dynamic responses built from live telemetry, works offline

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Backend tests passing | 19/19 |
| TypeScript errors | 0 |
| Frontend pages | 9 |
| AI agents | 5 |
| LLM fallback tiers | 2 |
| Simulation scenarios | 6 |
| Chaos injection types | 4 |
| Tick interval | 3 seconds |
| Auto-approve timeout | 30 seconds |
| Simulated queues | 5 (Support, Billing, Sales, General, VIP) |

---

## What Makes This Project Special?

1. **AI agents that visibly think** — you can see the reasoning, not just the result
2. **Agents that negotiate with each other** — multi-agent collaboration is rare and impressive
3. **Human-in-the-loop governance** — responsible AI with confidence scores and approval gates
4. **Real-time everything** — metrics, decisions, alerts, and chat all update live via WebSocket
5. **Cost quantification** — every action shows its dollar impact, making the business case clear
6. **Simulation-first** — the demo always works perfectly, no external dependencies needed
7. **Beautiful dark UI** — professional glassmorphism design with smooth animations

---

## How to Run It

1. Make sure you have Node.js and Python installed
2. Open a terminal in the project folder
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start both frontend and backend
5. Open `http://localhost:5173` in your browser
6. Go to the Simulation page and click "SentinelAI Demo (3 min)"
7. Watch the AI in action on the Operations Center page

---

## Team

Built by the CirrusLabs team for the 2026 Internal Buildathon.

**CirrusLabs** (cirruslabs.io) — Enterprise AI Strategy & Compliance Consulting
