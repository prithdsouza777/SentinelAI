"""Predictive Prevention Agent.

Tracks contact velocity per queue and predicts problems 60 seconds before
they fully manifest. Generates ANALYZED decisions with cascade risk warnings.
"""

import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase


class PredictivePreventionAgent:
    def __init__(self):
        # queue_id -> deque of (timestamp_float, contacts_in_queue) pairs, max 10
        self.history: dict[str, deque] = defaultdict(lambda: deque(maxlen=10))
        # Track which queues already have active warnings (avoid spam)
        self._warned_queues: dict[str, float] = {}  # queue_id -> last_warn_time
        self._warn_cooldown = 10.0  # seconds between warnings per queue

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Evaluate queue velocity and predict future overload.

        Queue states are camelCase dicts (already serialized from QueueMetrics).
        """
        if not queue_states:
            return []

        decisions: list[AgentDecision] = []
        now = time.time()

        for q in queue_states:
            queue_id = q.get("queueId", "")
            queue_name = q.get("queueName", queue_id)
            contacts = q.get("contactsInQueue", 0)
            agents_online = max(q.get("agentsOnline", 1), 1)

            # Append to history
            self.history[queue_id].append((now, contacts))

            # Need at least 3 data points for meaningful velocity
            if len(self.history[queue_id]) < 3:
                continue

            history = list(self.history[queue_id])
            oldest_time, oldest_contacts = history[0]
            latest_time, latest_contacts = history[-1]

            time_delta = latest_time - oldest_time
            if time_delta < 0.1:
                continue

            velocity = (latest_contacts - oldest_contacts) / time_delta  # contacts/second

            # Only predict upward trends
            if velocity <= 0.1:
                continue

            predicted_60s = contacts + velocity * 60
            critical_threshold = agents_online * 2.5

            if predicted_60s <= critical_threshold:
                continue

            # Cooldown: don't spam warnings for the same queue
            last_warn = self._warned_queues.get(queue_id, 0.0)
            if now - last_warn < self._warn_cooldown:
                continue

            self._warned_queues[queue_id] = now

            # Cascade risk: high if predicted exceeds 2x critical threshold
            cascade_risk = "HIGH" if predicted_60s > critical_threshold * 2 else "MEDIUM"

            decisions.append(AgentDecision(
                id=f"pp-{queue_id}-{now:.0f}",
                agent_type=AgentType.PREDICTIVE_PREVENTION,
                phase=DecisionPhase.ANALYZED,
                summary=f"{queue_name}: cascade {cascade_risk} risk — critical in ~60s",
                reasoning=(
                    f"Velocity analysis: {queue_name} growing at +{velocity:.2f} contacts/sec. "
                    f"Current: {contacts} contacts. "
                    f"Predicted in 60s: {predicted_60s:.0f} contacts. "
                    f"Critical threshold: {critical_threshold:.0f} (agents_online × 2.5). "
                    f"Exceeds threshold by {predicted_60s - critical_threshold:.0f}. "
                    f"Cascade risk: {cascade_risk}. "
                    f"Recommend preemptive reinforcement now."
                ),
                action=f"reinforce:{queue_id}",
                confidence=0.82,
                impact_score=0.6,
                timestamp=datetime.now(timezone.utc),
            ))

        return decisions

    async def execute(self, action: dict) -> bool:
        """Execute a preemptive reinforcement action."""
        from app.services.simulation import simulation_engine

        queue_id = action.get("queue_id")
        if queue_id:
            simulation_engine.adjust_queue(queue_id, 1)
            return True
        return False
