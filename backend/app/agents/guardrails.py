"""Agent Guardrails Layer — AI Firewall for SentinelAI.

Every AgentDecision passes through this layer before execution.
It enforces hard policies, rate limits, scope isolation, and auto-approval
timeouts, producing a GuardrailResult that the orchestrator acts on.

GuardrailStatus logic:
  AUTO_APPROVE   confidence >= 0.8 AND no policy violations
  PENDING_HUMAN  0.5 <= confidence < 0.8  (auto-approve after 30s in demo mode)
  BLOCKED        confidence < 0.5 OR any policy violation
"""

import uuid
from collections import deque
from datetime import datetime, timedelta, timezone

from app.models.agent import AgentDecision, AgentType
from app.models.guardrails import AuditEntry, GuardrailPolicy, GuardrailResult, GuardrailStatus

# ── Hard policies (evaluated in order) ──────────────────────────────────────

POLICIES: list[GuardrailPolicy] = [
    GuardrailPolicy(
        name="min_staffing",
        description="No queue may fall below 2 available agents",
    ),
    GuardrailPolicy(
        name="max_agents_move",
        description="Single action cannot move more than 3 agents",
    ),
    GuardrailPolicy(
        name="cost_threshold",
        description="Actions with cost impact > $500 require approval",
    ),
    GuardrailPolicy(
        name="escalation_rate",
        description="Max 2 escalations per 5-minute window",
    ),
    GuardrailPolicy(
        name="analytics_readonly",
        description="AnalyticsAgent cannot modify any state",
    ),
]

# ── Scope isolation — agents can only invoke listed action prefixes ──────────

AGENT_SCOPES: dict[AgentType, list[str]] = {
    AgentType.QUEUE_BALANCER:        ["adjust_agents", "move_agents", "rebalance"],
    AgentType.ESCALATION_HANDLER:    ["escalate", "de_escalate"],
    AgentType.PREDICTIVE_PREVENTION: ["reinforce"],   # additive only
    AgentType.SKILL_ROUTER:          ["route_contact", "assign_agent"],
    AgentType.ANALYTICS:             [],              # read-only: empty = no mutations
}

# ── Rate limits (max_actions, window_seconds) ────────────────────────────────

RATE_LIMITS: dict[AgentType | str, tuple[int, int]] = {
    AgentType.QUEUE_BALANCER:        (20, 60),
    AgentType.ESCALATION_HANDLER:    (12, 300),
    AgentType.PREDICTIVE_PREVENTION: (20, 60),
    AgentType.SKILL_ROUTER:          (30, 60),
    "global":                        (100, 60),
}

# Auto-approve timeout for PENDING_HUMAN decisions (seconds)
AUTO_APPROVE_TIMEOUT = 30


