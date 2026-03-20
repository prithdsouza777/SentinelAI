"""LangGraph Agent Orchestrator — coordinates all AI agents as a state graph.

Architecture:
    START → [queue_balancer, predictive_prevention, escalation_handler] (parallel)
          → guardrails_gate
          → check_conflicts (conditional)
              → negotiate (if conflicts) → execute
              → execute (if no conflicts)
          → broadcast → END

Every decision passes through the GuardrailsLayer. AUTO_APPROVE decisions
execute immediately. PENDING_HUMAN decisions get a 30s auto-approve timeout.
BLOCKED decisions are logged and skipped.
"""

from __future__ import annotations

import operator
from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated, TypedDict

import logging

from langgraph.graph import StateGraph, START, END

from app.models import AgentType, NegotiationProposal
from app.agents.guardrails import GuardrailStatus, guardrails

logger = logging.getLogger("sentinelai.orchestrator")

# Priority scores used in negotiation conflict resolution (higher wins)
AGENT_PRIORITY = {
    "escalation_handler": 8,
    "queue_balancer": 7,
    "predictive_prevention": 6,
    "skill_router": 5,
    "analytics": 3,
}


# ── LangGraph State Schema ──────────────────────────────────────────────────

class OrchestratorState(TypedDict):
    """State that flows through the LangGraph orchestrator."""
    # Inputs (set before graph invocation)
    metrics: list[dict]
    active_alerts: list[dict]

    # Accumulated outputs (use operator.add to merge parallel node results)
    decisions: Annotated[list[dict], operator.add]
    executed_actions: Annotated[list[str], operator.add]
    negotiations: Annotated[list[dict], operator.add]
    broadcasts: Annotated[list[dict], operator.add]

    # Flags
    has_conflicts: bool


# ── Agent Nodes ──────────────────────────────────────────────────────────────
# Each node receives the full state, returns a partial state update.
# LangGraph merges the updates using the Annotated reducers above.

async def queue_balancer_node(state: OrchestratorState) -> dict:
    """Run Queue Balancer agent and collect decisions."""
    agent = _agents.get(AgentType.QUEUE_BALANCER)
    if not agent:
        return {"decisions": [], "executed_actions": [], "broadcasts": []}

    raw_decisions = await agent.evaluate(state["metrics"])
    decisions = []
    executed = []
    broadcasts = []

    for d in raw_decisions:
        result = await guardrails.evaluate(d)
        d_dict = d.model_dump(by_alias=True, mode="json")
        broadcasts.append({"event": "agent:reasoning", "data": d_dict})
        decisions.append(d_dict)

        if result.status == GuardrailStatus.AUTO_APPROVE:
            ok = await _execute_queue_balancer(d)
            if ok:
                executed.append(d.action or "move_agents")
                d_dict["phase"] = "acted"
                broadcasts.append({"event": "action:taken", "data": d_dict})

    return {"decisions": decisions, "executed_actions": executed, "broadcasts": broadcasts}


async def predictive_prevention_node(state: OrchestratorState) -> dict:
    """Run Predictive Prevention agent and collect decisions."""
    agent = _agents.get(AgentType.PREDICTIVE_PREVENTION)
    if not agent:
        return {"decisions": [], "executed_actions": [], "broadcasts": []}

    raw_decisions = await agent.evaluate(state["metrics"])
    decisions = []
    executed = []
    broadcasts = []

    for d in raw_decisions:
        result = await guardrails.evaluate(d)
        d_dict = d.model_dump(by_alias=True, mode="json")
        broadcasts.append({"event": "agent:reasoning", "data": d_dict})
        broadcasts.append({"event": "prediction:warning", "data": d_dict})
        decisions.append(d_dict)

        if result.status == GuardrailStatus.AUTO_APPROVE:
            queue_id = (d.action or "").split(":")[-1]
            if queue_id:
                ok = await agent.execute({"queue_id": queue_id})
                if ok:
                    executed.append(d.action or "reinforce")
                    d_dict["phase"] = "acted"
                    broadcasts.append({"event": "action:taken", "data": d_dict})

    return {"decisions": decisions, "executed_actions": executed, "broadcasts": broadcasts}


