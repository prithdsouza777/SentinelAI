"""Tool definitions and executors for the Command Center chat.

Exposes structured tools that the Anthropic LLM can call to query live system state.
The LLM decides which tools to invoke based on the conversation — no hardcoded routing.
"""

import logging

logger = logging.getLogger("sentinelai.chat_tools")

# ── Department mappings ──────────────────────────────────────────────────────

DEPT_NAME_TO_ID = {
    "support": "q-support", "billing": "q-billing", "sales": "q-sales",
    "general": "q-general", "vip": "q-vip",
}
DEPT_ID_TO_NAME = {v: k.title() for k, v in DEPT_NAME_TO_ID.items()}

# ── Tool definitions (Anthropic format) ──────────────────────────────────────

TOOLS = [
    {
        "name": "get_queue_status",
        "description": "Get current real-time metrics for all queues or a specific queue. Returns contacts in queue, agents online/available, wait times, service level, and abandonment rate.",
        "input_schema": {
            "type": "object",
            "properties": {
                "queue_name": {
                    "type": "string",
                    "description": "Optional: Support, Billing, Sales, General, or VIP. Omit for all queues.",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_agents_by_department",
        "description": "Get human agents ranked by fitness score for a specific department. Shows name, role, proficiency, status, and whether they're relocated.",
        "input_schema": {
            "type": "object",
            "properties": {
                "department": {
                    "type": "string",
                    "description": "Department name: Support, Billing, Sales, General, or VIP",
                }
            },
            "required": ["department"],
        },
    },
    {
        "name": "get_agent_profile",
        "description": "Get the full profile of a specific human agent: all skill proficiencies, department fitness scores, current assignment, and status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {
                    "type": "string",
                    "description": "Agent's first name (e.g., Alice, Dave, Uma)",
                }
            },
            "required": ["agent_name"],
        },
    },
    {
        "name": "check_move_feasibility",
        "description": "Check whether moving an agent to a department is advisable. Returns fitness scores, impact analysis, and recommendation WITHOUT actually moving. Use this when the user asks 'should I move...', 'is it a good idea...', 'what if I moved...'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string", "description": "Agent's first name"},
                "target_department": {"type": "string", "description": "Target: Support, Billing, Sales, General, or VIP"},
            },
            "required": ["agent_name", "target_department"],
        },
    },
    {
        "name": "move_agent",
        "description": "EXECUTE a move — actually transfer a human agent to a different department. Only use when the user gives a direct command like 'move Dave to Sales' or confirms 'yes, do it'. Do NOT use for questions or feasibility checks.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_name": {"type": "string", "description": "Agent's first name"},
                "target_department": {"type": "string", "description": "Target: Support, Billing, Sales, General, or VIP"},
            },
            "required": ["agent_name", "target_department"],
        },
    },
    {
        "name": "get_alerts",
        "description": "Get active and recently resolved alerts with severity, queue, description, and timestamps.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status_filter": {
                    "type": "string",
                    "enum": ["active", "resolved", "all"],
                    "description": "Filter alerts. Default: all",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_recent_decisions",
        "description": "Get recent autonomous AI agent decisions: which agent acted, what it did, confidence score, and guardrail result.",
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_type": {
                    "type": "string",
                    "enum": ["queue_balancer", "predictive_prevention", "escalation_handler", "all"],
                    "description": "Optional filter by AI agent type. Default: all",
                }
            },
            "required": [],
        },
    },
    {
        "name": "get_cost_summary",
        "description": "Get cost impact analysis: total saved, revenue at risk, prevented abandoned calls, actions taken, and recovery rate.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_incident_summary",
        "description": "Get a summary of recent incidents: what happened, which agents acted, negotiations, cost impact, and current state.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ── Tool executors ───────────────────────────────────────────────────────────


def execute_tool(tool_name: str, tool_input: dict, context: dict) -> str:
    """Execute a tool and return the result as a formatted string."""
    executors = {
        "get_queue_status": _exec_queue_status,
        "get_agents_by_department": _exec_agents_by_dept,
        "get_agent_profile": _exec_agent_profile,
        "check_move_feasibility": _exec_check_move,
        "move_agent": _exec_move_agent,
        "get_alerts": _exec_alerts,
        "get_recent_decisions": _exec_decisions,
        "get_cost_summary": _exec_cost_summary,
        "get_incident_summary": _exec_incident_summary,
    }
    executor = executors.get(tool_name)
    if not executor:
        return f"Unknown tool: {tool_name}"
    try:
        return executor(tool_input, context)
    except Exception as e:
        logger.warning("Tool %s failed: %s", tool_name, e)
        return f"Error executing {tool_name}: {e}"


def _exec_queue_status(inp: dict, ctx: dict) -> str:
    queues = ctx.get("queue_metrics", [])
    if not queues:
        return "No queue metrics available. The simulation may be idle."

    target = inp.get("queue_name", "").lower()
    if target:
        queues = [q for q in queues if q.get("queueName", "").lower() == target]
        if not queues:
            return f"No queue found matching '{target}'. Valid: Support, Billing, Sales, General, VIP."

    lines = ["Queue | Contacts | Online | Available | Wait(s) | SvcLevel | Abandon%"]
    for q in queues:
        name = q.get("queueName", "?")
        contacts = q.get("contactsInQueue", 0)
        online = q.get("agentsOnline", 0)
        avail = q.get("agentsAvailable", 0)
        wait = q.get("avgWaitTime", 0)
        sl = q.get("serviceLevel", 0)
        aband = q.get("abandonmentRate", 0)
        pressure = contacts / max(avail, 1)
        status = "CRITICAL" if aband > 15 else "WARNING" if aband > 8 else "OK"
        lines.append(
            f"{name} | {contacts} | {online} | {avail} | {wait:.0f} | {sl:.0f}% | {aband:.1f}% | pressure={pressure:.1f}x | {status}"
        )
    return "\n".join(lines)


def _exec_agents_by_dept(inp: dict, ctx: dict) -> str:
    dept_name = inp.get("department", "").strip().lower()
    dept_id = DEPT_NAME_TO_ID.get(dept_name)
    if not dept_id:
        return f"Invalid department '{dept_name}'. Valid: Support, Billing, Sales, General, VIP."

    try:
        from app.services.agent_database import agent_database
        agents = agent_database.get_all_agents()
        agents.sort(key=lambda a: a.department_score_for(dept_id), reverse=True)

        dept_display = dept_name.title()
        lines = [f"Agents ranked by {dept_display} fitness:"]
        for i, a in enumerate(agents[:10], 1):
            score = a.department_score_for(dept_id)
            current = a.current_queue_id.replace("q-", "").title()
            relocated = " (RELOCATED)" if a.current_queue_id != a.home_queue_id else ""
            top_skills = sorted(a.skill_proficiencies, key=lambda s: -s.proficiency)[:3]
            skills_str = ", ".join(f"{s.skill_name}={s.proficiency:.0%}" for s in top_skills)
            lines.append(
                f"{i}. {a.name} ({a.role}) — fitness: {score:.0%} | "
                f"status: {a.status} | current: {current}{relocated} | top skills: {skills_str}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Error querying workforce: {e}"


def _exec_agent_profile(inp: dict, ctx: dict) -> str:
    name = inp.get("agent_name", "").strip()

    try:
        from app.services.agent_database import agent_database

        agent = agent_database.get_agent_by_name(name)
        if not agent:
            # Show available names for help
            all_agents = agent_database.get_all_agents()
            names = ", ".join(a.name for a in all_agents[:10])
            return f"Agent '{name}' not found. Available agents include: {names}..."

        current = agent.current_queue_id.replace("q-", "").title()
        home = agent.home_queue_id.replace("q-", "").title()
        relocated = f" (RELOCATED from {home})" if agent.current_queue_id != agent.home_queue_id else ""

        lines = [
            f"Agent: {agent.name}",
            f"Role: {agent.role}",
            f"Status: {agent.status}",
            f"Current department: {current}{relocated}",
            f"Home department: {home}",
            f"",
            f"Department fitness scores:",
        ]
        for ds in sorted(agent.department_scores, key=lambda d: -d.fitness_score):
            bar = "#" * int(ds.fitness_score * 20)
            lines.append(f"  {ds.department_name}: {ds.fitness_score:.0%} {bar}")

        lines.append(f"\nTop skills:")
        for sp in sorted(agent.skill_proficiencies, key=lambda s: -s.proficiency)[:8]:
            lines.append(f"  {sp.skill_name.replace('_', ' ')}: {sp.proficiency:.0%}")

        return "\n".join(lines)
    except Exception as e:
        return f"Error querying agent: {e}"


def _exec_check_move(inp: dict, ctx: dict) -> str:
    agent_name = inp.get("agent_name", "").strip()
    target_dept = inp.get("target_department", "").strip().lower()

    target_queue_id = DEPT_NAME_TO_ID.get(target_dept)
    if not target_queue_id:
        return f"Invalid department '{target_dept}'. Valid: Support, Billing, Sales, General, VIP."

    try:
        from app.services.agent_database import agent_database

        agent = agent_database.get_agent_by_name(agent_name)
        if not agent:
            return f"Agent '{agent_name}' not found."

        dept = target_dept.title()
        current_dept = agent.current_queue_id.replace("q-", "").title()

        if agent.current_queue_id == target_queue_id:
            return f"{agent.name} is already in {dept}."

        allowed, fitness, msg = agent_database.check_move_fitness(agent.id, target_queue_id)

        # Get current department fitness for comparison
        current_fitness = 0.0
        for ds in agent.department_scores:
            if ds.department_id == agent.current_queue_id:
                current_fitness = ds.fitness_score
                break

        lines = [
            f"Feasibility check: {agent.name} from {current_dept} to {dept}",
            f"",
            f"Current department ({current_dept}) fitness: {current_fitness:.0%}",
            f"Target department ({dept}) fitness: {fitness:.0%}",
            f"Fitness change: {fitness - current_fitness:+.0%}",
            f"",
            f"Guardrail result: {'ALLOWED' if allowed else 'BLOCKED'}",
        ]
        if not allowed:
            lines.append(f"Block reason: {msg}")

        # Top skills relevant to target dept
        lines.append(f"\n{agent.name}'s top skills:")
        for sp in sorted(agent.skill_proficiencies, key=lambda s: -s.proficiency)[:5]:
            lines.append(f"  {sp.skill_name.replace('_', ' ')}: {sp.proficiency:.0%}")

        return "\n".join(lines)
    except Exception as e:
        return f"Check failed: {e}"


def _exec_move_agent(inp: dict, ctx: dict) -> str:
    agent_name = inp.get("agent_name", "").strip()
    target_dept = inp.get("target_department", "").strip().lower()

    target_queue_id = DEPT_NAME_TO_ID.get(target_dept)
    if not target_queue_id:
        return f"Invalid department '{target_dept}'. Valid: Support, Billing, Sales, General, VIP."

    try:
        from app.services.agent_database import agent_database
        from app.services.simulation import simulation_engine

        agent = agent_database.get_agent_by_name(agent_name)
        if not agent:
            return f"Agent '{agent_name}' not found."

        if agent.current_queue_id == target_queue_id:
            dept = target_dept.title()
            return f"{agent.name} is already in {dept}."

        allowed, fitness, msg = agent_database.check_move_fitness(agent.id, target_queue_id)
        dept = target_dept.title()
        old_dept = agent.current_queue_id.replace("q-", "").title()

        if not allowed:
            return f"BLOCKED: {msg}"

        old_queue = agent.current_queue_id
        agent_database.move_agent(agent.id, target_queue_id)
        simulation_engine.adjust_queue(old_queue, -1)
        simulation_engine.adjust_queue(target_queue_id, +1)

        return (
            f"SUCCESS: Moved {agent.name} from {old_dept} to {dept} (fitness: {fitness:.0%})."
        )
    except Exception as e:
        return f"Move failed: {e}"


def _exec_alerts(inp: dict, ctx: dict) -> str:
    alerts = ctx.get("recent_alerts", [])
    if not alerts:
        return "No alerts. All queues operating within normal parameters."

    status_filter = inp.get("status_filter", "all")
    if status_filter == "active":
        alerts = [a for a in alerts[:30] if not a.get("resolvedAt")]
    elif status_filter == "resolved":
        alerts = [a for a in alerts[:30] if a.get("resolvedAt")]
    else:
        alerts = alerts[:20]

    active = [a for a in alerts if not a.get("resolvedAt")]
    resolved = [a for a in alerts if a.get("resolvedAt")]

    lines = [f"Alerts: {len(active)} active, {len(resolved)} resolved"]
    for a in alerts[:12]:
        sev = a.get("severity", "?").upper()
        qname = a.get("queueName", a.get("queueId", "?"))
        desc = a.get("description", a.get("message", ""))
        status = "RESOLVED" if a.get("resolvedAt") else "ACTIVE"
        lines.append(f"[{sev}] {qname}: {desc} — {status}")
    return "\n".join(lines)


def _exec_decisions(inp: dict, ctx: dict) -> str:
    decisions = ctx.get("recent_decisions", [])
    if not decisions:
        return "No AI agent decisions yet. Agents are in observation mode."

    agent_filter = inp.get("agent_type", "all")
    if agent_filter and agent_filter != "all":
        decisions = [d for d in decisions if d.get("agentType") == agent_filter]

    lines = [f"Recent AI decisions ({len(decisions[:15])} shown):"]
    for d in decisions[:15]:
        agent = d.get("agentType", "?")
        phase = d.get("phase", "?")
        summary = d.get("summary", "N/A")
        conf = d.get("confidence", 0)
        guardrail = d.get("guardrailResult", "?")
        reasoning = d.get("reasoning", "")[:150]
        lines.append(f"[{agent}] ({phase}) {summary} | confidence={conf:.0%} | guardrail={guardrail}")
        if reasoning:
            lines.append(f"  -> {reasoning}")
    return "\n".join(lines)


def _exec_cost_summary(inp: dict, ctx: dict) -> str:
    from app.agents.orchestrator import orchestrator
    from app.agents.guardrails import guardrails

    saved = orchestrator._total_saved
    risk = orchestrator._revenue_at_risk
    prevented = orchestrator._prevented_abandoned
    actions = orchestrator._actions_today
    recovery = min(100, (saved / (saved + risk)) * 100) if (saved + risk) > 0 else 0

    lines = [
        "Cost Impact Summary:",
        f"  Total saved: ${saved:,.2f}",
        f"  Revenue at risk: ${risk:,.2f}",
        f"  Recovery rate: {recovery:.0f}%",
        f"  Abandoned calls prevented: {prevented}",
        f"  AI actions taken: {actions}",
    ]

    governance = guardrails.get_governance_summary()
    total_dec = governance.get("totalDecisions", 0)
    if total_dec:
        lines.append(f"\nGovernance: {governance.get('autoApproved', 0)} auto-approved, "
                      f"{governance.get('humanApproved', 0)} human-approved, "
                      f"{governance.get('blocked', 0)} blocked")

    return "\n".join(lines)


def _exec_incident_summary(inp: dict, ctx: dict) -> str:
    from app.agents.orchestrator import orchestrator

    alerts = ctx.get("recent_alerts", [])
    decisions = ctx.get("recent_decisions", [])
    negotiations = ctx.get("recent_negotiations", [])
    cost = {
        "totalSaved": orchestrator._total_saved,
        "totalPreventedAbandoned": orchestrator._prevented_abandoned,
    }
    queues = ctx.get("queue_metrics", [])

    active = [a for a in alerts[:20] if not a.get("resolvedAt")]
    resolved = [a for a in alerts[:20] if a.get("resolvedAt")]
    acted = [d for d in decisions if d.get("phase") == "acted"]

    lines = [f"Incident Summary: {len(active)} active alerts, {len(resolved)} resolved, {len(acted)} AI actions"]

    if active:
        lines.append("\nActive alerts:")
        for a in active[:5]:
            lines.append(f"  [{a.get('severity', '?').upper()}] {a.get('queueName', '?')}: {a.get('description', '')}")

    agent_actions: dict[str, list] = {}
    for d in decisions[:20]:
        agent = d.get("agentType", "?")
        agent_actions.setdefault(agent, []).append(d)

    if agent_actions:
        lines.append("\nAgent activity:")
        for agent, acts in agent_actions.items():
            count = len([a for a in acts if a.get("phase") == "acted"])
            latest = acts[0].get("summary", "monitoring")
            lines.append(f"  {agent}: {count} actions — latest: {latest}")

    if negotiations:
        lines.append("\nNegotiations:")
        for n in negotiations[:3]:
            lines.append(f"  {n.get('resolution', 'resolved')}")

    saved = cost.get("totalSaved", 0)
    if saved:
        lines.append(f"\nCost impact: ${saved:,.0f} saved, {cost.get('totalPreventedAbandoned', 0)} calls preserved")

    high_pressure = []
    for q in queues:
        contacts = q.get("contactsInQueue", 0)
        avail = max(q.get("agentsAvailable", 1), 1)
        if contacts / avail > 2:
            high_pressure.append(f"{q.get('queueName', '?')} ({contacts / avail:.1f}x)")
    if high_pressure:
        lines.append(f"\nQueues under pressure: {', '.join(high_pressure)}")

    return "\n".join(lines)
