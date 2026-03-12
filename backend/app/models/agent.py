from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that serialises to camelCase — matches frontend TypeScript types."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class AgentType(str, Enum):
    QUEUE_BALANCER = "queue_balancer"
    PREDICTIVE_PREVENTION = "predictive_prevention"
    ESCALATION_HANDLER = "escalation_handler"
    ANALYTICS = "analytics"


class DecisionPhase(str, Enum):
    OBSERVED = "observed"
    ANALYZED = "analyzed"
    DECIDED = "decided"
    ACTED = "acted"
    NEGOTIATING = "negotiating"


class AgentDecision(CamelModel):
    id: str
    agent_type: AgentType
    phase: DecisionPhase
    summary: str
    reasoning: str = ""
    action: str | None = None
    timestamp: datetime = datetime.now()

    # ── Governance fields (SentinelAI-inspired) ──────────────────────────
    confidence: float = 1.0             # 0.0–1.0 signal certainty
    impact_score: float = 0.0           # 0.0–1.0 blast radius
    risk_score: float = 0.0             # derived: (1 - confidence) × impact_score
    requires_approval: bool = False
    approved: bool | None = None
    auto_approve_at: datetime | None = None
    guardrail_result: str | None = None  # AUTO_APPROVE / PENDING_HUMAN / BLOCKED
    policy_violations: list[str] = []   # human-readable violation messages


class NegotiationProposal(CamelModel):
    agent_type: AgentType
    proposal: str
    priority: int
    confidence: float


class AgentNegotiation(CamelModel):
    id: str
    agents: list[AgentType]
    topic: str
    proposals: list[NegotiationProposal]
    resolution: str = ""
    timestamp: datetime = datetime.now()
