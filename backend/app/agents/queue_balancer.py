"""Queue Balancer Agent.

Detects queue imbalances and autonomously reassigns agents between queues.
Uses LLM reasoning when available, falls back to threshold-based logic.
Constraint: Never leaves any queue below minimum staffing threshold.
"""

import json
import logging
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase

logger = logging.getLogger("sentinelai.queue_balancer")

# LLM system prompt for queue balancer reasoning
QB_SYSTEM_PROMPT = """\
You are the Queue Balancer agent in the SentinelAI autonomous contact center platform.

Your job: analyze queue pressure data and decide whether to rebalance agents between queues.

## Decision rules
- Pressure = contacts_in_queue / max(agents_available, 1)
- If max_pressure - min_pressure >= 2.0, rebalancing is warranted
- Never move agents FROM a queue that would drop below 2 agents after the move
- Prefer moving 2 agents at a time (balance speed vs stability)
- Consider wait times and abandonment rates as secondary signals

## Output format (STRICT JSON)
Return ONLY a JSON object, no other text:
{
  "should_act": true/false,
  "from_queue_id": "q-xxx (DONOR queue — the LOW-pressure queue you are TAKING agents FROM)",
  "from_queue_name": "Name (donor)",
  "to_queue_id": "q-xxx (RECEIVER queue — the HIGH-pressure queue you are SENDING agents TO)",
  "to_queue_name": "Name (receiver)",
  "count": 2,
  "reasoning": "2-3 sentence explanation with specific numbers",
  "confidence": 0.85
}

IMPORTANT: "from" = the idle/low-pressure donor queue. "to" = the overloaded/high-pressure receiver queue.

If no action needed, return: {"should_act": false, "reasoning": "explanation"}
"""


