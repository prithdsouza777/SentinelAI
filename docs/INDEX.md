# SentinelAI — Docs Index
> **Any model picking up this project: start here. This file is the map.**

---

## Navigation

| Doc | What It Answers |
|-----|----------------|
| [STATUS.md](./STATUS.md) | What has been built? What's broken? What % is done? |
| [TASKS.md](./TASKS.md) | What should I build RIGHT NOW? (Current sprint W1) |
| [BACKLOG.md](./BACKLOG.md) | What comes after? (Sprints W2, W3, W4) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How should I write the code? Patterns, conventions, contracts |
| [CONTEXT.md](./CONTEXT.md) | Why are we building this? What must the demo show? |

---

## Current Build State — Snapshot (Updated 2026-03-11)

| Sprint | Status | Key Blocker |
|--------|--------|-------------|
| Week 1: Foundation | ✅ DONE | — |
| Week 2: Core Features | ✅ DONE | — |
| Week 2.5: Governance (SentinelAI) | ✅ DONE | — |
| Week 3: Intelligence | 🟡 IN PROGRESS | Bedrock + Analytics Agent + Chat |
| Week 4: Polish | ⬜ NOT STARTED | Blocked on W3 |

**Overall: ~85% complete**
→ Full breakdown in [STATUS.md](./STATUS.md)

---

## The Single Most Important Task Right Now

**Build the Bedrock/MockLLM service and wire the Analytics Agent + Chat route** — needed for the "What just happened?" moment in the 3-minute demo.

→ See [BACKLOG.md](./BACKLOG.md) — Tasks **W3-1** (Bedrock), **W3-2** (Analytics Agent + Chat)

---

## 60-Second Orientation for Any Model

1. **Frontend is done.** All 6 pages, Zustand store, WebSocket client, TypeScript types, confidence bars, approve/reject buttons, governance scorecard — complete.

2. **Backend agents/orchestrator/governance are done.** Queue Balancer, Predictive Prevention, Escalation Handler, Negotiation Protocol, GuardrailsLayer (SentinelAI), full orchestrator with revenue-at-risk tracking — all complete.

3. **What's left:** Bedrock service (with MockLLM fallback), Analytics Agent real implementation, Chat route wiring, scripted demo scenario, NL policy engine.

4. **Critical gotcha**: Backend uses `snake_case`, frontend needs `camelCase`. Fixed via `CamelModel` base class — always serialize with `.model_dump(by_alias=True, mode="json")`.

5. **Simulation-first**. Real AWS Connect is Week 4 optional. All demos run on the built-in simulation engine.

---

## How to Run the Project

```bash
# From C:\Users\prith\Downloads\Buildathon

npm run dev              # frontend (:5173) + backend (:8000) concurrently
cd backend && pytest     # run tests
```

**Backend**: http://localhost:8000
**Frontend**: http://localhost:5173
**API docs**: http://localhost:8000/docs
**WebSocket**: ws://localhost:8000/ws/dashboard

---

## Document Update Protocol

When you finish a task:
1. In [TASKS.md](./TASKS.md) — change task status from `TODO` → `DONE`
2. In [STATUS.md](./STATUS.md) — update the component's % and status
3. In this file — update the sprint status row above if a sprint completes

When you start a new session:
1. Read this file first
2. Read [STATUS.md](./STATUS.md) to see current state
3. Read [TASKS.md](./TASKS.md) and find the first `TODO` task
4. Read the relevant section in [ARCHITECTURE.md](./ARCHITECTURE.md) before coding
