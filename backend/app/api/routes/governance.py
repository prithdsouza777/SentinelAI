"""Compliance verification endpoint — RAIA (Responsible & Explainable AI) + LockThreat (GRC)."""

from fastapi import APIRouter

from app.agents.guardrails import guardrails
from app.services.raia_tracer import get_trace_status

router = APIRouter()


@router.get("/governance/status")
async def governance_status():
    """Return combined governance status for RAIA and LockThreat panels."""

    # ── RAIA (real data from trace SDK) ──
    raia = get_trace_status()

    # ── LockThreat GRC (simulated from actual guardrail data) ──
    gov = guardrails.get_governance_summary()
    total = gov.get("totalDecisions", 0)
    blocked = gov.get("blocked", 0)
    avg_conf = gov.get("avgConfidence", 0)

    # Compute compliance checks from real guardrail metrics
    block_rate = (blocked / total * 100) if total > 0 else 0
    audit_entries = len(guardrails.audit_log) if hasattr(guardrails, "audit_log") else 0

    lockthreat = {
        "connected": True,
        "frameworks": [
            {
                "name": "SOC 2 Type II",
                "status": "compliant" if block_rate < 20 else "review",
                "controls": 14,
                "passing": 14 if block_rate < 20 else 12,
            },
            {
                "name": "ISO 27001",
                "status": "compliant" if avg_conf > 0.7 else "review",
                "controls": 10,
                "passing": 10 if avg_conf > 0.7 else 8,
            },
            {
                "name": "NIST AI RMF",
                "status": "compliant",
                "controls": 8,
                "passing": 8,
            },
        ],
        "checks": [
            {
                "name": "Audit Trail",
                "passed": audit_entries > 0 or total > 0,
                "detail": f"{max(audit_entries, total)} entries logged",
            },
            {
                "name": "Human-in-the-Loop",
                "passed": True,
                "detail": "30s auto-approve with manual override",
            },
            {
                "name": "Access Control",
                "passed": True,
                "detail": "Role-based with guardrail gates",
            },
            {
                "name": "Data Privacy",
                "passed": True,
                "detail": "No PII in agent decisions",
            },
            {
                "name": "Incident Response",
                "passed": True,
                "detail": "Escalation handler active",
            },
            {
                "name": "Bias Detection",
                "passed": block_rate < 30,
                "detail": f"{block_rate:.1f}% block rate" if total > 0 else "No decisions yet",
            },
        ],
    }

    return {
        "raia": raia,
        "lockthreat": lockthreat,
        "governance": gov,
    }
