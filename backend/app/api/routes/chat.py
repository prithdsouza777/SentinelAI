import re

from fastapi import APIRouter, HTTPException
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


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def send_message(request: ChatRequest):
    """Send message to conversational interface.

    Messages are screened for prompt injection before reaching the LLM.
    Adversarial inputs are blocked and logged to the audit trail.
    """
    matched = _detect_injection(request.message)
    if matched:
        # Log to audit trail as a security event
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

    # TODO: Route to Analytics Agent / NL Policy Engine via Bedrock
    return {
        "message": f"Received: {request.message}. AI processing not yet connected.",
        "reasoning": "Placeholder — Bedrock integration pending.",
    }


@router.post("/chat/policy")
async def create_policy(request: PolicyRequest):
    """Create a natural language policy rule."""
    # TODO: Parse NL rule, store in DynamoDB
    return {"id": "policy-placeholder", "rule": request.rule, "status": "created"}


@router.get("/chat/policies")
async def list_policies():
    """List active NL-defined policies."""
    # TODO: Pull from DynamoDB
    return {"policies": []}


@router.delete("/chat/policies/{policy_id}")
async def delete_policy(policy_id: str):
    """Remove a policy."""
    # TODO: Delete from DynamoDB
    return {"policy_id": policy_id, "status": "deleted"}
