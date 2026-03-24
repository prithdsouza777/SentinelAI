# SentinelAI — AI Model Handoff Context

> This file provides context for any AI model (Gemini, Claude, etc.) picking up this project.
> For full context including all changes, architecture, and remaining work, read `docs/INDEX.md`.

---

## Quick Facts

| Item | Detail |
|------|--------|
| Project | SentinelAI — Autonomous AI Operations Layer for AWS Connect |
| Company | CirrusLabs (cirruslabs.io) |
| Status | Fully functional, demo-ready |
| Frontend | React 18 + TypeScript + Zustand 5 + TailwindCSS 3 + shadcn/ui + Recharts + Framer Motion |
| Backend | Python 3.10 + FastAPI + LangGraph 1.1.2 |
| LLM | Anthropic Claude (claude-sonnet-4-20250514) primary, MockLLM fallback |
| Tests | 19/19 passing (backend), 0 TypeScript errors (frontend) |
| UI Theme | Dark + Light toggle — dark glassmorphism default, CirrusLabs light palette option |
| Branch | `main` |
| Pages | 9 (Landing, Login, Dashboard, Agents, Alerts, Chat, Simulation, Reports, Settings) |

---

## How to Run

```bash
cd SentinelAI
npm install
npm run dev     # starts frontend (:5173) + backend (:8000)
```

**Python**: Must use Python 3.10-3.12. Venv at `backend/.venv310/`. Python 3.14 breaks pydantic-core.
**Environment**: `backend/.env` needs `ANTHROPIC_API_KEY` for live AI. Without it, falls back to mock responses.

---

## Architecture

- **3-second tick loop** in `backend/app/main.py` drives everything
- **LangGraph orchestrator** runs **4 agents in parallel**, then conditional negotiation
- **5 Agents**: QueueBalancer, PredictivePrevention, EscalationHandler, SkillRouter, Analytics
- **2-tier LLM fallback**: Anthropic Claude > MockLLM (context-aware dynamic responses)
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9, 30s timeout), BLOCKED (<0.7)
- **Skill Router**: Zero-LLM latency, weighted scoring (skill_match 40% + perf 25% + exp 20% + load 15%)
- **WebSocket** broadcasts all events to frontend in real time
- **Simulation-first**: all demo data is generated, real AWS Connect is optional

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app + background tick loop + metrics history |
| `backend/app/agents/orchestrator.py` | LangGraph parallel agent orchestration (5 agents) |
| `backend/app/agents/queue_balancer.py` | Queue rebalancing agent |
| `backend/app/agents/predictive_prevention.py` | Cascade risk detection |
| `backend/app/agents/escalation_handler.py` | Critical alert response |
| `backend/app/agents/skill_router.py` | Skill-based contact routing (zero-LLM) |
| `backend/app/agents/analytics.py` | NL query agent for chat |
| `backend/app/agents/negotiation.py` | Multi-agent conflict resolution |
| `backend/app/agents/guardrails.py` | Action scopes, rate limits, approval logic |
| `backend/app/services/bedrock.py` | LLM service (Anthropic Claude / MockLLM) |
| `backend/app/services/simulation.py` | Contact center simulation engine |
| `backend/app/api/routes/reports.py` | `GET /api/reports/session` — session export |
| `backend/app/api/routes/history.py` | `GET /api/metrics/history` — trending data |
| `backend/app/api/websocket.py` | Bidirectional WebSocket manager |
| `frontend/src/App.tsx` | Route definitions (9 routes) |
| `frontend/src/stores/dashboardStore.ts` | Frontend state hub |
| `frontend/src/services/websocket.ts` | WebSocket client |
| `frontend/src/pages/ReportsPage.tsx` | Reports dashboard with Recharts charts |
| `frontend/src/pages/LandingPage.tsx` | Animated landing page with hero + features |
| `frontend/src/pages/LoginPage.tsx` | Authentication gate |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/queues` | List all queues + metrics |
| GET | `/api/agents` | List all agents (including skill_router) |
| GET | `/api/alerts` | List active alerts |
| GET | `/api/agents/decisions` | Recent AI decisions |
| GET | `/api/agents/governance` | Governance scorecard |
| POST | `/api/chat` | NL analytics query |
| POST | `/api/simulation/start` | Start demo scenario |
| POST | `/api/simulation/stop` | Stop simulation |
| GET | `/api/simulation/scenarios` | List 6 scenarios |
| GET | `/api/simulation/status` | Simulation state |
| POST | `/api/simulation/chaos` | Inject chaos event |
| POST | `/api/simulation/whatif` | What-if analysis |
| GET | `/api/reports/session` | Generate session report (JSON) |
| GET | `/api/metrics/history` | Historical metrics time-series |
| GET | `/api/cost-impact` | Cost impact summary |

## UI Color Palette (CirrusLabs)

- **Sidebar**: Navy `#172554`, borders `#1e40af`, hover `#1e3a8a`
- **Content (light)**: White `#f9fafb`, cards `#ffffff`, borders `#e2e8f0`
- **Content (dark)**: Deep navy `#0a0f1e`, cards with glassmorphism
- **Text**: Primary `#1e293b`, muted `#64748b`, labels `#475569`
- **Charts**: Blue `#2563eb`, info `#3b82f6`, green `#10b981`, amber `#f59e0b`, red `#ef4444`