async def skill_router_node(state: OrchestratorState) -> dict:
    """Run Skill Router agent — zero-LLM, pure threshold scoring for minimal latency."""
    agent = _agents.get(AgentType.SKILL_ROUTER)
    if not agent:
        return {"decisions": [], "executed_actions": [], "broadcasts": []}

    raw_decisions = await agent.evaluate(state["metrics"])
    decisions = []
    executed = []
    broadcasts = []

    for d in raw_decisions:
        result = await guardrails.evaluate(d)
        d_dict = d.model_dump(by_alias=True, mode="json")
        broadcasts.append({"event": "agent:reasoning", "data": d_dict})
        decisions.append(d_dict)

        if result.status == GuardrailStatus.AUTO_APPROVE:
            ok = await agent.execute({"action": d.action})
            if ok:
                executed.append(d.action or "route_contact")
                d_dict["phase"] = "acted"
                broadcasts.append({"event": "action:taken", "data": d_dict})

    return {"decisions": decisions, "executed_actions": executed, "broadcasts": broadcasts}


async def escalation_handler_node(state: OrchestratorState) -> dict:
    """Run Escalation Handler agent and collect decisions."""
    agent = _agents.get(AgentType.ESCALATION_HANDLER)
    if not agent:
        return {"decisions": [], "executed_actions": [], "broadcasts": []}

    raw_decisions = await agent.evaluate(state["metrics"], state["active_alerts"])
    decisions = []
    executed = []
    broadcasts = []

    for d in raw_decisions:
        result = await guardrails.evaluate(d)
        d_dict = d.model_dump(by_alias=True, mode="json")
        broadcasts.append({"event": "agent:reasoning", "data": d_dict})
        decisions.append(d_dict)

        if result.status == GuardrailStatus.AUTO_APPROVE:
            ok = await agent.execute({"action": d.action})
            if ok:
                executed.append(d.action or "escalate")
                d_dict["phase"] = "acted"
                broadcasts.append({"event": "action:taken", "data": d_dict})

    return {"decisions": decisions, "executed_actions": executed, "broadcasts": broadcasts}


async def conflict_detection_node(state: OrchestratorState) -> dict:
    """Detect conflicts: 2+ agents targeting the same queue."""
    conflicts = _detect_conflicts(state["decisions"])
    return {"has_conflicts": len(conflicts) > 0}


async def negotiation_node(state: OrchestratorState) -> dict:
    """Resolve multi-agent conflicts via negotiation protocol."""
    from app.agents.negotiation import negotiation_protocol

    conflicts = _detect_conflicts(state["decisions"])
    negotiations = []
    broadcasts = []

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
        negotiations.append(neg_dict)
        broadcasts.append({"event": "agent:negotiation", "data": neg_dict})

    return {"negotiations": negotiations, "broadcasts": broadcasts}


async def auto_approve_node(state: OrchestratorState) -> dict:
    """Check for pending decisions past their 30s auto-approve deadline."""
    auto_approved_ids = guardrails.check_auto_approvals()
    broadcasts = []
    for decision_id in auto_approved_ids:
        broadcasts.append({"event": "action:auto_approved", "data": {"decisionId": decision_id}})
    return {"broadcasts": broadcasts}


async def governance_broadcast_node(state: OrchestratorState) -> dict:
    """Broadcast governance scorecard snapshot."""
    summary = guardrails.get_governance_summary()
    return {"broadcasts": [{"event": "governance:update", "data": summary}]}


# ── Conditional edge ─────────────────────────────────────────────────────────

def should_negotiate(state: OrchestratorState) -> str:
    """Route to negotiation if conflicts exist, otherwise skip to auto-approve."""
    if state.get("has_conflicts", False):
        return "negotiate"
    return "auto_approve"