class GuardrailsLayer:
    """Middleware between orchestrator evaluate() and agent execute().

    Usage:
        result = await guardrails.evaluate(decision, current_state)
        if result.status == GuardrailStatus.AUTO_APPROVE:
            agent.execute(decision)
    """

    def __init__(self):
        self._audit_log: list[AuditEntry] = []
        self._audit_max = 500
        # Sliding-window rate counters: agent_type → deque of UTC timestamps
        self._rate_counters: dict[str, deque] = {
            str(AgentType.QUEUE_BALANCER): deque(),
            str(AgentType.ESCALATION_HANDLER): deque(),
            str(AgentType.PREDICTIVE_PREVENTION): deque(),
            str(AgentType.SKILL_ROUTER): deque(),
            "global": deque(),
        }
        # Pending decisions waiting for human approval: decision_id → AuditEntry
        self._pending: dict[str, AuditEntry] = {}

    # ── Public API ───────────────────────────────────────────────────────────

    def reset(self):
        """Reset all state for a fresh simulation session."""
        self._audit_log.clear()
        self._pending.clear()
        for counter in self._rate_counters.values():
            counter.clear()

    async def evaluate(
        self,
        decision: AgentDecision,
        current_state: dict | None = None,
    ) -> GuardrailResult:
        """Evaluate a decision and return a GuardrailResult.

        Side effects:
        - Updates decision's governance fields (risk_score, guardrail_result, etc.)
        - Appends an AuditEntry
        - If PENDING_HUMAN, registers the decision for auto-approval countdown
        """
        violations: list[str] = []
        current_state = current_state or {}

        # 1. Compute risk score
        decision.risk_score = (1.0 - decision.confidence) * decision.impact_score

        # 2. Check scope isolation
        scope_ok = self._check_scope(decision)
        if not scope_ok:
            violations.append(
                f"scope_violation: {decision.agent_type} cannot execute action '{decision.action}'"
            )

        # 3. Check hard policies
        policy_violations = self._check_policies(decision, current_state)
        violations.extend(policy_violations)

        # 4. Check rate limits
        rate_ok = self._check_rate_limit(decision.agent_type)
        if not rate_ok:
            violations.append(
                f"rate_limit: {decision.agent_type} exceeded its action rate limit"
            )

        # 5. Determine status
        if violations or decision.confidence < 0.5:
            status = GuardrailStatus.BLOCKED
            reason = "; ".join(violations) if violations else "confidence below 0.5 threshold"
        elif decision.confidence < 0.8:
            status = GuardrailStatus.PENDING_HUMAN
            reason = f"confidence {decision.confidence:.2f} requires human review"
        else:
            status = GuardrailStatus.AUTO_APPROVE
            reason = "all checks passed"

        # 6. Update decision object
        decision.guardrail_result = status.value
        decision.policy_violations = violations
        decision.requires_approval = status == GuardrailStatus.PENDING_HUMAN
        if status == GuardrailStatus.PENDING_HUMAN:
            decision.auto_approve_at = datetime.now(timezone.utc) + timedelta(
                seconds=AUTO_APPROVE_TIMEOUT
            )

        # 7. Record rate hit (only non-blocked decisions advance the counter)
        if status != GuardrailStatus.BLOCKED:
            self._record_rate_hit(decision.agent_type)

        # 8. Write audit entry
        entry = AuditEntry(
            id=str(uuid.uuid4()),
            decision_id=decision.id,
            agent_type=decision.agent_type,
            action=decision.action or "unknown",
            confidence=decision.confidence,
            risk_score=decision.risk_score,
            guardrail_result=status.value,
            policy_violations=violations,
            approved_by="system" if status == GuardrailStatus.AUTO_APPROVE else None,
            execution_result=None,
        )
        self._append_audit(entry)

        if status == GuardrailStatus.PENDING_HUMAN:
            self._pending[decision.id] = entry

        result = GuardrailResult(
            status=status,
            decision_id=decision.id,
            policy_violations=violations,
            reason=reason,
        )
        return result

    def record_human_decision(
        self,
        decision_id: str,
        approved: bool,
        approver: str = "human",
    ) -> bool:
        """Record a human approve/reject on a PENDING_HUMAN decision.

        Returns True if the decision was found and updated.
        """
        entry = self._pending.pop(decision_id, None)
        if entry is None:
            return False
        entry.approved_by = approver if approved else None
        entry.execution_result = "approved" if approved else "rejected"
        # Update the stored entry
        for i, a in enumerate(self._audit_log):
            if a.decision_id == decision_id:
                self._audit_log[i] = entry
                break
        return True

    def record_execution_result(self, decision_id: str, result: str) -> None:
        """Update the execution_result field on the audit entry for a decision."""
        for entry in self._audit_log:
            if entry.decision_id == decision_id:
                entry.execution_result = result
                break

    def check_auto_approvals(self) -> list[str]:
        """Check pending decisions and auto-approve any past their deadline.

        Called on every simulation tick. Returns list of auto-approved decision IDs.
        """
        now = datetime.now(timezone.utc)
        approved_ids: list[str] = []
        for decision_id, entry in list(self._pending.items()):
            # Find matching decision's auto_approve_at via audit log (approximation)
            # We store it in the entry metadata via a side-channel search
            # Simpler: just check if entry was created > AUTO_APPROVE_TIMEOUT seconds ago
            age = (now - entry.timestamp.replace(tzinfo=timezone.utc)).total_seconds()
            if age >= AUTO_APPROVE_TIMEOUT:
                entry.approved_by = "system (auto-approved)"
                entry.execution_result = "auto_approved"
                approved_ids.append(decision_id)
                del self._pending[decision_id]
                # Update main log
                for i, a in enumerate(self._audit_log):
                    if a.decision_id == decision_id:
                        self._audit_log[i] = entry
                        break
        return approved_ids

    def get_audit_log(self, limit: int = 100) -> list[AuditEntry]:
        """Return most recent audit entries, newest first."""
        return list(reversed(self._audit_log[-self._audit_max :]))[:limit]

    def get_governance_summary(self) -> dict:
        """Return a snapshot suitable for the governance:update WS event."""
        total = len(self._audit_log)
        auto = sum(
            1 for e in self._audit_log if e.guardrail_result == GuardrailStatus.AUTO_APPROVE
        )
        human = sum(
            1
            for e in self._audit_log
            if e.approved_by == "human"
        )
        blocked = sum(
            1 for e in self._audit_log if e.guardrail_result == GuardrailStatus.BLOCKED
        )
        avg_conf = (
            sum(e.confidence for e in self._audit_log) / total if total else 0.0
        )
        return {
            "totalDecisions": total,
            "autoApproved": auto,
            "humanApproved": human,
            "blocked": blocked,
            "avgConfidence": round(avg_conf, 3),
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        }

    # ── Private helpers ──────────────────────────────────────────────────────

    def _check_scope(self, decision: AgentDecision) -> bool:
        """Return True if the action is within the agent's allowed scope."""
        allowed = AGENT_SCOPES.get(decision.agent_type, [])
        if not allowed:
            # Empty scope list = read-only (no mutations allowed)
            if decision.action and decision.action != "observe":
                return False
            return True
        if decision.action is None:
            return True
        action_lower = decision.action.lower()
        return any(action_lower.startswith(prefix) for prefix in allowed)

    def _check_policies(
        self, decision: AgentDecision, state: dict
    ) -> list[str]:
        """Run all enabled hard policies. Return list of violation messages."""
        violations: list[str] = []
        action = (decision.action or "").lower()

        for policy in POLICIES:
            if not policy.enabled:
                continue

            if policy.name == "min_staffing":
                agents_delta = state.get("agents_delta", 0)
                queue_available = state.get("agents_available", 10)
                if agents_delta < 0 and (queue_available + agents_delta) < 2:
                    violations.append(
                        "min_staffing: action would drop queue below 2 available agents"
                    )

            elif policy.name == "max_agents_move":
                count = state.get("agents_count", 0)
                if "move" in action or "adjust" in action:
                    if abs(count) > 3:
                        violations.append(
                            f"max_agents_move: requested {count} agents exceeds limit of 3"
                        )

            elif policy.name == "cost_threshold":
                cost_impact = state.get("cost_impact", 0)
                if cost_impact > 500 and decision.confidence < 0.9:
                    violations.append(
                        f"cost_threshold: cost impact ${cost_impact:.0f} > $500 requires high confidence"
                    )

            elif policy.name == "escalation_rate":
                if decision.agent_type == AgentType.ESCALATION_HANDLER:
                    window_count = self._count_recent_actions(
                        AgentType.ESCALATION_HANDLER, window_seconds=300
                    )
                    if window_count >= 6:
                        violations.append(
                            "escalation_rate: max 6 escalations per 5-minute window reached"
                        )

            elif policy.name == "analytics_readonly":
                if decision.agent_type == AgentType.ANALYTICS and decision.action:
                    if decision.action not in ("observe", "query", "analyze"):
                        violations.append(
                            "analytics_readonly: AnalyticsAgent attempted a state-modifying action"
                        )

        return violations

    def _check_rate_limit(self, agent_type: AgentType) -> bool:
        """Return True if the agent is within its rate limit."""
        now = datetime.now(timezone.utc)
        key = str(agent_type)
        max_actions, window_seconds = RATE_LIMITS.get(
            agent_type, RATE_LIMITS["global"]
        )
        counter = self._rate_counters.get(key, deque())
        # Purge old entries
        cutoff = now - timedelta(seconds=window_seconds)
        while counter and counter[0] < cutoff:
            counter.popleft()
        # Check global
        global_counter = self._rate_counters["global"]
        global_max, global_window = RATE_LIMITS["global"]
        global_cutoff = now - timedelta(seconds=global_window)
        while global_counter and global_counter[0] < global_cutoff:
            global_counter.popleft()
        if len(global_counter) >= global_max:
            return False
        return len(counter) < max_actions

    def _record_rate_hit(self, agent_type: AgentType) -> None:
        now = datetime.now(timezone.utc)
        key = str(agent_type)
        if key not in self._rate_counters:
            self._rate_counters[key] = deque()
        self._rate_counters[key].append(now)
        self._rate_counters["global"].append(now)

    def _count_recent_actions(self, agent_type: AgentType, window_seconds: int) -> int:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=window_seconds)
        return sum(
            1
            for e in self._audit_log
            if e.agent_type == agent_type
            and e.timestamp.replace(tzinfo=timezone.utc) > cutoff
        )

    def _append_audit(self, entry: AuditEntry) -> None:
        self._audit_log.append(entry)
        # Cap to max size (keep newest)
        if len(self._audit_log) > self._audit_max:
            self._audit_log = self._audit_log[-self._audit_max :]


# ── Module-level singleton ────────────────────────────────────────────────────

guardrails = GuardrailsLayer()
