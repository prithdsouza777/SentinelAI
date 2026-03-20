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
    }
