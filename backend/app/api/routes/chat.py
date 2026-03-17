import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.guardrails import guardrails
from app.models.guardrails import AuditEntry, GuardrailStatus

router = APIRouter()

# ── Prompt injection / adversarial input patterns ────────────────────────────

_INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all|prior)\s+instructions",
    r"you\s+are\s+now\b",
    r"act\s+as\s+(a|an)\b",
    r"\bjailbreak\b",
    r"system\s+prompt",
    r"override\s+(your|all|the)\b",
    r"forget\s+(everything|your|all)\b",
    r"disregard\s+(previous|all|the)\b",
    r"new\s+persona\b",
    r"DAN\s+mode",
]

_COMPILED_INJECTIONS = [
    re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS
]


def _detect_injection(message: str) -> str | None:
    """Return the matched pattern description if injection detected, else None."""
    for pattern in _COMPILED_INJECTIONS:
        if pattern.search(message):
            return pattern.pattern
    return None


# ── Request/response models ───────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str


class PolicyRequest(BaseModel):
    rule: str


# ── Context builder ──────────────────────────────────────────────────────────


def _build_chat_context(request: Request) -> dict:
    """Extract live system state from app.state for the Analytics Agent."""
    context: dict = {}
    try:
        context["recent_alerts"] = list(getattr(request.app.state, "recent_alerts", []))[:20]
        context["recent_decisions"] = list(getattr(request.app.state, "recent_decisions", []))[:15]
        context["queue_metrics"] = list(getattr(request.app.state, "latest_metrics", {}).values())
        context["recent_negotiations"] = list(getattr(request.app.state, "recent_negotiations", []))[:5]

        # Cost data from orchestrator
        from app.agents.orchestrator import orchestrator
        context["cost_data"] = {
            "totalSaved": orchestrator._total_saved,
            "revenueAtRisk": orchestrator._revenue_at_risk,
            "totalPreventedAbandoned": orchestrator._prevented_abandoned,
            "actionsToday": orchestrator._actions_today,
        }

        # Governance snapshot
        context["governance"] = guardrails.get_governance_summary()
    except Exception:
        pass
    return context


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def send_message(body: ChatRequest, request: Request):
    """Send message to conversational interface.

    Messages are screened for prompt injection before reaching the LLM.
    Adversarial inputs are blocked and logged to the audit trail.
    """
    matched = _detect_injection(body.message)
    if matched:
        import uuid
        from datetime import datetime
        from app.models.agent import AgentType
        entry = AuditEntry(
            id=str(uuid.uuid4()),
            decision_id=f"chat-{uuid.uuid4()}",
            agent_type=AgentType.ANALYTICS,
            action="chat_input",
            confidence=0.0,
            risk_score=1.0,
            guardrail_result=GuardrailStatus.BLOCKED,
            policy_violations=[f"prompt_injection: matched pattern '{matched}'"],
            approved_by=None,
            execution_result="blocked",
        )
        guardrails._append_audit(entry)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Potentially adversarial input detected",
                "reason": "Message matches prompt injection pattern",
            },
        )

    from app.agents.analytics import analytics_agent
    from app.services.sanitizer import sanitize_string

    sanitized_message = sanitize_string(body.message)
    context = _build_chat_context(request)
    result = await analytics_agent.query(sanitized_message, context)

    return {
        "message": result["message"],
        "reasoning": result.get("reasoning", ""),
        "timestamp": result.get("timestamp", ""),
    }


# ── In-memory NL policy store ────────────────────────────────────────────────

_policies: list[dict] = []
_next_policy_id = 1


@router.post("/chat/policy")
async def create_policy(body: PolicyRequest):
    """Create a natural language policy rule."""
    global _next_policy_id
    from datetime import datetime, timezone

    policy = {
        "id": f"policy-{_next_policy_id}",
        "rule": body.rule,
        "status": "active",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _policies.append(policy)
    _next_policy_id += 1
    return policy


@router.get("/chat/policies")
async def list_policies():
    """List active NL-defined policies."""
    return {"policies": [p for p in _policies if p["status"] == "active"]}


@router.delete("/chat/policies/{policy_id}")
async def delete_policy(policy_id: str):
    """Remove a policy."""
    for p in _policies:
        if p["id"] == policy_id:
            p["status"] = "deleted"
            return {"policy_id": policy_id, "status": "deleted"}
    raise HTTPException(status_code=404, detail="Policy not found")
