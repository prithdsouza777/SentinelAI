"""Predictive Prevention Agent.

Tracks contact velocity per queue and predicts problems 60 seconds before
they fully manifest. Generates ANALYZED decisions with cascade risk warnings.
Uses LLM for rich reasoning when available, threshold logic always runs.
"""

import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase

logger = logging.getLogger("sentinelai.predictive_prevention")

PP_SYSTEM_PROMPT = """\
You are the Predictive Prevention agent in SentinelAI, an autonomous contact center platform.

Your job: analyze velocity data for a queue that is trending toward overload, \
assess cascade risk, and produce a structured analysis.

You are given pre-computed velocity data. Your task is to:
1. Assess the severity and urgency
2. Estimate cascade risk to other queues
3. Recommend a specific preemptive action
4. Set an appropriate confidence level

## Output format (STRICT JSON, no other text)
{
  "cascade_risk": "HIGH" or "MEDIUM",
  "reasoning": "2-4 sentence analysis with specific numbers, velocity, predicted values, and recommended action",
  "confidence": 0.75 to 0.95,
  "urgency_seconds": 30 to 120
}
"""


class PredictivePreventionAgent:
    def __init__(self):
        # queue_id -> deque of (timestamp_float, contacts_in_queue) pairs, max 10
        self.history: dict[str, deque] = defaultdict(lambda: deque(maxlen=10))
        # Track which queues already have active warnings (avoid spam)
        self._warned_queues: dict[str, float] = {}  # queue_id -> last_warn_time
        self._warn_cooldown = 10.0  # seconds between warnings per queue
        self._llm_available = None

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Evaluate queue velocity and predict future overload."""
        if not queue_states:
            return []

        decisions: list[AgentDecision] = []
        now = time.time()

        for q in queue_states:
            queue_id = q.get("queueId", "")
            queue_name = q.get("queueName", queue_id)
            contacts = q.get("contactsInQueue", 0)
            agents_online = max(q.get("agentsOnline", 1), 1)
            agents_available = max(q.get("agentsAvailable", 1), 1)

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

            velocity = (latest_contacts - oldest_contacts) / time_delta

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

            # Threshold-based defaults
            cascade_risk = "HIGH" if predicted_60s > critical_threshold * 2 else "MEDIUM"
            confidence = 0.82
            reasoning = (
                f"Velocity analysis: {queue_name} growing at +{velocity:.2f} contacts/sec. "
                f"Current: {contacts} contacts. "
                f"Predicted in 60s: {predicted_60s:.0f} contacts. "
                f"Critical threshold: {critical_threshold:.0f} (agents_online x 2.5). "
                f"Exceeds threshold by {predicted_60s - critical_threshold:.0f}. "
                f"Cascade risk: {cascade_risk}. "
                f"Recommend preemptive reinforcement now."
            )

            # Enhance with LLM reasoning if available
            if await self._is_llm_available():
                try:
                    llm_result = await self._get_llm_reasoning(
                        queue_name, queue_id, contacts, agents_online,
                        agents_available, velocity, predicted_60s,
                        critical_threshold, q,
                    )
                    if llm_result:
                        cascade_risk = llm_result.get("cascade_risk", cascade_risk)
                        reasoning = llm_result.get("reasoning", reasoning)
                        confidence = min(max(float(llm_result.get("confidence", 0.82)), 0.5), 0.95)
                except Exception as e:
                    logger.warning("LLM enhancement failed: %s", e)

            decisions.append(AgentDecision(
                id=f"pp-{queue_id}-{now:.0f}",
                agent_type=AgentType.PREDICTIVE_PREVENTION,
                phase=DecisionPhase.ANALYZED,
                summary=f"{queue_name}: cascade {cascade_risk} risk — critical in ~60s",
                reasoning=reasoning,
                action=f"reinforce:{queue_id}",
                confidence=confidence,
                impact_score=0.6,
                timestamp=datetime.now(timezone.utc),
            ))

        return decisions

    async def _is_llm_available(self) -> bool:
        if self._llm_available is None:
            from app.services.bedrock import bedrock_service
            self._llm_available = not bedrock_service.is_mock
        return self._llm_available

    async def _get_llm_reasoning(
        self, queue_name, queue_id, contacts, agents_online,
        agents_available, velocity, predicted_60s, critical_threshold, queue_data,
    ) -> dict | None:
        """Call LLM for enriched reasoning on a detected velocity anomaly."""
        from app.services.bedrock import bedrock_service

        prompt = (
            f"Queue: {queue_name} ({queue_id})\n"
            f"Current contacts: {contacts}\n"
            f"Agents online: {agents_online}, available: {agents_available}\n"
            f"Velocity: +{velocity:.2f} contacts/sec\n"
            f"Predicted in 60s: {predicted_60s:.0f} contacts\n"
            f"Critical threshold: {critical_threshold:.0f}\n"
            f"Wait time: {queue_data.get('avgWaitTime', 0):.0f}s\n"
            f"Abandonment rate: {queue_data.get('abandonmentRate', 0):.1f}%\n"
            f"Service level: {queue_data.get('serviceLevel', 0):.0f}%\n\n"
            f"Analyze cascade risk and recommend action."
        )

        result = await bedrock_service.invoke_with_system(PP_SYSTEM_PROMPT, prompt, max_tokens=300)
        message = result.get("message", "")

        try:
            json_str = message
            if "```" in json_str:
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                json_str = json_str.strip()
            return json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            return None

    async def execute(self, action: dict) -> bool:
        """Execute a preemptive reinforcement action."""
        from app.services.simulation import simulation_engine

        queue_id = action.get("queue_id")
        if queue_id:
            simulation_engine.adjust_queue(queue_id, 1)
            return True
        return False