class QueueBalancerAgent:
    def __init__(self):
        self.min_staffing: dict[str, int] = {}  # queue_id -> minimum agents (default 2)
        self._llm_available = None

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Evaluate queue states and propose rebalancing actions."""
        if not queue_states:
            return []

        # Try LLM-powered reasoning first, fall back to threshold logic
        if await self._is_llm_available():
            try:
                return await self._evaluate_with_llm(queue_states)
            except Exception as e:
                logger.warning("LLM reasoning failed: %s, using threshold logic", e)

        return await self._evaluate_threshold(queue_states)

    async def _is_llm_available(self) -> bool:
        """Check if real LLM is available (cache result)."""
        if self._llm_available is None:
            from app.services.bedrock import bedrock_service
            self._llm_available = not bedrock_service.is_mock
        return self._llm_available

    async def _evaluate_with_llm(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Use LLM to reason about queue states and generate decisions."""
        from app.services.bedrock import bedrock_service

        # Quick threshold pre-check — don't waste LLM calls on calm states
        pressures = {
            q.get("queueId", ""): q.get("contactsInQueue", 0) / max(q.get("agentsAvailable", 1), 1)
            for q in queue_states
        }
        max_p = max(pressures.values()) if pressures else 0
        min_p = min(pressures.values()) if pressures else 0
        if max_p - min_p < 1.0:  # lower threshold — trigger on moderate imbalances
            return []

        # Build prompt with live data
        prompt = "Analyze these queue states and decide if rebalancing is needed:\n\n"
        for q in queue_states:
            qid = q.get("queueId", "?")
            prompt += (
                f"- {q.get('queueName', qid)}: "
                f"contacts={q.get('contactsInQueue', 0)}, "
                f"agents_online={q.get('agentsOnline', 0)}, "
                f"agents_available={q.get('agentsAvailable', 0)}, "
                f"pressure={pressures.get(qid, 0):.2f}, "
                f"wait_time={q.get('avgWaitTime', 0):.0f}s, "
                f"abandonment={q.get('abandonmentRate', 0):.1f}%, "
                f"service_level={q.get('serviceLevel', 0):.0f}%\n"
            )

        # Enrich with agent fitness data from agent_database
        try:
            from app.services.agent_database import agent_database
            if agent_database._initialized:
                overloaded_id = max(pressures, key=pressures.__getitem__)
                idle_id = min(pressures, key=pressures.__getitem__)
                candidates = agent_database.get_agents_in_queue(idle_id)
                candidates.sort(
                    key=lambda a: a.department_score_for(overloaded_id), reverse=True
                )
                idle_name = next(
                    (q.get("queueName", idle_id) for q in queue_states if q.get("queueId") == idle_id),
                    idle_id,
                )
                overloaded_name = next(
                    (q.get("queueName", overloaded_id) for q in queue_states if q.get("queueId") == overloaded_id),
                    overloaded_id,
                )
                if candidates:
                    prompt += f"\nCandidate agents in {idle_name} (donor) for {overloaded_name} transfer:\n"
                    for i, a in enumerate(candidates[:3], 1):
                        top_skills = sorted(
                            a.skill_proficiencies,
                            key=lambda s: s.proficiency, reverse=True,
                        )[:3]
                        skills_str = ", ".join(f"{s.skill_name}={s.proficiency:.2f}" for s in top_skills)
                        prompt += (
                            f"  {i}. {a.name} ({a.role}, {overloaded_name} fitness: "
                            f"{a.department_score_for(overloaded_id):.2f}) — top skills: {skills_str}\n"
                        )
        except Exception:
            pass  # Graceful fallback — LLM works without enrichment

        # Use bedrock_service but with our custom system prompt
        result = await self._invoke_llm(prompt)
        message = result.get("message", "")

        # Parse JSON from LLM response
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_str = message
            if "```" in json_str:
                json_str = json_str.split("```")[1]
                if json_str.startswith("json"):
                    json_str = json_str[4:]
                json_str = json_str.strip()
            parsed = json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Could not parse LLM JSON, falling back to threshold")
            return await self._evaluate_threshold(queue_states)

        if not parsed.get("should_act", False):
            # If LLM returned empty/timeout response, fall back to threshold
            if "reasoning" not in parsed:
                return await self._evaluate_threshold(queue_states)
            return []

        # Validate the LLM's suggestion against our hard constraints
        from_id = parsed.get("from_queue_id", "")
        to_id = parsed.get("to_queue_id", "")
        count = min(int(parsed.get("count", 2)), 3)  # cap at 3 (guardrails policy)

        from_q = next((q for q in queue_states if q.get("queueId") == from_id), None)
        to_q = next((q for q in queue_states if q.get("queueId") == to_id), None)
        if not from_q or not to_q:
            return await self._evaluate_threshold(queue_states)

        # Sanity check: "from" should have LOWER pressure than "to"
        from_pressure = pressures.get(from_id, 0)
        to_pressure = pressures.get(to_id, 0)
        if from_pressure > to_pressure:
            # LLM swapped from/to — correct it
            from_id, to_id = to_id, from_id
            from_q, to_q = to_q, from_q
            parsed["from_queue_name"], parsed["to_queue_name"] = parsed.get("to_queue_name", to_id), parsed.get("from_queue_name", from_id)

        min_agents = self.min_staffing.get(from_id, 2)
        from_available = from_q.get("agentsAvailable", from_q.get("agentsOnline", 0))
        if from_available - count < min_agents:
            return []

        from_name = parsed.get("from_queue_name", from_id)
        to_name = parsed.get("to_queue_name", to_id)
        confidence = min(max(float(parsed.get("confidence", 0.85)), 0.5), 0.95)
        llm_reasoning = parsed.get("reasoning", "LLM-generated decision")

        # Build source queue impact analysis
        impact = self._analyze_source_impact(from_q, count)
        reasoning = f"{llm_reasoning} | Source impact: {impact}"

        decisions = [AgentDecision(
            id=f"qb-{datetime.now(timezone.utc).timestamp():.0f}",
            agent_type=AgentType.QUEUE_BALANCER,
            phase=DecisionPhase.DECIDED,
            summary=f"Move {count} agents: {from_name} -> {to_name}",
            reasoning=reasoning,
            action=f"move_agents:from={from_id}:to={to_id}:count={count}",
            confidence=confidence,
            impact_score=0.5,
        )]

        return decisions

    async def _invoke_llm(self, prompt: str) -> dict:
        """Invoke the LLM with our queue balancer system prompt."""
        from app.services.bedrock import bedrock_service

        # Use the dedicated agent invoke method
        return await bedrock_service.invoke_with_system(QB_SYSTEM_PROMPT, prompt, max_tokens=512)

    async def _evaluate_threshold(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Original threshold-based logic (fast, no LLM needed)."""
        pressures: dict[str, float] = {}
        for q in queue_states:
            queue_id = q.get("queueId", "")
            contacts = q.get("contactsInQueue", 0)
            available = max(q.get("agentsAvailable", 1), 1)
            pressures[queue_id] = contacts / available

        if not pressures:
            return []

        max_pressure = max(pressures.values())
        min_pressure = min(pressures.values())

        if max_pressure - min_pressure < 1.5:
            return []

        overloaded_id = max(pressures, key=pressures.__getitem__)
        idle_id = min(pressures, key=pressures.__getitem__)

        overloaded_q = next((q for q in queue_states if q.get("queueId") == overloaded_id), None)
        idle_q = next((q for q in queue_states if q.get("queueId") == idle_id), None)

        if not overloaded_q or not idle_q:
            return []

        min_agents = self.min_staffing.get(idle_id, 2)
        agents_available_idle = idle_q.get("agentsAvailable", idle_q.get("agentsOnline", 0))
        if agents_available_idle - 2 < min_agents:
            return []

        overloaded_name = overloaded_q.get("queueName", overloaded_id)
        idle_name = idle_q.get("queueName", idle_id)

        # Source queue impact analysis
        impact = self._analyze_source_impact(idle_q, 2)

        return [AgentDecision(
            id=f"qb-{datetime.now(timezone.utc).timestamp():.0f}",
            agent_type=AgentType.QUEUE_BALANCER,
            phase=DecisionPhase.DECIDED,
            summary=f"Move 2 agents: {idle_name} -> {overloaded_name}",
            reasoning=(
                f"Pressure imbalance detected: {overloaded_name} at {max_pressure:.1f}x load, "
                f"{idle_name} at {min_pressure:.1f}x load. "
                f"Differential {max_pressure - min_pressure:.1f}x exceeds threshold 1.5x. "
                f"Moving 2 agents will reduce imbalance by ~{(max_pressure - min_pressure) * 0.4:.1f}x. "
                f"{idle_name} retains {agents_available_idle - 2} available agents (above min staffing of {min_agents}). "
                f"Source impact: {impact}"
            ),
            action=f"move_agents:from={idle_id}:to={overloaded_id}:count=2",
            confidence=0.85,
            impact_score=0.5,
        )]

    def _analyze_source_impact(self, source_queue: dict, count: int) -> str:
        """Analyze the impact of pulling agents from the source queue.

        Returns a human-readable impact summary that goes into the decision reasoning.
        """
        contacts = source_queue.get("contactsInQueue", 0)
        agents_online = max(source_queue.get("agentsOnline", 1), 1)
        agents_available = source_queue.get("agentsAvailable", agents_online)
        wait_time = source_queue.get("avgWaitTime", 0)
        abandon_rate = source_queue.get("abandonmentRate", 0)
        sla = source_queue.get("serviceLevel", 100)
        queue_name = source_queue.get("queueName", "?")

        remaining_available = agents_available - count
        current_pressure = contacts / agents_online
        projected_pressure = contacts / max(agents_online - count, 1)

        parts = []
        parts.append(f"{queue_name} will have {remaining_available} available agents after move")
        parts.append(f"pressure {current_pressure:.1f}x -> {projected_pressure:.1f}x")

        # Flag risks
        if projected_pressure > 2.0:
            parts.append("WARNING: source queue will be under pressure after move")
        if abandon_rate > 10:
            parts.append(f"source abandonment already at {abandon_rate:.1f}%")
        if sla < 80:
            parts.append(f"source SLA already degraded to {sla:.0f}%")
        if remaining_available <= 2:
            parts.append("source at minimum staffing after move")

        return "; ".join(parts)

    async def execute(self, action: dict) -> bool:
        """Execute a queue rebalancing action by picking the best-fit agents."""
        from app.services.simulation import simulation_engine

        from_q = action.get("from_queue")
        to_q = action.get("to_queue")
        count = int(action.get("count", 2))

        if not (from_q and to_q):
            return False

        # Use agent_database to pick specific agents by fitness for target dept
        try:
            from app.services.agent_database import agent_database
            if agent_database._initialized:
                candidates = agent_database.get_agents_in_queue(from_q)
                # Sort by transfer score: high target fitness + low source fitness
                # This preserves the source queue's best performers
                candidates.sort(
                    key=lambda a: (
                        a.department_score_for(to_q) * 0.6
                        - a.department_score_for(from_q) * 0.4
                    ),
                    reverse=True,
                )
                moved = 0
                remaining = len(candidates)
                for agent in candidates[:count]:
                    # Respect min staffing: keep at least 2 in source queue
                    if remaining <= 2:
                        break
                    agent_database.move_agent(agent.id, to_q)
                    moved += 1
                    remaining -= 1
                    logger.info(
                        "QB moved %s (target %s fitness: %.2f, source %s fitness: %.2f) from %s to %s",
                        agent.name,
                        to_q, agent.department_score_for(to_q),
                        from_q, agent.department_score_for(from_q),
                        from_q, to_q,
                    )
                simulation_engine.adjust_queue(from_q, -moved)
                simulation_engine.adjust_queue(to_q, moved)
                return moved > 0
        except Exception as e:
            logger.warning("Agent database unavailable for smart selection: %s", e)

        # Fallback: blind count adjustment
        simulation_engine.adjust_queue(from_q, -count)
        simulation_engine.adjust_queue(to_q, count)
        return True