# ── Graph Construction ───────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    """Build the LangGraph orchestrator state graph."""
    graph = StateGraph(OrchestratorState)

    # Add nodes
    graph.add_node("queue_balancer", queue_balancer_node)
    graph.add_node("predictive_prevention", predictive_prevention_node)
    graph.add_node("escalation_handler", escalation_handler_node)
    graph.add_node("skill_router", skill_router_node)
    graph.add_node("conflict_detection", conflict_detection_node)
    graph.add_node("negotiate", negotiation_node)
    graph.add_node("auto_approve", auto_approve_node)
    graph.add_node("governance_broadcast", governance_broadcast_node)

    # Fan-out from START to all 4 agents (parallel execution)
    graph.add_edge(START, "queue_balancer")
    graph.add_edge(START, "predictive_prevention")
    graph.add_edge(START, "escalation_handler")
    graph.add_edge(START, "skill_router")

    # All agents converge into conflict detection
    graph.add_edge("queue_balancer", "conflict_detection")
    graph.add_edge("predictive_prevention", "conflict_detection")
    graph.add_edge("escalation_handler", "conflict_detection")
    graph.add_edge("skill_router", "conflict_detection")

    # Conditional: negotiate if conflicts, else skip to auto_approve
    graph.add_conditional_edges(
        "conflict_detection",
        should_negotiate,
        {"negotiate": "negotiate", "auto_approve": "auto_approve"},
    )

    # After negotiation, check auto-approvals
    graph.add_edge("negotiate", "auto_approve")

    # After auto-approve, broadcast governance
    graph.add_edge("auto_approve", "governance_broadcast")

    # End
    graph.add_edge("governance_broadcast", END)

    return graph


# ── Module-level state ───────────────────────────────────────────────────────

_agents: dict[AgentType, object] = {}
_compiled_graph = None


def _get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph().compile()
    return _compiled_graph


# ── Helper functions used by nodes ───────────────────────────────────────────

async def _execute_queue_balancer(decision) -> bool:
    """Parse a queue balancer action string and execute it."""
    action_str = decision.action or ""
    if not action_str.startswith("move_agents"):
        return False

    parts: dict[str, str] = {}
    for segment in action_str.split(":")[1:]:
        if "=" in segment:
            k, v = segment.split("=", 1)
            parts[k] = v

    agent = _agents.get(AgentType.QUEUE_BALANCER)
    if agent:
        return await agent.execute({
            "from_queue": parts.get("from"),
            "to_queue": parts.get("to"),
            "count": parts.get("count", "2"),
        })
    return False


def _detect_conflicts(decisions: list[dict]) -> list[list[dict]]:
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


# ── AgentOrchestrator (public API — unchanged interface) ─────────────────────

