# SentinelAI — AI Model Handoff Context

> This file provides context for any AI model (Gemini, Claude, etc.) picking up this project.
> For full context including all changes, architecture, and remaining work, read `docs/INDEX.md`.

---

## Quick Facts

| Item | Detail |
|------|--------|
| Project | SentinelAI — Autonomous AI Operations Layer for AWS Connect |
| Company | CirrusLabs (cirruslabs.io) |
| Status | Fully functional, demo-ready — Added Email Report with PDF Attachment |
| Frontend | React 18 + TypeScript + Zustand 5 + TailwindCSS 3 + shadcn/ui + Recharts + Framer Motion + jspdf + html2canvas |
| Backend | Python 3.10 + FastAPI + LangGraph 1.1.2 |
| LLM | 3-tier: AWS Bedrock (primary) > Anthropic API (fallback) > NoKeyLLM (no-key) |
| Tests | 20/20 passing (backend), 0 TypeScript errors (frontend) |
| UI Theme | Dark + Light toggle — dark glassmorphism default, CirrusLabs light palette option |
| Branch | `pritham/bedrock` (Bedrock integration) |
| Pages | 10 (Landing, Login, Dashboard, Agents, Workforce, Alerts, Chat, Simulation, Reports, Settings) |

---

## How to Run

```bash
cd SentinelAI
npm install
npm run dev     # starts frontend (:5173) + backend (:8000)
```

**Python**: Must use Python 3.10-3.12. Venv at `backend/.venv/`. Python 3.14 breaks pydantic-core.
**Environment**: `backend/.env` — set AWS credentials for Bedrock (primary) or `ANTHROPIC_API_KEY` for Anthropic API (fallback). Without either, NoKeyLLM shows setup instructions.

---

## Architecture

- **3-second tick loop** in `backend/app/main.py` drives everything
- **LangGraph orchestrator** runs **4 agents in parallel**, then conditional negotiation
- **5 Agents**: QueueBalancer, PredictivePrevention, EscalationHandler, SkillRouter, Analytics
- **3-tier LLM fallback**: AWS Bedrock (Converse API) > Anthropic API > NoKeyLLM
- **Bedrock Converse API**: Native tool-use, conversation memory (30 messages), 5-round tool loops, 3s agent timeout
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9, 30s timeout), BLOCKED (<0.7)
- **Skill Router**: Zero-LLM latency, proficiency-weighted scoring from agent database
- **Agent Proficiency DB**: SQLite (`agents.db`) — 24 human agents, 12 skills, 5 departments, fitness scoring
- **Real-time**: WebSocket (primary) + SSE fallback (`/api/stream`) + HTTP action fallback (`/api/ws-action`)
- **WebSocket keep-alive**: Server-side ping every 20s, client pong response
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
| `backend/app/services/bedrock.py` | LLM service (Bedrock > Anthropic API > NoKeyLLM) |
| `backend/app/services/simulation.py` | Contact center simulation engine |
| `backend/app/api/routes/reports.py` | `GET /api/reports/session` — session export |
| `backend/app/api/routes/reports.py` | `POST /api/reports/email` — Email report with PDF attachment |
| `backend/app/services/notifications.py`| SMTP email delivery with attachment support |
| `backend/app/api/routes/history.py` | `GET /api/metrics/history` — trending data |
| `backend/app/api/websocket.py` | Bidirectional WebSocket manager |
| `frontend/src/App.tsx` | Route definitions (10 routes) |
| `frontend/src/stores/dashboardStore.ts` | Frontend state hub |
| `frontend/src/services/websocket.ts` | WebSocket client |
| `frontend/src/pages/ReportsPage.tsx` | Reports dashboard with Recharts charts |
| `frontend/src/pages/LandingPage.tsx` | Animated landing page with hero + features |
| `frontend/src/pages/LoginPage.tsx` | Authentication gate |
| `frontend/src/pages/WorkforcePage.tsx` | Human agent profiles, skills, department fitness |
| `frontend/src/stores/workforceStore.ts` | Workforce state (search, filters, agent selection) |
| `backend/app/services/agent_database.py` | SQLite-backed workforce DB (24 agents, 12 skills) |
| `backend/app/models/proficiency.py` | SkillProficiency, DepartmentFitness, HumanAgentProfile |

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
| POST | `/api/reports/email` | Email session report (HTML + PDF attachment) |
| GET | `/api/agents/human/by-department/{dept_id}` | Agents ranked by department fitness |
| POST | `/api/ws-action` | HTTP fallback for client-to-server WS actions |
| GET | `/api/stream` | SSE fallback for real-time events |
| POST | `/api/reports/email` | Email current session report (HTML + PDF attachment) |

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
4. Python venv at `backend/.venv/` — never use system Python 3.14.
5. LLM service in `bedrock.py` now uses AWS Bedrock Converse API (primary), Anthropic direct API (fallback), NoKeyLLM (no-key).

## Remaining Work (Optional)

- [x] AWS Bedrock integration with Converse API (3-tier fallback chain)
- [x] SSE fallback for WebSocket (App Runner / proxy compatibility)
- [x] HTTP action fallback endpoint (`/api/ws-action`)
- [x] WebSocket ping/pong keep-alive (20s interval)
- [x] PDF export for emailed reports (via jspdf/html2canvas)
- [ ] AWS Connect integration (even partial API call strengthens demo)
- [x] Email Report with PDF attachment
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
