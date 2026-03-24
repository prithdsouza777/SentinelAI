"""Skill-Based Contact Router Agent.

Routes incoming contacts to the best-matching agent based on:
  - Skill overlap (required skills vs agent skills)
  - Agent experience level
  - Historical performance score
  - Current queue load

Uses pure threshold-based scoring for zero-latency routing in the tick path.
No LLM calls — keeps the 3s tick loop fast.
"""

import logging
import time
from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase

logger = logging.getLogger("sentinelai.skill_router")

# Experience level multipliers — senior agents handle complex contacts better
EXPERIENCE_WEIGHT = {"senior": 1.0, "mid": 0.8, "junior": 0.6}


class SkillRouterAgent:
    """Routes contacts to best-match agents using weighted skill scoring.

    Scoring formula per agent:
        skill_match  = |intersection(required, agent_skills)| / |required|  (0–1)
        experience   = EXPERIENCE_WEIGHT[level]                              (0.6–1.0)
        performance  = agent.perf_score                                      (0–1)
        load_penalty = 1.0 - (queue_contacts / (queue_agents * 5))          (0–1, higher = less loaded)

        final_score = skill_match * 0.40 + performance * 0.25
                    + experience * 0.20 + load_penalty * 0.15
    """

    def __init__(self):
        self._routed_count = 0
        self._cooldown_ticks: dict[str, float] = {}  # agent_id → last routed time

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Generate routing decisions for any incoming contacts this tick."""
        from app.services.simulation import simulation_engine

        contact = simulation_engine.generate_incoming_contact()
        if contact is None:
            return []

        available_agents = simulation_engine.get_available_agents()
        if not available_agents:
            return []

        # Build queue load map from current metrics
        load_map: dict[str, float] = {}
        for q in queue_states:
            qid = q.get("queueId", "")
            contacts = q.get("contactsInQueue", 0)
            agents = max(q.get("agentsOnline", 1), 1)
            load_map[qid] = contacts / (agents * 5)

        # Score each agent using proficiency-weighted skill matching
        required_skills = list(contact["required_skills"])
        scored: list[tuple[dict, float, str]] = []

        # Try to use agent_database for proficiency-weighted scoring
        try:
            from app.services.agent_database import agent_database
            use_proficiency = agent_database._initialized
        except Exception:
            use_proficiency = False

        for agent in available_agents:
            if use_proficiency:
                profile = agent_database.get_agent(agent["id"])
                if profile:
                    skill_match = sum(
                        profile.proficiency_for(s) for s in required_skills
                    ) / max(len(required_skills), 1)
                else:
                    agent_skills = set(agent.get("skills", []))
                    skill_match = len(set(required_skills) & agent_skills) / max(len(required_skills), 1)
            else:
                agent_skills = set(agent.get("skills", []))
                skill_match = len(set(required_skills) & agent_skills) / max(len(required_skills), 1)

            exp = EXPERIENCE_WEIGHT.get(agent.get("experience", "mid"), 0.8)
            perf = agent.get("perf_score", 0.7)
            queue_load = load_map.get(agent.get("queue_id", ""), 0.5)
            load_penalty = max(0, 1.0 - queue_load)

            score = (
                skill_match * 0.40
                + perf * 0.25
                + exp * 0.20
                + load_penalty * 0.15
            )
            scored.append((agent, score, f"skill={skill_match:.0%},perf={perf:.0%},exp={exp:.0%},load={load_penalty:.0%}"))

        if not scored:
            return []

        # Sort by score descending, pick the best
        scored.sort(key=lambda x: x[1], reverse=True)
        best_agent, best_score, score_breakdown = scored[0]
        runner_up = scored[1] if len(scored) > 1 else None

        # Only generate a decision if the match is meaningful
        if best_score < 0.3:
            return []

        contact_type = contact["type"].replace("_", " ")
        agent_name = best_agent["name"]
        agent_id = best_agent["id"]
        queue_id = best_agent["queue_id"]

        # Log the routing
        simulation_engine.log_routing(
            contact["id"], agent_id, best_score,
            f"Routed {contact_type} to {agent_name}: {score_breakdown}",
        )
        self._routed_count += 1

        reasoning = (
            f"Incoming {contact_type} (requires: {', '.join(contact['required_skills'])}). "
            f"Best match: {agent_name} ({best_agent['experience']}) — "
            f"score {best_score:.2f} ({score_breakdown}). "
        )
        if runner_up:
            reasoning += f"Runner-up: {runner_up[0]['name']} (score {runner_up[1]:.2f})."

        confidence = min(0.95, best_score + 0.1)

        return [AgentDecision(
            id=f"sr-{contact['id']}",
            agent_type=AgentType.SKILL_ROUTER,
            phase=DecisionPhase.DECIDED,
            summary=f"Route {contact_type} → {agent_name} (score {best_score:.0%})",
            reasoning=reasoning,
            action=f"route_contact:{contact['id']}:agent={agent_id}:queue={queue_id}",
            confidence=confidence,
            impact_score=0.3,
        )]

    async def execute(self, action: dict) -> bool:
        """Execute a routing decision — assign contact to the matched agent.

        Parses the action string and updates the agent's status to 'busy'
        in the proficiency database, simulating the contact being handled.
        """
        action_str = action.get("action", "")
        if not action_str.startswith("route_contact"):
            return True

        # Parse action string: route_contact:{contact_id}:agent={agent_id}:queue={queue_id}
        parts: dict[str, str] = {}
        for segment in action_str.split(":"):
            if "=" in segment:
                k, v = segment.split("=", 1)
                parts[k] = v

        agent_id = parts.get("agent")
        if not agent_id:
            return True

        try:
            from app.services.agent_database import agent_database
            if agent_database._initialized:
                agent_database.update_statuses_bulk([agent_id], "busy")
                logger.info("Routed contact to agent %s (now busy)", agent_id)
        except Exception as e:
            logger.warning("Skill router execute failed: %s", e)

        return True
