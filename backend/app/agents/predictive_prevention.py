"""Predictive Prevention Agent.

Tracks contact velocity per queue and predicts problems using double
exponential smoothing (Holt's method) for trend-aware forecasting.
Generates ANALYZED decisions with cascade risk warnings and predictive alerts.
Uses LLM for rich reasoning when available, threshold logic always runs.
"""

import json
import logging
import math
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase
from app.models.alert import Alert, AlertSeverity

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
    """Predicts queue overload using Holt's double exponential smoothing.

    Holt's method tracks both level and trend separately, making predictions
    more stable than naive linear extrapolation. The method:
      - level(t) = alpha * x(t) + (1-alpha) * (level(t-1) + trend(t-1))
      - trend(t) = beta * (level(t) - level(t-1)) + (1-beta) * trend(t-1)
      - forecast(h) = level(t) + h * trend(t)

    Alpha controls level responsiveness (higher = react faster to new data).
    Beta controls trend responsiveness (higher = follow trend changes faster).
    """

    # Smoothing parameters (tuned for 3s tick interval)
    ALPHA = 0.4   # level smoothing — moderate responsiveness
    BETA = 0.3    # trend smoothing — slightly damped to reduce noise

    def __init__(self):
        # queue_id -> deque of (timestamp_float, contacts_in_queue) pairs, max 20
        self.history: dict[str, deque] = defaultdict(lambda: deque(maxlen=20))
        # Holt's state per queue: (level, trend)
        self._holt_state: dict[str, tuple[float, float]] = {}
        # Track which queues already have active warnings (avoid spam)
        self._warned_queues: dict[str, float] = {}  # queue_id -> last_warn_time
        self._warn_cooldown = 10.0  # seconds between warnings per queue
        self._llm_available = None
        # Predictive alerts generated this tick — consumed by main.py
        self.pending_alerts: list[Alert] = []

    def _update_holt(self, queue_id: str, value: float) -> tuple[float, float]:
        """Update Holt's double exponential smoothing state for a queue.

        Returns (level, trend) after incorporating the new observation.
        """
        if queue_id not in self._holt_state:
            # Initialize: level = first value, trend = 0
            self._holt_state[queue_id] = (value, 0.0)
            return (value, 0.0)

        prev_level, prev_trend = self._holt_state[queue_id]
        level = self.ALPHA * value + (1 - self.ALPHA) * (prev_level + prev_trend)
        trend = self.BETA * (level - prev_level) + (1 - self.BETA) * prev_trend
        self._holt_state[queue_id] = (level, trend)
        return (level, trend)

    def _forecast(self, queue_id: str, horizon_ticks: int) -> float:
        """Forecast value at horizon_ticks into the future.

        Each tick is ~3 seconds, so horizon_ticks=20 ≈ 60 seconds.
        """
        if queue_id not in self._holt_state:
            return 0.0
        level, trend = self._holt_state[queue_id]
        return level + trend * horizon_ticks

    def _forecast_confidence(self, queue_id: str) -> float:
        """Estimate confidence based on how many data points we have and trend stability."""
        n = len(self.history.get(queue_id, []))
        if n < 5:
            return 0.5  # low confidence with few data points
        # More data = higher confidence, capped at 0.9
        base = min(0.6 + (n - 5) * 0.02, 0.85)

        # Reduce confidence if trend is accelerating (less predictable)
        if queue_id in self._holt_state:
            _, trend = self._holt_state[queue_id]
            if abs(trend) > 5:  # rapid change = less certain
                base *= 0.85
        return min(base, 0.9)

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Evaluate queue trends and predict future overload using Holt's smoothing."""
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

            # Update history and Holt's model
            self.history[queue_id].append((now, contacts))
            level, trend = self._update_holt(queue_id, float(contacts))

            # Need at least 5 data points for reliable forecasting
            if len(self.history[queue_id]) < 5:
                continue

            # Only predict upward trends (trend > 0.1 contacts/tick)
            if trend <= 0.1:
                continue

            # Forecast 20 ticks ahead (~60 seconds at 3s intervals)
            predicted_60s = self._forecast(queue_id, horizon_ticks=20)
            # Also forecast shorter horizon for ETA calculation
            critical_threshold = agents_online * 2.5

            if predicted_60s <= critical_threshold:
                continue

            # Cooldown: don't spam warnings for the same queue
            last_warn = self._warned_queues.get(queue_id, 0.0)
            if now - last_warn < self._warn_cooldown:
                continue

            self._warned_queues[queue_id] = now

            # Convert trend (per tick) to velocity (per second) for display
            velocity = trend / 3.0  # 3s tick interval

            # Threshold-based defaults
            cascade_risk = "HIGH" if predicted_60s > critical_threshold * 2 else "MEDIUM"
            confidence = self._forecast_confidence(queue_id)
            reasoning = (
                f"Holt's forecast: {queue_name} trend +{trend:.2f} contacts/tick "
                f"(+{velocity:.2f}/sec, smoothed level {level:.1f}). "
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

            # Generate a PREDICTIVE alert so it flows into the alert system
            # and triggers notifications (email/Teams)
            severity = AlertSeverity.CRITICAL if cascade_risk == "HIGH" else AlertSeverity.WARNING
            eta_seconds = int((critical_threshold - contacts) / velocity) if velocity > 0 else 60
            eta_seconds = max(eta_seconds, 5)  # floor

            self.pending_alerts.append(Alert(
                id=f"pred-{queue_id}-{now:.0f}",
                severity=severity,
                title=f"Predicted spike: {queue_name} critical in ~{eta_seconds}s",
                description=(
                    f"Velocity +{velocity:.2f} contacts/sec. "
                    f"Current: {contacts}, predicted in 60s: {predicted_60s:.0f}. "
                    f"Threshold: {critical_threshold:.0f}. Cascade risk: {cascade_risk}."
                ),
                queue_id=queue_id,
                queue_name=queue_name,
                recommended_action=f"Preemptive reinforcement — add agents to {queue_name} now",
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
