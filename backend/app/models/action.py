from datetime import datetime

from pydantic import BaseModel


class CostImpact(BaseModel):
    prevented_abandoned: int = 0
    saved_amount: float = 0.0
    action_cost: float = 0.0
    net_savings: float = 0.0


class ActionLog(BaseModel):
    id: str
    agent_type: str
    action: str
    description: str
    cost_impact: CostImpact | None = None
    timestamp: datetime = datetime.now()
