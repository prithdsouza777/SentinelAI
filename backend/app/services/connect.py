"""AWS Connect API integration layer.

Handles fetching real-time and historical metrics from AWS Connect.
When simulation_mode is enabled, returns data from the simulation engine instead.
"""

import boto3

from app.config import settings
from app.models import QueueMetrics


class ConnectService:
    def __init__(self):
        if settings.connect_instance_id:
            self.client = boto3.client("connect", region_name=settings.connect_region)
            self.instance_id = settings.connect_instance_id
        else:
            self.client = None
            self.instance_id = None

    async def get_current_metrics(self) -> list[QueueMetrics]:
        """Fetch current queue metrics from Connect or simulation."""
        if settings.simulation_mode or not self.client:
            # Will be replaced by simulation engine
            return []

        # TODO: Implement real Connect API calls
        # GetCurrentMetricData for real-time metrics
        # GetMetricDataV2 for historical metrics
        return []

    async def list_queues(self) -> list[dict]:
        """List all queues in the Connect instance."""
        if settings.simulation_mode or not self.client:
            return []

        # TODO: Implement ListQueues API call
        return []

    async def update_routing_profile(self, agent_id: str, routing_profile_id: str) -> bool:
        """Update an agent's routing profile (for queue reassignment)."""
        if settings.simulation_mode or not self.client:
            return True

        # TODO: Implement UpdateUserRoutingProfile API call
        return False


connect_service = ConnectService()
