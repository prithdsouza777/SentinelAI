"""Analytics Agent.

Answers natural language queries about contact center operations
using real-time system context + Bedrock (or mock fallback).
"""

from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase
from app.services.bedrock import bedrock_service


class AnalyticsAgent:
    """Processes NL queries by building context from live system state and invoking Bedrock."""

    async def query(self, message: str, context: dict | None = None) -> dict:
        """Process a natural language query about contact center operations.

        Args:
            message: The user's natural language question
            context: Dict with recent_alerts, recent_decisions, queue_metrics, etc.

        Returns:
            Dict with message, reasoning, and optional data fields.
        """
        context = context or {}
        result = await bedrock_service.invoke(message, context)

        return {
            "message": result.get("message", "Unable to generate response."),
            "reasoning": result.get("reasoning", ""),
            "model": result.get("model", "unknown"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def evaluate(self, queue_states: list[dict], alerts: list[dict] | None = None) -> list[AgentDecision]:
        """Analytics agent doesn't generate autonomous decisions — returns empty."""
        return []


analytics_agent = AnalyticsAgent()
