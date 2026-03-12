# SentinelAI

**Autonomous AI Operations Layer for AWS Connect**

Built by [CirrusLabs](https://www.cirruslabs.io/) — Enterprise AI Strategy & Compliance Consulting

---

## What is SentinelAI?

AWS Connect gives you the data. SentinelAI gives you the AI that acts on it.

SentinelAI is an autonomous intelligence layer that sits on top of AWS Connect. While Connect provides metrics, dashboards, and forecasting, SentinelAI adds a layer of AI agents that continuously watch your contact center, detect problems before they escalate, and take action — with every decision fully visible and explainable.

---

## The Problem

Contact center supervisors face three critical gaps that AWS Connect doesn't solve:

- **No one is watching 24/7.** Connect shows you metrics — but no system is autonomously analyzing them and acting in real time.
- **Manual queue rebalancing.** Moving agents between queues requires manual steps through admin screens, even when the solution is obvious.
- **No AI reasoning transparency.** When decisions are made, there's no way to see *why* — what was considered, what trade-offs were made, what it cost.

---

## What SentinelAI Does

SentinelAI has five core capabilities:

### AI Operations Center
The primary view — a live feed of AI agent activity, reasoning chains, and cost impact. Not a metrics dashboard. A window into the AI brain making decisions on your behalf.

### AI Anomaly Engine
Statistical detection that catches problems before they become crises. Tracks velocity (how fast conditions are deteriorating), predicts cascade failures across queues, and fires alerts with recommended actions.

### Autonomous Agents
Four specialized AI agents work together:
- **Queue Balancer** — detects staffing imbalances and proposes agent reallocation
- **Predictive Prevention** — identifies risk patterns before they trigger alerts
- **Escalation Handler** — responds to critical situations and coordinates resolution
- **Analytics Agent** — powers natural language queries and incident summaries

When agents disagree on the best course of action, a built-in **negotiation protocol** mediates the conflict and surfaces the result for human review.

### AI Governance Overlay
Every agent decision carries a confidence score. High-confidence routine actions auto-approve. Lower-confidence or high-impact actions require a human to approve or reject — with a 30-second auto-approve window in demo mode to keep things moving. Every decision is logged for audit.

### Conversational Command
Ask the system anything in plain English. "What just happened?" returns a full incident summary — agents involved, actions taken, cost impact, and the reasoning chain. Lightweight natural language policy creation is also supported.

---

## The Demo

SentinelAI is built around a choreographed 3-minute demo scenario:

| Phase | What Happens |
|-------|-------------|
| **The Calm** | Normal operations — agents observing, metrics stable, cost at $0 |
| **The Storm** | Chaos injection — Support queue spikes 4x, agents go offline in General queue, CRITICAL alerts fire |
| **The Negotiation** | Queue Balancer and Escalation Handler propose conflicting actions — the negotiation panel shows them resolving it |
| **The Resolution** | Human approves the action — metrics stabilize, cost ticker climbs to show value saved |
| **The Intelligence** | "What just happened?" — AI summarizes the full incident in natural language |

The simulation engine is the primary demo path. It runs completely without an AWS Connect instance, making the demo reliable under any conditions.

---

## Getting Started

```bash
cd Buildathon
npm run dev
```

This starts both the frontend (port 5173) and backend (port 8000).

Open `http://localhost:5173` to see the live dashboard. The simulation begins automatically.

---

## Project Structure

```
Buildathon/
├── frontend/        # React + TypeScript dashboard
├── backend/         # Python FastAPI server + AI agents
├── docs/            # Architecture, tasks, and build status
└── PRD.md           # Full product requirements
```

For detailed architecture, build status, and development tasks, see the [`docs/`](./docs/INDEX.md) folder.

---

## Built With

- **Frontend**: React, TypeScript, TailwindCSS, Recharts, Zustand
- **Backend**: Python, FastAPI, LangGraph
- **AI**: Amazon Bedrock (Claude) with mock fallback for offline demos
- **Infrastructure**: AWS Connect, Lambda, EventBridge, CDK

---

*CirrusLabs Internal Buildathon — 2026*
