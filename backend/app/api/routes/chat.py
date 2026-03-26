import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.guardrails import guardrails
from app.models.guardrails import AuditEntry, GuardrailStatus

router = APIRouter()

# ── Prompt injection / adversarial input patterns ────────────────────────────

_INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all|prior)\s+instructions",
    r"you\s+are\s+now\b",
    r"act\s+as\s+(a|an)\b",
    r"\bjailbreak\b",
    r"system\s+prompt",
    r"override\s+(your|all|the)\b",
    r"forget\s+(everything|your|all)\b",
    r"disregard\s+(previous|all|the)\b",
    r"new\s+persona\b",
    r"DAN\s+mode",
]

_COMPILED_INJECTIONS = [
    re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS
]


def _detect_injection(message: str) -> str | None:
    """Return the matched pattern description if injection detected, else None."""
    for pattern in _COMPILED_INJECTIONS:
        if pattern.search(message):
            return pattern.pattern
    return None


# ── Request/response models ───────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str


class PolicyRequest(BaseModel):
    rule: str


# ── Context builder ──────────────────────────────────────────────────────────


def _build_chat_context(request: Request) -> dict:
    """Extract live system state from app.state for the Analytics Agent."""
    context: dict = {}
    try:
        context["recent_alerts"] = list(getattr(request.app.state, "recent_alerts", []))[:20]
        context["recent_decisions"] = list(getattr(request.app.state, "recent_decisions", []))[:15]
        context["queue_metrics"] = list(getattr(request.app.state, "latest_metrics", {}).values())
        context["recent_negotiations"] = list(getattr(request.app.state, "recent_negotiations", []))[:5]

        # Cost data from orchestrator
        from app.agents.orchestrator import orchestrator
        context["cost_data"] = {
            "totalSaved": orchestrator._total_saved,
            "revenueAtRisk": orchestrator._revenue_at_risk,
            "totalPreventedAbandoned": orchestrator._prevented_abandoned,
            "actionsToday": orchestrator._actions_today,
        }

        # Governance snapshot
        context["governance"] = guardrails.get_governance_summary()

        # Workforce agent database
        from app.services.agent_database import agent_database
        if agent_database._initialized:
            context["workforce"] = [
                {
                    "id": a.id,
                    "name": a.name,
                    "role": a.role,
                    "currentQueue": a.current_queue_id,
                    "homeQueue": a.home_queue_id,
                    "status": a.status,
                    "topSkills": sorted(
                        [(sp.skill_name, sp.proficiency) for sp in a.skill_proficiencies],
                        key=lambda x: -x[1],
                    )[:4],
                    "deptScores": {
                        ds.department_name: round(ds.fitness_score, 2)
                        for ds in a.department_scores
                    },
                }
                for a in agent_database.get_all_agents()
            ]
    except Exception:
        pass
    return context


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/chat/clear")
async def clear_chat():
    """Clear the LLM conversation history."""
    from app.services.bedrock import clear_conversation
    clear_conversation()
    return {"status": "cleared"}


@router.post("/chat")
async def send_message(body: ChatRequest, request: Request):
    """Send message to conversational interface.

    Messages are screened for prompt injection before reaching the LLM.
    Adversarial inputs are blocked and logged to the audit trail.
    """
    matched = _detect_injection(body.message)
    if matched:
        import uuid
        from datetime import datetime
        from app.models.agent import AgentType
        entry = AuditEntry(
            id=str(uuid.uuid4()),
            decision_id=f"chat-{uuid.uuid4()}",
            agent_type=AgentType.ANALYTICS,
            action="chat_input",
            confidence=0.0,
            risk_score=1.0,
            guardrail_result=GuardrailStatus.BLOCKED,
            policy_violations=[f"prompt_injection: matched pattern '{matched}'"],
            approved_by=None,
            execution_result="blocked",
        )
        guardrails._append_audit(entry)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Potentially adversarial input detected",
                "reason": "Message matches prompt injection pattern",
            },
        )

    from app.agents.analytics import analytics_agent
    from app.services.sanitizer import sanitize_string

    sanitized_message = sanitize_string(body.message)
    context = _build_chat_context(request)
    result = await analytics_agent.query(sanitized_message, context)

    response_message = result.get("message", "")

    return {
        "message": response_message,
        "reasoning": result.get("reasoning", ""),
        "timestamp": result.get("timestamp", ""),
    }


