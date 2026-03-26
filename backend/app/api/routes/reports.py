"""Session report generation.

Produces a JSON snapshot of the current simulation session, suitable for
export and compliance. No LLM calls — pure data aggregation from in-memory state.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.agents.guardrails import guardrails
from app.services.notifications import notification_service
from app.config import settings

router = APIRouter()


def _report_filename(report: dict) -> str:
    """Build a sanitized PDF filename like SentinelAI_Report_sentinelai_demo_123.pdf"""
    scenario = (report.get("simulationScenario") or "session").strip()
    scenario = scenario.lower().replace(" ", "_").replace("-", "_")
    tick = report.get("simulationTick", 0)
    return f"SentinelAI_Report_{scenario}_{tick}.pdf"


def _build_report_from_state(app_state) -> dict:
    """Aggregate in-memory state into a session report dict.

    Accepts either a Request object (app_state = request.app.state) or
    a raw state object with the same attributes. Used by the REST route,
    email delivery, and Teams bot report generation.
    """
    from app.agents.orchestrator import orchestrator
    from app.services.simulation import simulation_engine

    alerts = list(getattr(app_state, "recent_alerts", []))
    decisions = list(getattr(app_state, "recent_decisions", []))
    negotiations = list(getattr(app_state, "recent_negotiations", []))

    # ── Alert summary ──
    active_alerts = [a for a in alerts if not a.get("resolvedAt")]
    resolved_alerts = [a for a in alerts if a.get("resolvedAt")]
    alerts_by_severity: dict[str, int] = {}
    for a in alerts:
        sev = a.get("severity", "unknown")
        alerts_by_severity[sev] = alerts_by_severity.get(sev, 0) + 1

    # ── Decision summary ──
    decisions_by_agent: dict[str, int] = {}
    decisions_by_guardrail: dict[str, int] = {}
    for d in decisions:
        agent = d.get("agentType", "unknown")
        gr = d.get("guardrailResult", "unknown")
        decisions_by_agent[agent] = decisions_by_agent.get(agent, 0) + 1
        decisions_by_guardrail[gr] = decisions_by_guardrail.get(gr, 0) + 1

    acted = [d for d in decisions if d.get("phase") == "acted"]

    # ── Queue performance summary ──
    queue_summary: dict = {}
    latest_metrics = getattr(app_state, "latest_metrics", {})
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
                    dept_fitness_totals.setdefault(ds.department_name, []).append(
                        ds.fitness_score
                    )

            workforce_summary["byStatus"] = status_counts
            workforce_summary["byRole"] = role_counts
            workforce_summary["byDepartment"] = dept_counts
            workforce_summary["relocated"] = relocated
            workforce_summary["avgPerfScore"] = round(
                perf_total / max(len(all_agents), 1), 3
            )

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


async def _build_report(request: Request) -> dict:
    """Convenience wrapper: extract app.state from a Request and delegate."""
    return _build_report_from_state(request.app.state)


@router.get("/reports/session")
async def session_report(request: Request):
    """Generate a comprehensive session report from in-memory state.

    Returns aggregated metrics, decisions, alerts, cost impact,
    governance scorecard, and routing log — designed for export/compliance.
    """
    return await _build_report(request)


@router.get("/reports/session/pdf")
async def session_report_pdf(request: Request):
    """Generate and return the session report as a PDF file.

    Useful for direct printing/viewing in the browser.
    """
    from fastapi.responses import Response
    from app.services.pdf_report import generate_report_pdf

    report = await _build_report(request)
    pdf_bytes = generate_report_pdf(report)

    filename = _report_filename(report)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )


class _EmptyBody(BaseModel):
    pass


@router.post("/reports/email")
async def email_report(request: Request, body: _EmptyBody = _EmptyBody()):
    """Email the current session report to configured SMTP recipients.

    Generates a compact PDF server-side via fpdf2 and attaches it.
    Requires SMTP to be configured in Settings → Notifications.
    """
    import base64
    from app.services.pdf_report import generate_report_pdf

    if not settings.smtp_host or not settings.smtp_to:
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "message": "SMTP not configured. Go to Settings → Notifications to set it up.",
            },
        )

    report = await _build_report(request)
    pdf_bytes = generate_report_pdf(report)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    ok, message = await notification_service.send_report_email(
        report=report,
        attachment_base64=pdf_b64,
        attachment_name=_report_filename(report),
    )

    if not ok:
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": message},
        )

    return {
        "status": "ok",
        "message": message,
        "sentTo": settings.smtp_to,
    }
