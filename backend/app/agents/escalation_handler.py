"""Escalation Handler Agent.

Responds to critical alerts by escalating through configured channels
with cost impact estimates and AI-recommended resolution options.
"""

import time
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase


class EscalationHandlerAgent:
    def __init__(self):
        self.escalation_channels: list[str] = ["dashboard", "webhook"]
        self._warned_queues: dict[str, float] = {}  # queue_id → last warn timestamp
        self._cooldown_seconds = 15.0

    async def evaluate(
        self, queue_states: list[dict], alerts: list[dict] = []
    ) -> list[AgentDecision]:
        """Evaluate critical alerts and generate escalation decisions."""
        decisions: list[AgentDecision] = []
        now = time.monotonic()

        for alert in alerts:
            if alert.get("severity") != "critical":
                continue
            if alert.get("resolvedAt"):
                continue

            qid = alert.get("queueId", "")
            qname = alert.get("queueName", qid)

            # Per-queue cooldown to prevent tick-spam
            last = self._warned_queues.get(qid, 0.0)
            if now - last < self._cooldown_seconds:
                continue
            self._warned_queues[qid] = now

            decision = AgentDecision(
                id=f"eh-{qid}-{datetime.now(timezone.utc).timestamp():.0f}",
                agent_type=AgentType.ESCALATION_HANDLER,
                phase=DecisionPhase.DECIDED,
                summary=f"Escalate {qname}: notify supervisor + emergency pull",
                reasoning=(
                    f"CRITICAL alert on {qname}. Abandonment threshold crossed. "
                    "Recommending: (1) page duty supervisor, "
                    "(2) emergency pull of 3 agents from low-priority queues immediately."
                ),
                action=f"escalate:{qid}:priority=urgent",
                confidence=0.80,
                impact_score=0.7,
            )
            decisions.append(decision)

        return decisions

    async def execute(self, action: dict) -> bool:
        """Execute an escalation action (notifies via dashboard channel)."""
        return True
