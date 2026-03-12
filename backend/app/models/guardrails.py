"""Guardrail models — AI Firewall for agent decisions.

GuardrailResult  : outcome of evaluating a decision through policies
AuditEntry       : immutable record of every decision + outcome
GuardrailPolicy  : a named hard rule that can block or flag decisions
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.agent import AgentType


class GuardrailStatus(str, Enum):
    AUTO_APPROVE = "AUTO_APPROVE"
    PENDING_HUMAN = "PENDING_HUMAN"
    BLOCKED = "BLOCKED"


class GuardrailPolicy(BaseModel):
    name: str
    description: str
    enabled: bool = True


class GuardrailResult(BaseModel):
    status: GuardrailStatus
    decision_id: str
    policy_violations: list[str] = []
    reason: str = ""


class AuditEntry(BaseModel):
    id: str
    decision_id: str
    agent_type: AgentType
    action: str
    confidence: float
    risk_score: float
    guardrail_result: str           # GuardrailStatus value
    policy_violations: list[str] = []
    approved_by: str | None = None  # "system" / "human" / None (blocked)
    execution_result: str | None = None  # "success" / "failed" / None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
