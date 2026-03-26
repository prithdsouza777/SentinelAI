"""Server-side PDF report generation using fpdf2.

Consumes the same dict that _build_report_from_state() returns and produces
a styled PDF with executive summary, cost impact, alerts, decisions, queue
performance, workforce, and governance sections.
"""

import logging
from datetime import datetime, timezone

from fpdf import FPDF

logger = logging.getLogger("sentinelai.pdf_report")

# ── Colour palette ───────────────────────────────────────────────────────────
_BLUE = (59, 130, 246)       # primary accent
_DARK = (30, 41, 59)         # heading text
_MUTED = (100, 116, 139)     # subtle text
_GREEN = (16, 185, 129)
_AMBER = (245, 158, 11)
_RED = (239, 68, 68)
_BG_LIGHT = (248, 250, 252)  # section background
_WHITE = (255, 255, 255)


def generate_report_pdf(report: dict) -> bytes:
    """Generate a full session report PDF. Returns raw bytes."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Header ────────────────────────────────────────────────────────────
    pdf.set_fill_color(*_BLUE)
    pdf.rect(0, 0, 210, 32, "F")
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_WHITE)
    pdf.set_y(8)
    pdf.cell(0, 10, "SentinelAI Session Report", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    scenario = report.get("simulationScenario", "Idle")
    tick = report.get("simulationTick", 0)
    generated = report.get("generatedAt", datetime.now(timezone.utc).isoformat())
    pdf.cell(0, 6, f"Scenario: {scenario}  |  Tick: {tick}  |  Generated: {generated[:19]}Z", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_y(38)
    pdf.set_text_color(*_DARK)

    # ── Executive Summary (Cost Impact) ───────────────────────────────────
    _section_header(pdf, "Executive Summary")
    cost = report.get("costImpact", {})
    _kpi_row(pdf, [
        ("Total Saved", f"${cost.get('totalSaved', 0):,.2f}"),
        ("Revenue at Risk", f"${cost.get('revenueAtRisk', 0):,.2f}"),
        ("Prevented Abandoned", str(cost.get("preventedAbandoned", 0))),
        ("AI Actions", str(cost.get("actionsToday", 0))),
    ])
    pdf.ln(4)

    # ── Governance ────────────────────────────────────────────────────────
    _section_header(pdf, "Governance")
    gov = report.get("governance", {})
    _kpi_row(pdf, [
        ("Total Decisions", str(gov.get("totalDecisions", 0))),
        ("Auto-Approved", str(gov.get("autoApproved", 0))),
        ("Human-Approved", str(gov.get("humanApproved", 0))),
        ("Blocked", str(gov.get("blocked", 0))),
    ])
    avg_conf = gov.get("avgConfidence", 0)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 6, f"Average Confidence: {avg_conf * 100:.1f}%", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(*_DARK)
    pdf.ln(4)

    # ── Alerts ────────────────────────────────────────────────────────────
    _section_header(pdf, "Alerts")
    alerts = report.get("alerts", {})
    by_sev = alerts.get("bySeverity", {})
    _kpi_row(pdf, [
        ("Total", str(alerts.get("total", 0))),
        ("Active", str(alerts.get("active", 0))),
        ("Resolved", str(alerts.get("resolved", 0))),
        ("Critical", str(by_sev.get("critical", 0))),
    ])
    pdf.ln(4)

    # ── Decisions ─────────────────────────────────────────────────────────
    _section_header(pdf, "AI Decisions")
    decisions = report.get("decisions", {})
    by_agent = decisions.get("byAgent", {})
    by_gr = decisions.get("byGuardrailResult", {})
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, f"Total: {decisions.get('total', 0)}  |  Executed: {decisions.get('executed', 0)}", new_x="LMARGIN", new_y="NEXT")

    if by_agent:
        _mini_table(pdf, "By Agent", by_agent)
    if by_gr:
        _mini_table(pdf, "By Guardrail", by_gr)
    pdf.ln(4)

    # ── Queue Performance ─────────────────────────────────────────────────
    queues = report.get("queues", {})
    if queues:
        _section_header(pdf, "Queue Performance")
        headers = ["Queue", "Contacts", "Agents", "Available", "Wait (s)", "Abandon %", "SLA %"]
        col_widths = [36, 22, 22, 24, 22, 26, 22]
        _table_header(pdf, headers, col_widths)
        for name, q in queues.items():
            row = [
                name,
                str(q.get("currentContacts", 0)),
                str(q.get("agentsOnline", 0)),
                str(q.get("agentsAvailable", 0)),
                str(q.get("avgWaitTime", 0)),
                str(q.get("abandonmentRate", 0)),
                str(q.get("serviceLevel", 0)),
            ]
            _table_row(pdf, row, col_widths)
        pdf.ln(4)

    # ── Workforce ─────────────────────────────────────────────────────────
    workforce = report.get("workforce", {})
    if workforce.get("totalAgents", 0) > 0:
        _section_header(pdf, "Workforce Summary")
        by_status = workforce.get("byStatus", {})
        by_dept = workforce.get("byDepartment", {})
        pdf.set_font("Helvetica", "", 9)
        status_str = ", ".join(f"{k}: {v}" for k, v in by_status.items())
        dept_str = ", ".join(f"{k}: {v}" for k, v in by_dept.items())
        pdf.cell(0, 6, f"Total Agents: {workforce.get('totalAgents', 0)}  |  Relocated: {workforce.get('relocated', 0)}  |  Avg Perf: {workforce.get('avgPerfScore', 0):.3f}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"By Status: {status_str}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 6, f"By Department: {dept_str}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

        # Top performers
        top = workforce.get("topPerformers", [])
        if top:
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Top Performers", new_x="LMARGIN", new_y="NEXT")
            headers = ["Name", "Role", "Department", "Perf Score", "Top Skill"]
            col_widths = [32, 28, 32, 28, 54]
            _table_header(pdf, headers, col_widths)
            for p in top:
                row = [
                    p.get("name", ""),
                    p.get("role", ""),
                    p.get("department", ""),
                    str(p.get("perfScore", 0)),
                    p.get("topSkill", ""),
                ]
                _table_row(pdf, row, col_widths)
        pdf.ln(4)

        # Department fitness
        dept_fitness = workforce.get("departmentFitness", {})
        if dept_fitness:
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Department Fitness Scores", new_x="LMARGIN", new_y="NEXT")
            headers = ["Department", "Avg Fitness"]
            col_widths = [60, 40]
            _table_header(pdf, headers, col_widths)
            for dept, score in dept_fitness.items():
                _table_row(pdf, [dept, f"{score:.3f}"], col_widths)
        pdf.ln(4)

    # ── Skill Routing ─────────────────────────────────────────────────────
    routing = report.get("skillRouting", {})
    recent = routing.get("recentRoutings", [])
    if recent:
        _section_header(pdf, f"Skill Routing (last {len(recent)} of {routing.get('totalRouted', 0)})")
        headers = ["Contact", "Agent", "Score", "Tick", "Reasoning"]
        col_widths = [28, 28, 20, 16, 82]
        _table_header(pdf, headers, col_widths)
        for r in recent[:15]:
            row = [
                str(r.get("contactId", ""))[:10],
                str(r.get("agentId", ""))[:10],
                f"{r.get('score', 0):.2f}" if isinstance(r.get("score"), (int, float)) else str(r.get("score", "")),
                str(r.get("tick", "")),
                str(r.get("reasoning", ""))[:40],
            ]
            _table_row(pdf, row, col_widths)

    # ── Footer ────────────────────────────────────────────────────────────
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 6, "SentinelAI — Autonomous AI Operations Layer for AWS Connect  |  Built by CirrusLabs", align="C")

    return bytes(pdf.output())


# ── Helpers ──────────────────────────────────────────────────────────────────


def _section_header(pdf: FPDF, title: str) -> None:
    """Render a section header with underline."""
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*_DARK)
    pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*_BLUE)
    pdf.set_line_width(0.5)
    pdf.line(pdf.l_margin, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)


def _kpi_row(pdf: FPDF, items: list[tuple[str, str]]) -> None:
    """Render a row of KPI cards."""
    card_w = (190 - (len(items) - 1) * 3) / len(items)
    start_x = pdf.l_margin
    y = pdf.get_y()

    for i, (label, value) in enumerate(items):
        x = start_x + i * (card_w + 3)
        pdf.set_fill_color(*_BG_LIGHT)
        pdf.rect(x, y, card_w, 14, "F")
        pdf.set_xy(x + 2, y + 1)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*_MUTED)
        pdf.cell(card_w - 4, 5, label.upper())
        pdf.set_xy(x + 2, y + 6)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*_DARK)
        pdf.cell(card_w - 4, 6, value)

    pdf.set_y(y + 16)
    pdf.set_text_color(*_DARK)


def _table_header(pdf: FPDF, headers: list[str], widths: list[float]) -> None:
    """Render table header row."""
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(*_BLUE)
    pdf.set_text_color(*_WHITE)
    for h, w in zip(headers, widths):
        pdf.cell(w, 6, h, border=0, fill=True)
    pdf.ln()
    pdf.set_text_color(*_DARK)


def _table_row(pdf: FPDF, cells: list[str], widths: list[float]) -> None:
    """Render a single table data row."""
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_DARK)
    for val, w in zip(cells, widths):
        pdf.cell(w, 5, val, border=0)
    pdf.ln()


def _mini_table(pdf: FPDF, title: str, data: dict) -> None:
    """Render a small two-column key-value summary."""
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 5, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_DARK)
    for k, v in data.items():
        label = k.replace("_", " ").title()
        pdf.cell(50, 5, f"  {label}")
        pdf.cell(30, 5, str(v), new_x="LMARGIN", new_y="NEXT")
