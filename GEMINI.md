# SentinelAI — AI Model Handoff Context

> This file provides context for any AI model (Gemini, Claude, etc.) picking up this project.
> For full context including all changes, architecture, and remaining work, read `docs/INDEX.md` or the persistent context file at `.gemini/antigravity/brain/*/context.md`.

---

## Quick Facts

| Item | Detail |
|------|--------|
| Project | SentinelAI — Autonomous AI Operations Layer for AWS Connect |
| Company | CirrusLabs (cirruslabs.io) |
| Status | Fully functional, demo-ready |
| Frontend | React 18 + TypeScript + Zustand 5 + TailwindCSS 3 + shadcn/ui + Recharts |
| Backend | Python 3.10 + FastAPI + LangGraph 1.1.2 |
| LLM | Gemini 2.5 Flash Lite (google-genai SDK v1.67) with 4-tier fallback |
| Tests | 19/19 passing (backend), 0 TypeScript errors (frontend) |
| UI Theme | CirrusLabs light palette — navy sidebar (#172554), white content (#f9fafb) |
| Branch | `Azaz/add-features` off `main` |

---

## How to Run

```bash
cd SentinelAI
npm install
npm run dev     # starts frontend (:5173) + backend (:8000)
```

**Python**: Must use Python 3.10-3.12. Venv at `backend/.venv310/`. Python 3.14 breaks pydantic-core.
**Environment**: `backend/.env` needs `GEMINI_API_KEY` for live AI. Without it, falls back to mock responses.

---

## Architecture

- **3-second tick loop** in `backend/app/main.py` drives everything
- **LangGraph orchestrator** runs **4 agents in parallel**, then conditional negotiation
- **4 Agents**: QueueBalancer, PredictivePrevention, EscalationHandler, **SkillRouter**
- **4-tier LLM fallback**: Gemini > Anthropic > AWS Bedrock > MockLLM
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9, 30s timeout), BLOCKED (<0.7)
- **Skill Router**: Zero-LLM latency, weighted scoring (skill_match 40% + perf 25% + exp 20% + load 15%)
- **WebSocket** broadcasts all events to frontend in real time
- **Simulation-first**: all demo data is generated, real AWS Connect is optional

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app + background tick loop + metrics history |
| `backend/app/agents/orchestrator.py` | LangGraph parallel agent orchestration (4 agents) |
| `backend/app/agents/queue_balancer.py` | Queue rebalancing agent |
| `backend/app/agents/predictive_prevention.py` | Cascade risk detection |
| `backend/app/agents/escalation_handler.py` | Critical alert response |
| `backend/app/agents/skill_router.py` | Skill-based contact routing (zero-LLM) |
| `backend/app/agents/analytics.py` | NL query agent for chat |
| `backend/app/agents/negotiation.py` | Multi-agent conflict resolution |
| `backend/app/agents/guardrails.py` | Action scopes, rate limits, approval logic |
| `backend/app/services/bedrock.py` | LLM service (Gemini/Anthropic/Bedrock/Mock) |
| `backend/app/services/simulation.py` | Contact center simulation engine |
| `backend/app/api/routes/reports.py` | `GET /api/reports/session` — session export |
| `backend/app/api/routes/history.py` | `GET /api/metrics/history` — trending data |
| `backend/app/api/websocket.py` | Bidirectional WebSocket manager |
| `frontend/src/stores/dashboardStore.ts` | Frontend state hub |
| `frontend/src/services/websocket.ts` | WebSocket client |
| `frontend/src/pages/ReportsPage.tsx` | Reports dashboard with 7 Recharts charts |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/queues` | List all queues + metrics |
| GET | `/api/agents` | List all agents (including skill_router) |
| GET | `/api/alerts` | List active alerts |
| GET | `/api/agents/decisions` | Recent AI decisions |
| POST | `/api/chat` | NL analytics query |
| POST | `/api/simulation/start` | Start demo scenario |
| POST | `/api/simulation/stop` | Stop simulation |
| GET | `/api/reports/session` | Generate session report (JSON) |
| GET | `/api/metrics/history` | Historical metrics time-series |
| GET | `/api/governance/summary` | Governance scorecard |
| GET | `/api/cost-impact` | Cost impact summary |
| POST | `/api/whatif` | What-if scenario analysis |

## UI Color Palette (CirrusLabs)

- **Sidebar**: Navy `#172554`, borders `#1e40af`, hover `#1e3a8a`
- **Content**: White `#f9fafb`, cards `#ffffff`, borders `#e2e8f0`
- **Text**: Primary `#1e293b`, muted `#64748b`, labels `#475569`
- **Charts**: Blue `#2563eb`, info `#3b82f6`, green `#10b981`, amber `#f59e0b`, red `#ef4444`
- **Scrollbar**: Track `#f1f1f1`, thumb `#c1c1c1`, hover `#a8a8a8`

## Critical Conventions

1. Backend Python uses `snake_case`. Frontend TypeScript uses `camelCase`. The `CamelModel` base class and `model_dump(by_alias=True, mode="json")` handle conversion automatically. Never send raw snake_case dicts to the frontend.
2. Skill Router intentionally avoids LLM calls for minimum latency in the tick loop.
3. All chart colors must use the CirrusLabs palette defined above.
4. Python venv at `backend/.venv310/` — never use system Python 3.14.

## Remaining Work

- [ ] Full light-theme cleanup pass on remaining pages (OperationsCenter, Agents, Alerts, Chat, Simulation, Settings)
- [ ] AWS Connect integration (even partial API call strengthens demo)
- [ ] Real-time trending chart on main dashboard using `/api/metrics/history`
- [ ] PDF export for reports (currently JSON only)
- [ ] Unit tests for skill_router.py agent logic
