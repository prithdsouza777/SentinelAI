# SentinelAI — Docs Index
> **Any model picking up this project: start here. This file is the map.**

---

## Navigation

| Doc | What It Answers |
|-----|----------------|
| [../README.md](../README.md) | Project overview, setup instructions, tech stack |
| [../OVERVIEW.md](../OVERVIEW.md) | Non-technical explanation of the entire project |
| [../CLAUDE.md](../CLAUDE.md) | Claude Code context file |
| [../GEMINI.md](../GEMINI.md) | AI model handoff context (any model) |
| [STATUS.md](./STATUS.md) | What has been built? What's broken? What % is done? |
| [TASKS.md](./TASKS.md) | Week 1 sprint tasks (all completed) |
| [BACKLOG.md](./BACKLOG.md) | Weeks 2-4 tasks (all completed) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How should I write the code? Patterns, conventions, contracts |
| [CONTEXT.md](./CONTEXT.md) | Why are we building this? What must the demo show? |

---

## Current Build State — Snapshot (Updated 2026-03-25)

| Sprint | Status | Key Blocker |
|--------|--------|-------------|
| Week 1: Foundation | Done | — |
| Week 2: Core Features | Done | — |
| Week 2.5: Governance (SentinelAI) | Done | — |
| Week 3: Intelligence | Done | — |
| Week 4: Polish | Done | — |

**Overall: ~100% complete — fully functional demo-ready product**

Key milestones achieved:
- All 5 AI agents fully implemented (4 with LLM reasoning, 1 zero-LLM proficiency-weighted)
- **AWS Bedrock integration** — 3-tier LLM fallback: Bedrock (Converse API) > Anthropic API > NoKeyLLM
- **SSE fallback** for WebSocket + HTTP action fallback + ping/pong keep-alive
- Agent proficiency database with 24 human agents, 12 skills, 5 departments
- Workforce management page with search, filters, expandable profiles
- LangGraph parallel orchestration working
- Human-in-the-loop governance (approve/reject with auto-approve countdown)
- Multi-agent negotiation protocol live
- Chat with native tool-use, conversation memory, and what-if analysis
- Chaos engine with 4 injection types
- 6 simulation scenarios including choreographed 3-minute demo
- Full dark glassmorphism UI with light theme toggle (shadcn/ui + Aceternity UI)
- Landing page, login gate, reports dashboard added
- 19/19 backend tests passing, 0 TypeScript errors

---

## 60-Second Orientation for Any Model

1. **Frontend is done.** 10 pages with shadcn/ui + Aceternity UI dark/light theme, Zustand stores (dashboard + workforce), WebSocket client, approve/reject buttons, guardrail badges, auto-approve countdown, animated components. Landing page + login gate + workforce page.

2. **Backend is done.** 5 agents (Queue Balancer, Predictive Prevention, Escalation Handler, Skill Router, Analytics) powered by Anthropic Claude with MockLLM fallback. LangGraph parallel orchestrator, negotiation protocol, guardrails layer. SQLite agent proficiency database (24 human agents, 12 skills, 5 departments).

3. **LLM**: 3-tier fallback — AWS Bedrock (Converse API, primary) > Anthropic API (fallback) > NoKeyLLM (no-key). Config in `backend/.env` with AWS credentials or `ANTHROPIC_API_KEY`. Service in `backend/app/services/bedrock.py`.

4. **Critical gotcha**: Backend uses `snake_case`, frontend needs `camelCase`. Fixed via `CamelModel` base class — always serialize with `.model_dump(by_alias=True, mode="json")`.

5. **Simulation-first**. All demos run on the built-in simulation engine (3s tick). Real AWS Connect is optional.

---

## How to Run the Project

```bash
# From the SentinelAI root directory
npm install              # install frontend + backend dependencies
npm run dev              # frontend (:5173) + backend (:8000) concurrently
cd backend && pytest     # run tests
```

**Backend**: http://localhost:8000
**Frontend**: http://localhost:5173
**API docs**: http://localhost:8000/docs
**WebSocket**: ws://localhost:8000/ws/dashboard