## Critical Conventions

1. Backend Python uses `snake_case`. Frontend TypeScript uses `camelCase`. The `CamelModel` base class and `model_dump(by_alias=True, mode="json")` handle conversion automatically. Never send raw snake_case dicts to the frontend.
2. Skill Router intentionally avoids LLM calls for minimum latency in the tick loop.
3. All chart colors must use the CirrusLabs palette defined above.
4. Python venv at `backend/.venv310/` — never use system Python 3.14.
5. LLM service in `bedrock.py` uses Anthropic direct API (not AWS Bedrock despite filename).

## Remaining Work (Optional)

- [ ] AWS Connect integration (even partial API call strengthens demo)
- [ ] Real-time trending chart on main dashboard using `/api/metrics/history`
- [ ] PDF export for reports (currently JSON only)
- [ ] Unit tests for skill_router.py agent logic
- [ ] Gemini LLM provider (google-genai SDK installed but not wired)

---

## Post-Change Documentation Rule

After completing any code changes, you MUST update the relevant project documentation to keep it in sync. Stale docs cause confusion for every model and team member that picks up this project.

### What to update and when:

1. **Added/removed/renamed agents, pages, routes, tests, or services?**
   - Update: `GEMINI.md` (Quick Facts + Key Files + API Endpoints), `README.md` (project structure + tech details), `OVERVIEW.md` (page/agent descriptions), `docs/STATUS.md` (summary table + test list)

2. **Changed architecture?** (tick interval, LLM provider, guardrail thresholds, orchestrator flow)
   - Update: `GEMINI.md` (Architecture), `CLAUDE.md` (Architecture), `docs/ARCHITECTURE.md`, `docs/CONTEXT.md`

3. **Added new dependencies?**
   - Update: `README.md` (Tech Stack table), `GEMINI.md` (Quick Facts)

4. **Fixed bugs or added features?**
   - Update: `docs/STATUS.md` (demo readiness table), `GEMINI.md` (Remaining Work)

5. **Always update the "Updated" date** in `docs/STATUS.md` and `docs/INDEX.md` when modifying them.

### Full doc inventory:
| File | Purpose | Update frequency |
|------|---------|-----------------|
| `CLAUDE.md` | Claude Code context | On architecture/convention changes |
| `GEMINI.md` | AI model handoff (this file) | On any structural change |
| `README.md` | Public project overview | On any user-visible change |
| `OVERVIEW.md` | Non-technical explanation | On feature/page/agent changes |
| `docs/INDEX.md` | Docs navigation + snapshot | On milestone completions |
| `docs/STATUS.md` | Build status tracker | On any backend/frontend change |
| `docs/ARCHITECTURE.md` | Code patterns and conventions | On architecture/pattern changes |
| `docs/CONTEXT.md` | Product vision and decisions | On design decision changes |