# ── In-memory NL policy store ────────────────────────────────────────────────

_policies: list[dict] = []


def _next_id() -> int:
    """Always start from 1, incrementing past any existing policy IDs."""
    if not _policies:
        return 1
    max_id = max(int(p["id"].replace("policy-", "")) for p in _policies)
    return max_id + 1


@router.post("/chat/policy")
async def create_policy(body: PolicyRequest):
    """Create a natural language policy rule and enforce immediately."""
    from datetime import datetime, timezone

    policy = {
        "id": f"policy-{_next_id()}",
        "rule": body.rule,
        "status": "active",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "stats": {"movesMade": 0, "timesEnforced": 0, "agentsMoved": []},
    }
    _policies.append(policy)

    # Enforce immediately — don't wait for next tick
    actions = enforce_policies()
    return {**policy, "immediateActions": actions}


@router.get("/chat/policies")
async def list_policies():
    """List active NL-defined policies with impact stats."""
    return {"policies": [p for p in _policies if p["status"] == "active"]}


@router.get("/chat/policies/analytics")
async def policy_analytics():
    """Get impact analytics for all policies (active and deleted)."""
    from app.services.agent_database import agent_database

    results = []
    for p in _policies:
        stats = p.get("stats", {"movesMade": 0, "timesEnforced": 0, "agentsMoved": []})

        # For active policies, show current compliance
        compliance = None
        if p["status"] == "active":
            constraints = _parse_min_agents_policy(p["rule"])
            for queue_id, min_count in constraints:
                current = len(agent_database.get_agents_in_queue(queue_id))
                compliance = {
                    "queue": queue_id,
                    "required": min_count,
                    "current": current,
                    "met": current >= min_count,
                }

        results.append({
            "id": p["id"],
            "rule": p["rule"],
            "status": p["status"],
            "createdAt": p.get("createdAt"),
            "movesMade": stats["movesMade"],
            "timesEnforced": stats["timesEnforced"],
            "agentsMoved": stats["agentsMoved"],
            "compliance": compliance,
        })
    return {"analytics": results}


@router.delete("/chat/policies/{policy_id}")
async def delete_policy(policy_id: str):
    """Remove a policy — freed agents are marked available for AI agents to redistribute."""
    from app.services.agent_database import agent_database

    for p in _policies:
        if p["id"] == policy_id:
            constraints = _parse_min_agents_policy(p["rule"])
            threshold_rule = _parse_threshold_policy(p["rule"])

            affected_queues = set()
            for queue_id, _ in constraints:
                affected_queues.add(queue_id)
            if threshold_rule:
                affected_queues.add(threshold_rule[0])

            p["status"] = "deleted"

            # Clear any pending moves for this policy
            keys_to_remove = [k for k in _pending_moves if k[0] == policy_id]
            for k in keys_to_remove:
                _pending_moves.pop(k, None)

            # Mark relocated agents as available so AI agents (Queue Balancer,
            # Escalation Handler) can redistribute them on the very next tick
            # based on real queue pressure — smarter than us guessing here.
            freed = []
            conn = agent_database._connect()
            for queue_id in affected_queues:
                agents = agent_database.get_agents_in_queue(queue_id)
                for agent in agents:
                    if agent.current_queue_id != agent.home_queue_id:
                        conn.execute(
                            "UPDATE agents SET status = 'available' WHERE id = ?",
                            (agent.id,),
                        )
                        freed.append(agent.name)
            conn.commit()

            _policy_logger.info(
                "Policy %s deleted — %d agents freed as available: %s",
                policy_id, len(freed), ", ".join(freed) or "none",
            )

            return {
                "policy_id": policy_id,
                "status": "deleted",
                "agentsFreed": freed,
                "note": "Agents marked available — AI agents will redistribute them on next tick (~2s)",
            }
    raise HTTPException(status_code=404, detail="Policy not found")