class AgentOrchestrator:
    """LangGraph-powered orchestrator. Same public API as before."""

    def __init__(self):
        self._initialized = False

        # Revenue-at-risk / cost accumulators
        self._total_saved = 0.0
        self._revenue_at_risk = 0.0
        self._prevented_abandoned = 0
        self._actions_today = 0

    @property
    def agents(self):
        return _agents

    async def initialize(self):
        """Initialize all agents and compile the LangGraph."""
        from app.agents.queue_balancer import QueueBalancerAgent
        from app.agents.predictive_prevention import PredictivePreventionAgent
        from app.agents.escalation_handler import EscalationHandlerAgent
        from app.agents.skill_router import SkillRouterAgent
        from app.agents.analytics import analytics_agent

        _agents[AgentType.QUEUE_BALANCER] = QueueBalancerAgent()
        _agents[AgentType.PREDICTIVE_PREVENTION] = PredictivePreventionAgent()
        _agents[AgentType.ESCALATION_HANDLER] = EscalationHandlerAgent()
        _agents[AgentType.SKILL_ROUTER] = SkillRouterAgent()
        _agents[AgentType.ANALYTICS] = analytics_agent
        self._initialized = True

        # Pre-compile the graph
        _get_graph()
        logger.info("LangGraph initialized: QueueBalancer, PredictivePrevention, EscalationHandler, SkillRouter, Analytics")

    async def process_metrics(
        self,
        metrics: list[dict],
        active_alerts: list[dict] | None = None,
        recent_negotiations: list[dict] | None = None,
    ) -> list[dict]:
        """Run the full LangGraph orchestration pipeline.

        Returns list of decision dicts (camelCase) that were generated.
        """
        if not self._initialized:
            return []

        from app.api.websocket import manager

        active_alerts = active_alerts or []

        # Build initial state
        initial_state: OrchestratorState = {
            "metrics": metrics,
            "active_alerts": active_alerts,
            "decisions": [],
            "executed_actions": [],
            "negotiations": [],
            "broadcasts": [],
            "has_conflicts": False,
        }

        # Run the LangGraph
        graph = _get_graph()
        final_state = await graph.ainvoke(initial_state)

        # Process broadcasts (send all WS events collected during graph execution)
        for b in final_state.get("broadcasts", []):
            event = b.get("event", "")
            data = b.get("data", {})
            if event and data:
                await manager.broadcast(event, data)

        # Record cost for executed actions
        for action_str in final_state.get("executed_actions", []):
            await self._record_action_cost(action_str)

        # Store negotiations
        if recent_negotiations is not None:
            for neg in final_state.get("negotiations", []):
                recent_negotiations.insert(0, neg)
                if len(recent_negotiations) > 50:
                    recent_negotiations.pop()

        return final_state.get("decisions", [])

    async def tick_revenue_at_risk(self, critical_count: int):
        """Called from main.py each tick. Accumulates revenue-at-risk during crises."""
        if critical_count > 0:
            self._revenue_at_risk += 15.0 * critical_count
            from app.api.websocket import manager
            await manager.broadcast("cost:update", {
                "totalSaved": round(self._total_saved, 2),
                "revenueAtRisk": round(self._revenue_at_risk, 2),
                "totalPreventedAbandoned": self._prevented_abandoned,
                "actionsToday": self._actions_today,
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            })

    async def _record_action_cost(self, action_str: str):
        """Record savings when an action executes."""
        savings_map = {"move_agents": 50.0, "escalate": -30.0, "reinforce": 80.0}
        prefix = action_str.split(":")[0]
        base_amount = savings_map.get(prefix, 20.0)

        rescued = self._revenue_at_risk * 0.7
        self._total_saved += base_amount + rescued
        self._revenue_at_risk = max(self._revenue_at_risk * 0.3, 0)
        self._actions_today += 1
        # Dynamic abandoned-call prevention estimate based on action type
        prevented = {"move_agents": 18, "escalate": 8, "reinforce": 14, "route_contact": 3}
        self._prevented_abandoned += prevented.get(prefix, 5)

        from app.api.websocket import manager
        await manager.broadcast("cost:update", {
            "totalSaved": round(self._total_saved, 2),
            "revenueAtRisk": round(self._revenue_at_risk, 2),
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

        if action_str.startswith("move_agents") and AgentType.QUEUE_BALANCER in _agents:
            parts: dict[str, str] = {}
            for seg in action_str.split(":")[1:]:
                if "=" in seg:
                    k, v = seg.split("=", 1)
                    parts[k] = v
            executed = await _agents[AgentType.QUEUE_BALANCER].execute({
                "from_queue": parts.get("from"),
                "to_queue": parts.get("to"),
                "count": parts.get("count", "2"),
            })

        elif action_str.startswith("escalate") and AgentType.ESCALATION_HANDLER in _agents:
            executed = await _agents[AgentType.ESCALATION_HANDLER].execute(
                {"action": action_str}
            )

        elif action_str.startswith("reinforce") and AgentType.PREDICTIVE_PREVENTION in _agents:
            queue_id = action_str.split(":")[-1]
            executed = await _agents[AgentType.PREDICTIVE_PREVENTION].execute(
                {"queue_id": queue_id}
            )

        if executed:
            decision["phase"] = "acted"
            from app.api.websocket import manager
            await manager.broadcast("agent:reasoning", decision)
            await self._record_action_cost(action_str)

        return executed

    async def handle_chat(self, message: str, context: dict | None = None) -> dict:
        """Route a chat message to the Analytics Agent."""
        from app.agents.analytics import analytics_agent
        return await analytics_agent.query(message, context)

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

    async def _broadcast_governance(self):
        """Broadcast governance:update event with current scorecard stats."""
        try:
            from app.api.websocket import manager
            summary = guardrails.get_governance_summary()
            await manager.broadcast("governance:update", summary)
        except Exception:
            pass


orchestrator = AgentOrchestrator()
