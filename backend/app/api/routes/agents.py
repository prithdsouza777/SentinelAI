from fastapi import APIRouter, Query, Request

from app.agents.guardrails import guardrails

router = APIRouter()

# Static AI agent registry — these are the SentinelAI AI agents, not AWS Connect human agents
_AI_AGENTS = [
    {
        "type": "queue_balancer",
        "name": "Queue Balancer",
        "status": "active",
        "description": "Monitors queue pressure and autonomously rebalances agents between queues",
    },
    {
        "type": "predictive_prevention",
        "name": "Predictive Prevention",
        "status": "active",
        "description": "Tracks contact velocity trends to predict spikes 60 seconds before they peak",
    },
    {
        "type": "escalation_handler",
        "name": "Escalation Handler",
        "status": "active",
        "description": "Routes critical alerts to human supervisors and triggers emergency protocols",
    },
    {
        "type": "skill_router",
        "name": "Skill-Based Router",
        "status": "active",
        "description": "Routes incoming contacts to best-match agents using skill overlap, experience, and performance scoring",
    },
    {
        "type": "analytics",
        "name": "Analytics Agent",
        "status": "pending",
        "description": "Answers natural language questions about system state via Amazon Bedrock",
    },
]


@router.get("/agents")
async def list_agents():
    """List all SentinelAI AI agents with their current status."""
    return {"agents": _AI_AGENTS}


@router.get("/agents/decisions")
async def get_decisions(request: Request):
    """Get the AI agent decision log with reasoning chains."""
    return {"decisions": request.app.state.recent_decisions}


@router.get("/agents/negotiations")
async def get_negotiations(request: Request):
    """Get inter-agent negotiation history."""
    return {"negotiations": request.app.state.recent_negotiations}


@router.get("/agents/audit")
async def get_audit_log(limit: int = Query(default=100, le=500)):
    """Return the immutable audit trail of agent decisions and outcomes.

    Includes guardrail results, policy violations, approval status, and
    execution outcomes. Suitable for compliance export.
    """
    entries = guardrails.get_audit_log(limit=limit)
    return {
        "entries": [e.model_dump(mode="json") for e in entries],
        "total": len(guardrails._audit_log),
    }


@router.get("/agents/governance")
async def get_governance_summary():
    """Return the current governance scorecard snapshot."""
    return guardrails.get_governance_summary()


@router.get("/cost-impact")
async def get_cost_impact(request: Request):
    """Return the running cost impact summary."""
    from datetime import datetime, timezone
    from app.agents.orchestrator import orchestrator
    return {
        "totalSaved": round(orchestrator._total_saved, 2),
        "revenueAtRisk": round(orchestrator._revenue_at_risk, 2),
        "totalPreventedAbandoned": orchestrator._prevented_abandoned,
        "actionsToday": orchestrator._actions_today,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/actions/log")
async def get_action_log(request: Request):
    """Return executed AI agent action history."""
    executed = [
        d for d in request.app.state.recent_decisions
        if d.get("approved") is True or d.get("guardrailResult") == "AUTO_APPROVE"
    ]
    return {"actions": executed}
