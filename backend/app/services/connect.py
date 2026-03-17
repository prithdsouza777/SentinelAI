"""AWS Connect API integration layer.

Handles fetching real-time and historical metrics from AWS Connect.
When simulation_mode is enabled, returns data from the simulation engine instead.
"""

import json
import logging

from app.config import settings
from app.models import QueueMetrics

logger = logging.getLogger("sentinelai.connect")


class ConnectService:
    def __init__(self):
        self._client = None
        self.instance_id = settings.connect_instance_id or None

    def _get_client(self):
        if self._client is None and self.instance_id:
            try:
                import boto3
                self._client = boto3.client("connect", region_name=settings.connect_region)
            except Exception as e:
                logger.warning("Failed to create client: %s", e)
        return self._client

    async def get_current_metrics(self) -> list[QueueMetrics]:
        """Fetch current queue metrics from Connect or simulation."""
        if settings.simulation_mode or not self._get_client():
            from app.services.simulation import simulation_engine
            return simulation_engine.generate_metrics()

        import asyncio
        try:
            client = self._get_client()
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.get_current_metric_data(
                    InstanceId=self.instance_id,
                    Filters={"Queues": [], "Channels": ["VOICE"]},
                    CurrentMetrics=[
                        {"Name": "CONTACTS_IN_QUEUE", "Unit": "COUNT"},
                        {"Name": "AGENTS_ONLINE", "Unit": "COUNT"},
                        {"Name": "AGENTS_AVAILABLE", "Unit": "COUNT"},
                        {"Name": "OLDEST_CONTACT_AGE", "Unit": "SECONDS"},
                    ],
                ),
            )
            return self._parse_connect_metrics(response)
        except Exception as e:
            logger.warning("get_current_metrics error: %s", e)
            return []

    async def list_queues(self) -> list[dict]:
        """List all queues in the Connect instance."""
        if settings.simulation_mode or not self._get_client():
            return [
                {"id": "q-support", "name": "Support", "description": "Customer support queue"},
                {"id": "q-billing", "name": "Billing", "description": "Billing inquiries"},
                {"id": "q-sales", "name": "Sales", "description": "Sales inquiries"},
                {"id": "q-general", "name": "General", "description": "General inquiries"},
                {"id": "q-vip", "name": "VIP", "description": "VIP customers"},
            ]

        import asyncio
        try:
            client = self._get_client()
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.list_queues(InstanceId=self.instance_id),
            )
            return [
                {"id": q["Id"], "name": q["Name"], "description": q.get("Description", "")}
                for q in response.get("QueueSummaryList", [])
            ]
        except Exception as e:
            logger.warning("list_queues error: %s", e)
            return []

    async def update_routing_profile(self, agent_id: str, routing_profile_id: str) -> bool:
        """Update an agent's routing profile (for queue reassignment)."""
        if settings.simulation_mode or not self._get_client():
            return True

        import asyncio
        try:
            client = self._get_client()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: client.update_user_routing_profile(
                    InstanceId=self.instance_id,
                    UserId=agent_id,
                    RoutingProfileId=routing_profile_id,
                ),
            )
            return True
        except Exception as e:
            logger.warning("update_routing_profile error: %s", e)
            return False

    async def health_check(self) -> dict:
        """Return health status for the settings page."""
        if settings.simulation_mode:
            return {"status": "simulation", "detail": "Simulation mode active"}
        if not self._get_client():
            return {"status": "unavailable", "detail": "No Connect instance configured"}
        try:
            import asyncio
            client = self._get_client()
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: client.describe_instance(InstanceId=self.instance_id),
            )
            return {"status": "connected", "detail": f"Instance: {self.instance_id}"}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    def _parse_connect_metrics(self, response: dict) -> list[QueueMetrics]:
        """Parse Connect API response into QueueMetrics objects."""
        from datetime import datetime, timezone
        results = []
        for collection in response.get("MetricResults", []):
            queue_id = collection.get("Dimensions", {}).get("Queue", {}).get("Id", "unknown")
            queue_name = collection.get("Dimensions", {}).get("Queue", {}).get("Arn", queue_id).split("/")[-1]
            metrics_map = {}
            for mc in collection.get("Collections", []):
                name = mc.get("Metric", {}).get("Name", "")
                value = mc.get("Value", 0)
                metrics_map[name] = value

            results.append(QueueMetrics(
                queue_id=queue_id,
                queue_name=queue_name,
                timestamp=datetime.now(timezone.utc),
                contacts_in_queue=int(metrics_map.get("CONTACTS_IN_QUEUE", 0)),
                agents_online=int(metrics_map.get("AGENTS_ONLINE", 0)),
                agents_available=int(metrics_map.get("AGENTS_AVAILABLE", 0)),
                avg_wait_time=float(metrics_map.get("OLDEST_CONTACT_AGE", 0)),
                service_level=85.0,
                abandonment_rate=0.0,
            ))
        return results


connect_service = ConnectService()
