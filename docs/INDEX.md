# SentinelAI — Docs Index
> **Any model picking up this project: start here. This file is the map.**

---

## Navigation

| Doc | What It Answers |
|-----|----------------|
| [../README.md](../README.md) | Project overview, setup instructions, tech stack |
| [../OVERVIEW.md](../OVERVIEW.md) | Non-technical explanation of the entire project |
| [STATUS.md](./STATUS.md) | What has been built? What's broken? What % is done? |
| [TASKS.md](./TASKS.md) | What should I build RIGHT NOW? (Current sprint) |
| [BACKLOG.md](./BACKLOG.md) | What comes after? (Future sprints) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How should I write the code? Patterns, conventions, contracts |
| [CONTEXT.md](./CONTEXT.md) | Why are we building this? What must the demo show? |

---

## Current Build State — Snapshot (Updated 2026-03-17)

| Sprint | Status | Key Blocker |
|--------|--------|-------------|
| Week 1: Foundation | Done | — |
| Week 2: Core Features | Done | — |
| Week 2.5: Governance (SentinelAI) | Done | — |
| Week 3: Intelligence | Done | — |
| Week 4: Polish | Done | — |

**Overall: ~100% complete — fully functional demo-ready product**

Key milestones achieved:
- All 4 AI agents fully implemented with real Gemini LLM reasoning
- LangGraph parallel orchestration working
- Human-in-the-loop governance (approve/reject with auto-approve countdown)
- Multi-agent negotiation protocol live
- Chat with natural language queries and what-if analysis
- Chaos engine with 4 injection types
- 6 simulation scenarios including choreographed 3-minute demo
- Full dark glassmorphism UI redesign (shadcn/ui + Aceternity UI)
- 16/16 backend tests passing, 0 TypeScript errors

---

## 60-Second Orientation for Any Model

1. **Frontend is done.** All 6 pages with shadcn/ui + Aceternity UI dark theme, Zustand store, WebSocket client, approve/reject buttons, guardrail badges, auto-approve countdown, animated components.

2. **Backend is done.** All 4 agents (Queue Balancer, Predictive Prevention, Escalation Handler, Analytics) powered by Gemini 2.5 Flash Lite with 4-tier LLM fallback. LangGraph parallel orchestrator, negotiation protocol, guardrails layer.

3. **LLM**: Google Gemini 2.5 Flash Lite (primary) via `google-genai` SDK. Falls back to Anthropic > AWS Bedrock > MockLLM. Config in `backend/.env` with `GEMINI_API_KEY`.

4. **Critical gotcha**: Backend uses `snake_case`, frontend needs `camelCase`. Fixed via `CamelModel` base class — always serialize with `.model_dump(by_alias=True, mode="json")`.

5. **Simulation-first**. All demos run on the built-in simulation engine. Real AWS Connect is optional.

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
