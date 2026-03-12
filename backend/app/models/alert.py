from datetime import datetime
from enum import Enum

from app.models.agent import CamelModel


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Alert(CamelModel):
    id: str
    severity: AlertSeverity
    title: str
    description: str
    queue_id: str
    queue_name: str
    anomaly_velocity: float | None = None
    recommended_action: str = ""
    timestamp: datetime = datetime.now()
    resolved_at: datetime | None = None
    resolved_by: str | None = None
