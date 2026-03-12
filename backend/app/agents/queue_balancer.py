"""Queue Balancer Agent.

Detects queue imbalances and autonomously reassigns agents between queues.
Constraint: Never leaves any queue below minimum staffing threshold.
"""

from datetime import datetime, timezone

from app.models import AgentDecision, AgentType, DecisionPhase


class QueueBalancerAgent:
    def __init__(self):
        self.min_staffing: dict[str, int] = {}  # queue_id -> minimum agents (default 2)

    async def evaluate(self, queue_states: list[dict]) -> list[AgentDecision]:
        """Evaluate queue states and propose rebalancing actions.

        Queue states are camelCase dicts (already serialized from QueueMetrics).
        """
        if not queue_states:
            return []

        decisions: list[AgentDecision] = []

        # Calculate pressure per queue: contacts / max(available_agents, 1)
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

        # Skip if imbalance is below threshold
        if max_pressure - min_pressure < 2.0:
            return []

        overloaded_id = max(pressures, key=pressures.__getitem__)
        idle_id = min(pressures, key=pressures.__getitem__)

        overloaded_q = next((q for q in queue_states if q.get("queueId") == overloaded_id), None)
        idle_q = next((q for q in queue_states if q.get("queueId") == idle_id), None)

        if not overloaded_q or not idle_q:
            return []

        # Enforce min staffing: idle queue must retain at least 2 agents after move
        min_agents = self.min_staffing.get(idle_id, 2)
        agents_online_idle = idle_q.get("agentsOnline", 0)
        if agents_online_idle - 2 < min_agents:
            return []

        overloaded_name = overloaded_q.get("queueName", overloaded_id)
        idle_name = idle_q.get("queueName", idle_id)

        decisions.append(AgentDecision(
            id=f"qb-{datetime.now(timezone.utc).timestamp():.0f}",
            agent_type=AgentType.QUEUE_BALANCER,
            phase=DecisionPhase.DECIDED,
            summary=f"Move 2 agents: {idle_name} → {overloaded_name}",
            reasoning=(
                f"Pressure imbalance detected: {overloaded_name} at {max_pressure:.1f}x load, "
                f"{idle_name} at {min_pressure:.1f}x load. "
                f"Differential {max_pressure - min_pressure:.1f}x exceeds threshold 2.0x. "
                f"Moving 2 agents will reduce imbalance by ~{(max_pressure - min_pressure) * 0.4:.1f}x. "
                f"{idle_name} retains {agents_online_idle - 2} agents (above min staffing of {min_agents})."
            ),
            action=f"move_agents:from={idle_id}:to={overloaded_id}:count=2",
            confidence=0.85,
            impact_score=0.5,
        ))

        return decisions

    async def execute(self, action: dict) -> bool:
        """Execute a queue rebalancing action by adjusting simulation state."""
        from app.services.simulation import simulation_engine

        from_q = action.get("from_queue")
        to_q = action.get("to_queue")
        count = int(action.get("count", 2))

        if from_q and to_q:
            simulation_engine.adjust_queue(from_q, -count)
            simulation_engine.adjust_queue(to_q, count)
            return True
        return False
