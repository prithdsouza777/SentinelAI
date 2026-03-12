"""Agent orchestrator — coordinates all AI agents sequentially.

Runs Queue Balancer, Predictive Prevention, and Escalation Handler on every
simulation tick. Every decision is passed through the GuardrailsLayer before
broadcasting. AUTO_APPROVE decisions are executed immediately. PENDING_HUMAN
decisions are broadcast for human review (30s auto-approve timeout). BLOCKED
decisions are logged and skipped.

Multi-agent negotiation fires when 2+ agents target the same queue.
Revenue-at-risk clock ticks up during active CRITICAL alerts.
"""

from collections import defaultdict
from datetime import datetime, timezone

from app.models import AgentType, NegotiationProposal
from app.agents.guardrails import GuardrailStatus, guardrails

# Priority scores used in negotiation conflict resolution (higher wins)
AGENT_PRIORITY = {
    "escalation_handler": 8,   # urgent escalations win ties
    "queue_balancer": 7,
    "predictive_prevention": 6,
    "analytics": 3,
}


class AgentOrchestrator:
    """Manages agent lifecycle and coordinates multi-agent interactions."""

    def __init__(self):
        self.agents: dict[AgentType, object] = {}
        self._initialized = False

        # Revenue-at-risk / cost accumulators
        self._total_saved = 0.0
        self._revenue_at_risk = 0.0
        self._prevented_abandoned = 0
        self._actions_today = 0

    async def initialize(self):
        """Initialize all agents."""
        from app.agents.queue_balancer import QueueBalancerAgent
        from app.agents.predictive_prevention import PredictivePreventionAgent
        from app.agents.escalation_handler import EscalationHandlerAgent

        self.agents[AgentType.QUEUE_BALANCER] = QueueBalancerAgent()
        self.agents[AgentType.PREDICTIVE_PREVENTION] = PredictivePreventionAgent()
        self.agents[AgentType.ESCALATION_HANDLER] = EscalationHandlerAgent()
        self._initialized = True
        print("[orchestrator] Initialized: QueueBalancer, PredictivePreventionAgent, EscalationHandlerAgent")

    async def process_metrics(
        self,
        metrics: list[dict],
        active_alerts: list[dict] = [],
        recent_negotiations: list[dict] | None = None,
    ) -> list[dict]:
        """Feed new metrics to all agents for evaluation.

        Returns list of decision dicts (camelCase) that were broadcast.
        Each decision has already been passed through the GuardrailsLayer.
        """
        if not self._initialized:
            return []

        from app.api.websocket import manager
        from app.agents.negotiation import negotiation_protocol

        all_decisions: list[dict] = []

        # --- Queue Balancer ---
        if AgentType.QUEUE_BALANCER in self.agents:
            agent = self.agents[AgentType.QUEUE_BALANCER]
            decisions = await agent.evaluate(metrics)
            for d in decisions:
                result = await guardrails.evaluate(d)
                d_dict = d.model_dump(by_alias=True, mode="json")
                await manager.broadcast("agent:reasoning", d_dict)
                all_decisions.append(d_dict)

                if result.status == GuardrailStatus.AUTO_APPROVE:
                    await self._execute_queue_balancer_decision(d)

        # --- Predictive Prevention ---
        if AgentType.PREDICTIVE_PREVENTION in self.agents:
            agent = self.agents[AgentType.PREDICTIVE_PREVENTION]
            decisions = await agent.evaluate(metrics)
            for d in decisions:
                result = await guardrails.evaluate(d)
                d_dict = d.model_dump(by_alias=True, mode="json")
                await manager.broadcast("agent:reasoning", d_dict)
                await manager.broadcast("prediction:warning", d_dict)
                all_decisions.append(d_dict)

                if result.status == GuardrailStatus.AUTO_APPROVE:
                    queue_id = (d.action or "").split(":")[-1]
                    if queue_id:
                        await self.agents[AgentType.PREDICTIVE_PREVENTION].execute(
                            {"queue_id": queue_id}
                        )

        # --- Escalation Handler ---
        if AgentType.ESCALATION_HANDLER in self.agents:
            agent = self.agents[AgentType.ESCALATION_HANDLER]
            decisions = await agent.evaluate(metrics, active_alerts)
            for d in decisions:
                result = await guardrails.evaluate(d)
                d_dict = d.model_dump(by_alias=True, mode="json")
                await manager.broadcast("agent:reasoning", d_dict)
                all_decisions.append(d_dict)

                if result.status == GuardrailStatus.AUTO_APPROVE:
                    await self.agents[AgentType.ESCALATION_HANDLER].execute(
                        {"action": d.action}
                    )

        # --- Conflict detection + negotiation ---
        conflicts = self._detect_conflicts(all_decisions)
        for conflict_group in conflicts:
            proposals = [
                NegotiationProposal(
                    agent_type=AgentType(d["agentType"]),
                    proposal=d["summary"],
                    priority=AGENT_PRIORITY.get(d["agentType"], 5),
                    confidence=d.get("confidence", 0.8),
                )
                for d in conflict_group
            ]
            negotiation = negotiation_protocol.resolve(proposals)
            neg_dict = negotiation.model_dump(by_alias=True, mode="json")
            await manager.broadcast("agent:negotiation", neg_dict)

            if recent_negotiations is not None:
                recent_negotiations.insert(0, neg_dict)
                if len(recent_negotiations) > 50:
                    recent_negotiations.pop()

        # Check for pending decisions that timed out (30s auto-approve)
        auto_approved_ids = guardrails.check_auto_approvals()
        for decision_id in auto_approved_ids:
            await manager.broadcast("action:auto_approved", {"decisionId": decision_id})

        # Broadcast governance scorecard snapshot
        await self._broadcast_governance()

        return all_decisions

    async def tick_revenue_at_risk(self, critical_count: int):
        """Called from main.py each tick. Accumulates revenue-at-risk during crises."""
        if critical_count > 0:
            self._revenue_at_risk += 15.0 * critical_count  # $15/tick/critical alert
            from app.api.websocket import manager
            await manager.broadcast("cost:update", {
                "totalSaved": round(self._total_saved, 2),
                "revenueAtRisk": round(self._revenue_at_risk, 2),
                "totalPreventedAbandoned": self._prevented_abandoned,
                "actionsToday": self._actions_today,
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            })

    async def _record_action_cost(self, action_str: str):
        """Record savings when an action executes. Rescues 70% of at-risk revenue."""
        savings_map = {"move_agents": 50.0, "escalate": -30.0, "reinforce": 80.0}
        prefix = action_str.split(":")[0]
        base_amount = savings_map.get(prefix, 20.0)

        # Rescue 70% of accumulated at-risk revenue
        rescued = self._revenue_at_risk * 0.7
        self._total_saved += base_amount + rescued
        self._revenue_at_risk = 0.0  # Crisis resolved — clock stops
        self._actions_today += 1
        self._prevented_abandoned += 12

        from app.api.websocket import manager
        await manager.broadcast("cost:update", {
            "totalSaved": round(self._total_saved, 2),
            "revenueAtRisk": 0.0,
            "totalPreventedAbandoned": self._prevented_abandoned,
            "actionsToday": self._actions_today,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        })

    async def execute_approved_decision(
        self, decision_id: str, decisions_list: list[dict]
    ) -> bool:
        """Execute a human-approved decision. Called from WS approve handler."""
        decision = next(
            (d for d in decisions_list if d.get("id") == decision_id), None
        )
        if not decision:
            return False

        action_str = decision.get("action", "")
        executed = False

        if action_str.startswith("move_agents") and AgentType.QUEUE_BALANCER in self.agents:
            parts: dict[str, str] = {}
            for seg in action_str.split(":")[1:]:
                if "=" in seg:
                    k, v = seg.split("=", 1)
                    parts[k] = v
            executed = await self.agents[AgentType.QUEUE_BALANCER].execute({
                "from_queue": parts.get("from"),
                "to_queue": parts.get("to"),
                "count": parts.get("count", "2"),
            })

        elif action_str.startswith("escalate") and AgentType.ESCALATION_HANDLER in self.agents:
            executed = await self.agents[AgentType.ESCALATION_HANDLER].execute(
                {"action": action_str}
            )

        elif action_str.startswith("reinforce") and AgentType.PREDICTIVE_PREVENTION in self.agents:
            queue_id = action_str.split(":")[-1]
            executed = await self.agents[AgentType.PREDICTIVE_PREVENTION].execute(
                {"queue_id": queue_id}
            )

        if executed:
            decision["phase"] = "acted"
            from app.api.websocket import manager
            await manager.broadcast("agent:reasoning", decision)
            await self._record_action_cost(action_str)

        return executed

    def _detect_conflicts(self, decisions: list[dict]) -> list[list[dict]]:
        """Group decisions by target queue. Conflict = 2+ agents targeting same queue."""
        queue_groups: dict[str, list[dict]] = defaultdict(list)
        for d in decisions:
            action = d.get("action", "")
            target = None
            for seg in action.split(":"):
                if seg.startswith("to="):
                    target = seg[3:]
                    break
                if seg.startswith("q-"):
                    target = seg
                    break
            if target:
                queue_groups[target].append(d)
        return [g for g in queue_groups.values() if len(g) > 1]

    async def handle_alert(self, alert: dict):
        """Route an alert to the appropriate agent(s)."""
        pass

    async def handle_chat(self, message: str) -> dict:
        """Route a chat message to the Analytics Agent."""
        return {
            "message": (
                f"I've analyzed your query: '{message}'. "
                "The Analytics Agent with Bedrock integration will be available in Week 3. "
                "Currently monitoring: 5 queues, real-time anomaly detection active, "
                "Queue Balancer, Predictive Prevention, and Escalation Handler agents running."
            ),
            "reasoning": "Analytics agent not yet initialized with Bedrock.",
        }

    async def handle_human_decision(
        self, decision_id: str, approved: bool, approver: str = "human"
    ) -> bool:
        """Record a human approve/reject from the WebSocket layer."""
        ok = guardrails.record_human_decision(decision_id, approved, approver)

        if ok and approved:
            try:
                from app.api.websocket import manager
                await manager.broadcast("action:human_approved", {
                    "decisionId": decision_id,
                    "approver": approver,
                })
            except Exception:
                pass

        return ok

    async def _execute_queue_balancer_decision(self, decision) -> bool:
        """Parse a queue balancer action string and execute it."""
        action_str = decision.action or ""
        if not action_str.startswith("move_agents"):
            return False

        parts: dict[str, str] = {}
        for segment in action_str.split(":")[1:]:
            if "=" in segment:
                k, v = segment.split("=", 1)
                parts[k] = v

        agent = self.agents.get(AgentType.QUEUE_BALANCER)
        if agent:
            return await agent.execute({
                "from_queue": parts.get("from"),
                "to_queue": parts.get("to"),
                "count": parts.get("count", "2"),
            })
        return False

    async def _broadcast_governance(self):
        """Broadcast governance:update event with current scorecard stats."""
        try:
            from app.api.websocket import manager
            summary = guardrails.get_governance_summary()
            await manager.broadcast("governance:update", summary)
        except Exception:
            pass


orchestrator = AgentOrchestrator()
