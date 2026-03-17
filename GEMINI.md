# SentinelAI — AI Model Handoff Context

> This file provides context for any AI model (Gemini, Claude, etc.) picking up this project.
> Read `docs/INDEX.md` for the full documentation map.

---

## Quick Facts

| Item | Detail |
|------|--------|
| Project | SentinelAI — Autonomous AI Operations Layer for AWS Connect |
| Company | CirrusLabs (cirruslabs.io) |
| Status | Fully functional, demo-ready |
| Frontend | React 18 + TypeScript + Zustand 5 + TailwindCSS + shadcn/ui + Aceternity UI |
| Backend | Python 3.10 + FastAPI + LangGraph 1.1.2 |
| LLM | Gemini 2.5 Flash Lite (google-genai SDK v1.67) with 3-tier fallback |
| Tests | 16/16 passing (backend), 0 TypeScript errors (frontend) |
| Branch | `Azaz/add-features` off `main` |

---

## How to Run

```bash
cd SentinelAI
npm install
npm run dev     # starts frontend (:5173) + backend (:8000)
```

Environment: `backend/.env` needs `GEMINI_API_KEY` for live AI. Without it, falls back to mock responses.

---

## Architecture

- **3-second tick loop** in `backend/app/main.py` drives everything
- **LangGraph orchestrator** runs 3 agents in parallel, then conditional negotiation
- **4-tier LLM fallback**: Gemini > Anthropic > AWS Bedrock > MockLLM
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9, 30s timeout), BLOCKED (<0.7)
- **WebSocket** broadcasts all events to frontend in real time
- **Simulation-first**: all demo data is generated, real AWS Connect is optional

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app + background tick loop |
| `backend/app/agents/orchestrator.py` | LangGraph parallel agent orchestration |
| `backend/app/agents/queue_balancer.py` | Queue rebalancing agent |
| `backend/app/agents/predictive_prevention.py` | Cascade risk detection |
| `backend/app/agents/escalation_handler.py` | Critical alert response |
| `backend/app/agents/analytics.py` | NL query agent for chat |
| `backend/app/agents/negotiation.py` | Multi-agent conflict resolution |
| `backend/app/services/bedrock.py` | LLM service (Gemini/Anthropic/Bedrock/Mock) |
| `backend/app/services/simulation.py` | Contact center simulation engine |
| `backend/app/api/websocket.py` | Bidirectional WebSocket manager |
| `frontend/src/stores/dashboardStore.ts` | Frontend state hub |
| `frontend/src/services/websocket.ts` | WebSocket client |

## Critical Convention

Backend Python uses `snake_case`. Frontend TypeScript uses `camelCase`. The `CamelModel` base class and `model_dump(by_alias=True, mode="json")` handle conversion automatically. Never send raw snake_case dicts to the frontend.
