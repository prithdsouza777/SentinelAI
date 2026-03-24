"""Escalation Handler Agent.

Responds to critical alerts by escalating through configured channels
with AI-generated resolution options and cost impact estimates.
Uses LLM for rich reasoning when available, threshold logic always runs.
"""

import json
import logging
import time
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase

logger = logging.getLogger("sentinelai.escalation_handler")

EH_SYSTEM_PROMPT = """\
You are the Escalation Handler agent in SentinelAI, an autonomous contact center platform.

Your job: when a CRITICAL alert fires, assess the situation and recommend specific \
escalation actions with cost justification.

You receive alert details and queue metrics. You must:
1. Assess severity and business impact
2. Recommend specific escalation actions (page supervisor, emergency agent pull, etc.)
3. Estimate cost of inaction per minute
4. Set confidence based on alert clarity

## Output format (STRICT JSON, no other text)
{
  "reasoning": "3-5 sentence escalation rationale with specific numbers. Include cost of inaction estimate, recommended actions, and expected resolution time.",
  "confidence": 0.70 to 0.95,
  "cost_per_minute_inaction": 25.0,
  "recommended_actions": ["page_supervisor", "emergency_pull_3_agents"]
}
"""


class EscalationHandlerAgent:
    def __init__(self):
        self.escalation_channels: list[str] = ["dashboard", "webhook"]
        self._warned_queues: dict[str, float] = {}  # queue_id -> last warn timestamp
        self._cooldown_seconds = 30.0
        self._llm_available = None

    async def evaluate(
        self, queue_states: list[dict], alerts: list[dict] | None = None
    ) -> list[AgentDecision]:
        """Evaluate critical alerts and generate escalation decisions."""
        decisions: list[AgentDecision] = []
        now = time.monotonic()
        alerts = alerts or []

        # Build a quick lookup for queue metrics
        queue_lookup = {q.get("queueId", ""): q for q in queue_states}

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

            # Defaults from threshold logic
            confidence = 0.80
            reasoning = (
                f"CRITICAL alert on {qname}. Abandonment threshold crossed. "
                "Recommending: (1) page duty supervisor, "
                "(2) emergency pull of 3 agents from low-priority queues immediately."
            )

            # Enhance with LLM reasoning if available
            if await self._is_llm_available():
                try:
                    queue_data = queue_lookup.get(qid, {})
                    llm_result = await self._get_llm_reasoning(alert, queue_data, queue_states)
                    if llm_result:
                        reasoning = llm_result.get("reasoning", reasoning)
                        confidence = min(max(float(llm_result.get("confidence", 0.80)), 0.5), 0.95)
                except Exception as e:
                    logger.warning("LLM enhancement failed: %s", e)

            decision = AgentDecision(
                id=f"eh-{qid}-{datetime.now(timezone.utc).timestamp():.0f}",
                agent_type=AgentType.ESCALATION_HANDLER,
                phase=DecisionPhase.DECIDED,
                summary=f"Escalate {qname}: notify supervisor + emergency pull",
                reasoning=reasoning,
                action=f"escalate:{qid}:priority=urgent",
                confidence=confidence,
                impact_score=0.7,
            )
            decisions.append(decision)

        return decisions

    async def _is_llm_available(self) -> bool:
        if self._llm_available is None:
            from app.services.bedrock import bedrock_service
            self._llm_available = not bedrock_service.is_mock
        return self._llm_available

    async def _get_llm_reasoning(
        self, alert: dict, queue_data: dict, all_queues: list[dict]
    ) -> dict | None:
        """Call LLM for enriched escalation reasoning."""
        from app.services.bedrock import bedrock_service

        qname = alert.get("queueName", alert.get("queueId", "?"))
        description = alert.get("description", alert.get("message", "Critical threshold crossed"))

        prompt = (
            f"CRITICAL ALERT: {qname}\n"
            f"Alert: {description}\n\n"
            f"Queue metrics:\n"
            f"  Contacts: {queue_data.get('contactsInQueue', '?')}\n"
            f"  Agents online: {queue_data.get('agentsOnline', '?')}\n"
            f"  Agents available: {queue_data.get('agentsAvailable', '?')}\n"
            f"  Wait time: {queue_data.get('avgWaitTime', '?')}s\n"
            f"  Abandonment: {queue_data.get('abandonmentRate', '?')}%\n"
            f"  Service level: {queue_data.get('serviceLevel', '?')}%\n\n"
            f"Other queues available for agent pull:\n"
        )
        for q in all_queues:
            if q.get("queueId") != alert.get("queueId"):
                prompt += (
                    f"  - {q.get('queueName', '?')}: {q.get('contactsInQueue', 0)} contacts, "
                    f"{q.get('agentsAvailable', 0)} available agents\n"
                )

        prompt += "\nAssess severity and recommend specific escalation actions."

        result = await bedrock_service.invoke_with_system(EH_SYSTEM_PROMPT, prompt, max_tokens=300)
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
        """Execute an escalation action: pull best-fit agents to the critical queue."""
        from app.services.simulation import simulation_engine, SIMULATED_QUEUES

        action_str = action.get("action", "")
        # Extract target queue from action string like "escalate:q-support:priority=urgent"
        parts = action_str.split(":")
        target_queue_id = parts[1] if len(parts) > 1 else None
        if not target_queue_id:
            return True  # Notification-only escalation

        # Use agent_database for fitness-aware agent selection
        try:
            from app.services.agent_database import agent_database
            if agent_database._initialized:
                best = agent_database.get_best_agents_for_department(
                    target_queue_id, count=2, min_remaining=2,
                )
                for agent in best:
                    old_queue = agent.current_queue_id
                    agent_database.move_agent(agent.id, target_queue_id)
                    simulation_engine.adjust_queue(old_queue, -1)
                    simulation_engine.adjust_queue(target_queue_id, +1)
                    logger.info(
                        "Emergency pull: %s (target %s fitness: %.2f, source %s fitness: %.2f) from %s -> %s",
                        agent.name,
                        target_queue_id, agent.department_score_for(target_queue_id),
                        old_queue, agent.department_score_for(old_queue),
                        old_queue, target_queue_id,
                    )
                return len(best) > 0
        except Exception as e:
            logger.warning("Agent database unavailable for smart escalation: %s", e)

        # Fallback: original blind pull from lowest-pressure queue
        best_donor = None
        best_pressure = float("inf")
        for q in SIMULATED_QUEUES:
            if q["id"] == target_queue_id:
                continue
            if q["agents"] <= 2:
                continue
            pressure = q.get("base_load", 5) / max(q["agents"], 1)
            if pressure < best_pressure:
                best_pressure = pressure
                best_donor = q

        if best_donor and best_donor["agents"] > 2:
            pull_count = min(2, best_donor["agents"] - 2)
            simulation_engine.adjust_queue(best_donor["id"], -pull_count)
            simulation_engine.adjust_queue(target_queue_id, +pull_count)
            logger.info(
                "Emergency pull (fallback): %d agents %s -> %s",
                pull_count, best_donor["name"], target_queue_id,
            )
            return True

        return True
