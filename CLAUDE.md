# CLAUDE.md — Claude Code Context for SentinelAI

## Project

SentinelAI — Autonomous AI Operations Layer for AWS Connect.
Built by CirrusLabs for the 2026 Internal Buildathon.

## Quick Start

```bash
npm install && npm run dev   # frontend :5173, backend :8000
```

Backend requires Python 3.10-3.12. Venv: `backend/.venv310/`.
Set `ANTHROPIC_API_KEY` in `backend/.env` for live AI; falls back to MockLLM without it.

## Architecture

- **3s tick loop** in `backend/app/main.py` drives simulation + agent orchestration
- **5 agents** via LangGraph: QueueBalancer, PredictivePrevention, EscalationHandler, SkillRouter, Analytics
- **LLM**: Anthropic Claude (primary) > MockLLM (fallback). Service in `backend/app/services/bedrock.py`
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9, 30s auto-approve), BLOCKED (<0.7)
- **Frontend**: React 18 + TypeScript + Zustand 5 + shadcn/ui + Framer Motion
- **9 pages**: Landing, Login, Dashboard, Agents, Alerts, Chat, Simulation, Reports, Settings
- **19 backend tests** in `backend/tests/test_health.py`

## Key Conventions

- **Serialization**: Backend snake_case, frontend camelCase. Always use `model_dump(by_alias=True, mode="json")`.
- **Singletons**: Import `simulation_engine`, `anomaly_engine`, `manager`, `orchestrator` — never create new instances.
- **Pydantic v2**: Use `model_dump()` not `.dict()`, `model_validate()` not `.parse_obj()`.
- **No circular imports**: Routes access shared state via `request.app.state`, not by importing from `main.py`.

## Common Commands

```bash
cd backend && .venv310/Scripts/python.exe -m pytest tests/ -v   # run tests
cd frontend && npx tsc --noEmit                                  # typecheck
```

## Post-Change Documentation Rule

After completing any code changes, you MUST update the relevant project documentation to keep it in sync:

1. **If you add/remove/rename agents, pages, routes, tests, or services** — update `GEMINI.md` (Quick Facts table + Key Files + API Endpoints), `README.md` (project structure + tech details), `OVERVIEW.md` (page/agent descriptions), and `docs/STATUS.md` (summary table + test list).
2. **If you change architecture** (tick interval, LLM provider, guardrail thresholds, orchestrator flow) — update `GEMINI.md` (Architecture section), `CLAUDE.md` (Architecture section), `docs/ARCHITECTURE.md`, and `docs/CONTEXT.md`.
3. **If you add new dependencies** — update `README.md` (Tech Stack table) and `GEMINI.md` (Quick Facts).
4. **If you fix bugs or add features** — update `docs/STATUS.md` (demo readiness table) and `GEMINI.md` (Remaining Work).
5. **Always update the "Updated" date** in `docs/STATUS.md` and `docs/INDEX.md` when modifying them.

The full list of docs to keep in sync:
- `CLAUDE.md` — Claude Code context (this file)
- `GEMINI.md` — AI model handoff context
- `README.md` — Public project overview
- `OVERVIEW.md` — Non-technical explanation
- `docs/INDEX.md` — Docs navigation + snapshot
- `docs/STATUS.md` — Build status tracker
- `docs/ARCHITECTURE.md` — Code patterns and conventions
- `docs/CONTEXT.md` — Product vision and decisions