# ── Policy enforcement engine ────────────────────────────────────────────────

import re
import logging

_policy_logger = logging.getLogger("sentinelai.policy")

# Pending moves: agents who are busy and will be moved when their call ends
# Key: (policy_id, agent_id, target_queue_id), Value: move details
_pending_moves: dict[tuple, dict] = {}

# Queue name → queue ID mapping
_QUEUE_MAP = {
    "support": "q-support",
    "billing": "q-billing",
    "sales": "q-sales",
    "general": "q-general",
    "vip": "q-vip",
}


def _parse_min_agents_policy(rule: str) -> list[tuple[str, int]]:
    """Parse minimum-agent policies from natural language rules.

    Returns list of (queue_id, min_count) tuples.
    """
    results = []
    lower = rule.lower()

    for queue_name, queue_id in _QUEUE_MAP.items():
        if queue_name not in lower:
            continue

        patterns = [
            r"(?:at\s*least|atleast|minimum|min)\s+(\d+)",
            r"(\d+)\s+agent",
            r"always\s+(?:have\s+)?(\d+)",
            r"keep\s+(?:at\s*least\s+)?(\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, lower)
            if match:
                count = int(match.group(1))
                if count > 0:
                    results.append((queue_id, count))
                    break

    return results


def _parse_threshold_policy(rule: str) -> tuple[str, int, str] | None:
    """Parse threshold-based policies like 'if billing > 15, pull from general'.

    Returns (target_queue_id, threshold, source_queue_id) or None.
    """
    lower = rule.lower()

    # Find which queue has a threshold condition
    target_queue = None
    source_queue = None
    threshold = None

    # Match "if <queue> > N" or "when <queue> > N" or "<queue> queue > N"
    for queue_name, queue_id in _QUEUE_MAP.items():
        match = re.search(
            rf"(?:if|when|whenever)\s+{queue_name}\s*(?:queue\s*)?(?:>|exceeds|over|above|reaches)\s*(\d+)",
            lower,
        )
        if match:
            target_queue = queue_id
            threshold = int(match.group(1))
            break

    if not target_queue or not threshold:
        return None

    # Find source queue ("pull from X", "move from X", "transfer from X")
    pull_match = re.search(r"(?:pull|move|transfer|take)\s+(?:agents?\s+)?from\s+(\w+)", lower)
    if pull_match:
        src_name = pull_match.group(1).lower()
        source_queue = _QUEUE_MAP.get(src_name)

    if not source_queue:
        return None

    return (target_queue, threshold, source_queue)


def enforce_policies(current_metrics: list[dict] | None = None) -> list[str]:
    """Enforce all active policies. Called each simulation tick.

    Args:
        current_metrics: List of queue metric dicts (camelCase) from the current tick.

    Returns list of actions taken (for logging/broadcast).
    """
    from app.services.agent_database import agent_database

    actions_taken = []

    # Process pending moves — agents who were busy and may now be available
    completed_keys = []
    for key, move in _pending_moves.items():
        policy_id, agent_id, target_q = key
        # Check if the policy is still active
        policy_obj = next((p for p in _policies if p["id"] == policy_id and p["status"] == "active"), None)
        if not policy_obj:
            completed_keys.append(key)
            continue

        agent = agent_database.get_agent(agent_id)
        if not agent:
            completed_keys.append(key)
            continue

        if agent.status != "busy" and agent.current_queue_id != target_q:
            success = agent_database.move_agent(agent_id, target_q, force=True)
            if success:
                desc = f"moved {move['agentName']} to {target_q} (call ended, policy {policy_id})"
                actions_taken.append(desc)
                if "stats" in policy_obj:
                    policy_obj["stats"]["movesMade"] += 1
                    if move["agentName"] not in policy_obj["stats"]["agentsMoved"]:
                        policy_obj["stats"]["agentsMoved"].append(move["agentName"])
                _policy_logger.info("Pending move completed: %s → %s", move["agentName"], target_q)
            completed_keys.append(key)
        elif agent.current_queue_id == target_q:
            completed_keys.append(key)  # Already there

    for key in completed_keys:
        _pending_moves.pop(key, None)

    active = [p for p in _policies if p["status"] == "active"]
    if not active:
        return actions_taken

    # Build a contacts-per-queue lookup from live metrics
    queue_contacts: dict[str, int] = {}
    if current_metrics:
        for m in current_metrics:
            qid = m.get("queueId", "")
            queue_contacts[qid] = m.get("currentContacts", 0)

    for policy in active:
        # Ensure stats dict exists (backward compat for policies created before stats)
        if "stats" not in policy:
            policy["stats"] = {"movesMade": 0, "timesEnforced": 0, "agentsMoved": []}

        policy["stats"]["timesEnforced"] += 1

        # ── Type 1: Minimum agent staffing ──
        constraints = _parse_min_agents_policy(policy["rule"])
        for queue_id, min_count in constraints:
            agents_in_queue = agent_database.get_agents_in_queue(queue_id)
            current_count = len(agents_in_queue)

            if current_count >= min_count:
                continue

            needed = min_count - current_count
            _policy_logger.info(
                "Policy '%s': %s has %d/%d agents. Moving %d.",
                policy["id"], queue_id, current_count, min_count, needed,
            )

            candidates = agent_database.get_best_agents_for_department(
                target_dept_id=queue_id,
                count=needed,
                force=True,
            )

            for agent in candidates:
                if agent.status == "busy":
                    # Agent is on a call — mark as pending, will be moved when available
                    pending_key = (policy["id"], agent.id, queue_id)
                    if pending_key not in _pending_moves:
                        _pending_moves[pending_key] = {
                            "policyId": policy["id"],
                            "agentId": agent.id,
                            "agentName": agent.name,
                            "targetQueue": queue_id,
                        }
                        _policy_logger.info(
                            "Policy '%s': %s is busy — queued for move to %s after call ends",
                            policy["id"], agent.name, queue_id,
                        )
                    continue

                success = agent_database.move_agent(agent.id, queue_id, force=True)
                if success:
                    desc = f"moved {agent.name} to {queue_id} (min {min_count})"
                    actions_taken.append(f"Policy {policy['id']}: {desc}")
                    policy["stats"]["movesMade"] += 1
                    if agent.name not in policy["stats"]["agentsMoved"]:
                        policy["stats"]["agentsMoved"].append(agent.name)
                    _policy_logger.info("Moved %s (%s) → %s", agent.name, agent.id, queue_id)

        # ── Type 2: Threshold-based ("if billing > 15, pull from general") ──
        threshold_rule = _parse_threshold_policy(policy["rule"])
        if threshold_rule:
            target_q, threshold, source_q = threshold_rule
            contacts = queue_contacts.get(target_q, 0)

            if contacts <= threshold:
                continue

            _policy_logger.info(
                "Policy '%s': %s has %d contacts (threshold %d). Pulling from %s.",
                policy["id"], target_q, contacts, threshold, source_q,
            )

            candidates = agent_database.get_best_agents_for_department(
                target_dept_id=target_q,
                count=1,
                exclude_queues=[target_q],
                force=True,
            )
            candidates = [a for a in candidates if a.current_queue_id == source_q]

            if candidates:
                agent = candidates[0]
                success = agent_database.move_agent(agent.id, target_q, force=True)
                if success:
                    desc = f"moved {agent.name} from {source_q} to {target_q} (contacts {contacts} > {threshold})"
                    actions_taken.append(f"Policy {policy['id']}: {desc}")
                    policy["stats"]["movesMade"] += 1
                    if agent.name not in policy["stats"]["agentsMoved"]:
                        policy["stats"]["agentsMoved"].append(agent.name)
                    _policy_logger.info("Moved %s (%s) %s → %s", agent.name, agent.id, source_q, target_q)

    return actions_taken
