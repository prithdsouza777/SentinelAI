from datetime import datetime, timezone

from pydantic import Field

from app.models.agent import CamelModel


class QueueMetrics(CamelModel):
    queue_id: str
    queue_name: str
    contacts_in_queue: int = 0
    oldest_contact_age: float = 0.0
    agents_online: int = 0
    agents_available: int = 0
    avg_wait_time: float = 0.0
    avg_handle_time: float = 0.0
    abandonment_rate: float = 0.0
    service_level: float = 0.0
    contacts_handled: int = 0
    tick: int = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
