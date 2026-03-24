"""Session report generation.

Produces a JSON snapshot of the current simulation session, suitable for
export and compliance. No LLM calls — pure data aggregation from in-memory state.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.agents.guardrails import guardrails

router = APIRouter()


@router.get("/reports/session")
async def session_report(request: Request):
    """Generate a comprehensive session report from in-memory state.

    Returns aggregated metrics, decisions, alerts, cost impact,
    governance scorecard, and routing log — designed for export/compliance.
    """
    from app.agents.orchestrator import orchestrator
    from app.services.simulation import simulation_engine

    alerts = list(getattr(request.app.state, "recent_alerts", []))
    decisions = list(getattr(request.app.state, "recent_decisions", []))
    negotiations = list(getattr(request.app.state, "recent_negotiations", []))
    metrics_history = list(getattr(request.app.state, "metrics_history", []))

    # ── Alert summary ──
    active_alerts = [a for a in alerts if not a.get("resolvedAt")]
    resolved_alerts = [a for a in alerts if a.get("resolvedAt")]
    alerts_by_severity = {}
    for a in alerts:
        sev = a.get("severity", "unknown")
        alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

    # ── Decision summary ──
    decisions_by_agent = {}
    decisions_by_guardrail = {}
    for d in decisions:
        agent = d.get("agentType", "unknown")
        gr = d.get("guardrailResult", "unknown")
        decisions_by_agent[agent] = decisions_by_agent.get(agent, 0) + 1
        decisions_by_guardrail[gr] = decisions_by_guardrail.get(gr, 0) + 1

    acted = [d for d in decisions if d.get("phase") == "acted"]

    # ── Queue performance summary ──
    queue_summary = {}
    latest_metrics = getattr(request.app.state, "latest_metrics", {})
    for qid, m in latest_metrics.items():
        queue_summary[m.get("queueName", qid)] = {
            "queueId": qid,
            "currentContacts": m.get("contactsInQueue", 0),
            "agentsOnline": m.get("agentsOnline", 0),
            "agentsAvailable": m.get("agentsAvailable", 0),
            "avgWaitTime": round(m.get("avgWaitTime", 0), 1),
            "abandonmentRate": round(m.get("abandonmentRate", 0), 1),
            "serviceLevel": round(m.get("serviceLevel", 0), 1),
        }

    # ── Routing log ──
    routing_log = simulation_engine._routing_log[-20:]

    # ── Workforce summary ──
    workforce_summary: dict = {
        "totalAgents": 0,
        "byStatus": {},
        "byRole": {},
        "byDepartment": {},
        "relocated": 0,
        "avgPerfScore": 0,
        "topPerformers": [],
        "departmentFitness": {},
    }
    try:
        from app.services.agent_database import agent_database
        if agent_database._initialized:
            all_agents = agent_database.get_all_agents()
            workforce_summary["totalAgents"] = len(all_agents)

            # By status
            status_counts: dict[str, int] = {}
            role_counts: dict[str, int] = {}
            dept_counts: dict[str, int] = {}
            relocated = 0
            perf_total = 0.0
            dept_fitness_totals: dict[str, list[float]] = {}

            for a in all_agents:
                status_counts[a.status] = status_counts.get(a.status, 0) + 1
                role_counts[a.role] = role_counts.get(a.role, 0) + 1
                dept_name = a.current_queue_id.replace("q-", "").title()
                dept_counts[dept_name] = dept_counts.get(dept_name, 0) + 1
                if a.current_queue_id != a.home_queue_id:
                    relocated += 1
                perf_total += a.perf_score
                for ds in a.department_scores:
                    dept_fitness_totals.setdefault(ds.department_name, []).append(ds.fitness_score)

            workforce_summary["byStatus"] = status_counts
            workforce_summary["byRole"] = role_counts
            workforce_summary["byDepartment"] = dept_counts
            workforce_summary["relocated"] = relocated
            workforce_summary["avgPerfScore"] = round(perf_total / max(len(all_agents), 1), 3)

            # Top 5 performers
            sorted_by_perf = sorted(all_agents, key=lambda a: -a.perf_score)[:5]
            workforce_summary["topPerformers"] = [
                {
                    "name": a.name,
                    "role": a.role,
                    "department": a.current_queue_id.replace("q-", "").title(),
                    "perfScore": round(a.perf_score, 3),
                    "topSkill": max(
                        [(sp.skill_name, sp.proficiency) for sp in a.skill_proficiencies],
                        key=lambda x: x[1],
                        default=("none", 0),
                    )[0].replace("_", " "),
                }
                for a in sorted_by_perf
            ]

            # Average fitness per department
            workforce_summary["departmentFitness"] = {
                dept: round(sum(scores) / len(scores), 3)
                for dept, scores in dept_fitness_totals.items()
            }
    except Exception:
        pass

    return {
        "reportType": "session_summary",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "simulationTick": simulation_engine.tick,
        "simulationScenario": simulation_engine.scenario,

        "alerts": {
            "total": len(alerts),
            "active": len(active_alerts),
            "resolved": len(resolved_alerts),
            "bySeverity": alerts_by_severity,
        },

        "decisions": {
            "total": len(decisions),
            "executed": len(acted),
            "byAgent": decisions_by_agent,
            "byGuardrailResult": decisions_by_guardrail,
        },

        "negotiations": {
            "total": len(negotiations),
        },

        "costImpact": {
            "totalSaved": round(orchestrator._total_saved, 2),
            "revenueAtRisk": round(orchestrator._revenue_at_risk, 2),
            "preventedAbandoned": orchestrator._prevented_abandoned,
            "actionsToday": orchestrator._actions_today,
        },

        "governance": guardrails.get_governance_summary(),

        "queues": queue_summary,

        "skillRouting": {
            "totalRouted": len(simulation_engine._routing_log),
            "recentRoutings": routing_log,
        },

        "workforce": workforce_summary,
    }
