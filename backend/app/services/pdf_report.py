"""Server-side PDF report generation using fpdf2.

Produces a premium-styled PDF from the session report dict using Inter font.
Designed to be 2-3 pages for a typical simulation session.
"""

import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

from fpdf import FPDF

logger = logging.getLogger("sentinelai.pdf_report")

# ── Font paths ────────────────────────────────────────────────────────────────
_FONT_DIR = Path(__file__).parent / "fonts"

# ── Colour palette (modern dark-cool theme) ───────────────────────────────────
_SLATE_900 = (15, 23, 42)
_SLATE_800 = (30, 41, 59)
_SLATE_700 = (51, 65, 85)
_SLATE_600 = (71, 85, 105)
_SLATE_500 = (100, 116, 139)
_SLATE_400 = (148, 163, 184)
_SLATE_300 = (203, 213, 225)
_SLATE_200 = (226, 232, 240)
_SLATE_100 = (241, 245, 249)
_SLATE_50 = (248, 250, 252)
_WHITE = (255, 255, 255)

# Accent colours
_BLUE_600 = (37, 99, 235)
_BLUE_500 = (59, 130, 246)
_BLUE_100 = (219, 234, 254)
_BLUE_50 = (239, 246, 255)

_GREEN_600 = (5, 150, 105)
_GREEN_500 = (16, 185, 129)
_GREEN_100 = (209, 250, 229)

_RED_500 = (239, 68, 68)
_RED_600 = (220, 38, 38)
_RED_100 = (254, 226, 226)

_AMBER_500 = (245, 158, 11)
_AMBER_600 = (217, 119, 6)
_AMBER_100 = (254, 243, 199)

_PURPLE_500 = (139, 92, 246)
_PURPLE_600 = (124, 58, 237)
_PURPLE_100 = (237, 233, 254)

_CYAN_500 = (6, 182, 212)
_CYAN_100 = (207, 250, 254)

_AGENT_COLORS = {
    "queue_balancer": _BLUE_600,
    "predictive_prevention": _GREEN_600,
    "escalation_handler": _RED_500,
    "skill_router": _PURPLE_500,
    "analytics": _AMBER_500,
}
_AGENT_LABELS = {
    "queue_balancer": "Queue Balancer",
    "predictive_prevention": "Predictive Prev.",
    "escalation_handler": "Escalation Handler",
    "skill_router": "Skill Router",
    "analytics": "Analytics",
}
_SEVERITY_COLORS = {"critical": _RED_500, "warning": _AMBER_500, "info": _BLUE_500}
_GUARDRAIL_MAP = {
    "AUTO_APPROVE": ("Auto-Approved", _GREEN_600),
    "PENDING_HUMAN": ("Pending Human", _AMBER_600),
    "BLOCKED": ("Blocked", _RED_600),
    "NEGOTIATION_OVERRIDDEN": ("Negotiation Overridden", _PURPLE_600),
}

# Page dimensions (A4)
_PAGE_W = 210
_PAGE_H = 297
_MARGIN = 12
_USABLE_W = _PAGE_W - 2 * _MARGIN
_FOOTER_H = 14


def _remaining(pdf: FPDF) -> float:
    return _PAGE_H - _FOOTER_H - pdf.get_y()


def _ensure_space(pdf: FPDF, needed: float) -> None:
    if _remaining(pdf) < needed:
        pdf.add_page()
        pdf.set_y(_MARGIN + 2)


class _ReportPDF(FPDF):
    """Custom FPDF subclass with automatic footer on every page."""

    def footer(self):
        self.set_y(_PAGE_H - _FOOTER_H)
        self.set_draw_color(*_SLATE_200)
        self.set_line_width(0.3)
        self.line(_MARGIN, self.get_y(), _PAGE_W - _MARGIN, self.get_y())
        self.ln(2.5)
        self.set_font("Helvetica", "", 5.5)
        self.set_text_color(*_SLATE_400)
        self.cell(_USABLE_W * 0.6, 4,
                  "SentinelAI  |  Built by CirrusLabs  |  Autonomous AI Operations Layer")
        self.set_font("Helvetica", "", 5.5)
        self.set_text_color(*_SLATE_500)
        self.cell(_USABLE_W * 0.4, 4, f"Page {self.page_no()} of {{nb}}", align="R")


def generate_report_pdf(report: dict) -> bytes:
    pdf = _ReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=False)
    pdf.set_margins(_MARGIN, _MARGIN, _MARGIN)

    # ── Register Inter font family ────────────────────────────────────────
    _register_fonts(pdf)

    pdf.add_page()

    scenario = report.get("simulationScenario") or "Idle"
    tick = report.get("simulationTick", 0)
    generated = report.get("generatedAt", datetime.now(timezone.utc).isoformat())
    try:
        dt = datetime.fromisoformat(generated.replace("Z", "+00:00"))
        ist = timezone(timedelta(hours=5, minutes=30))
        display_ts = dt.astimezone(ist).strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        display_ts = generated[:19] + "Z"

    # ── HEADER BANNER ─────────────────────────────────────────────────────
    _draw_header(pdf, scenario, tick, display_ts)

    # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────
    cost = report.get("costImpact", {})
    _section_header(pdf, "Executive Summary")
    _kpi_row(pdf, [
        ("Total Saved", f"${cost.get('totalSaved', 0):,.2f}", _GREEN_600, _GREEN_100),
        ("Revenue at Risk", f"${cost.get('revenueAtRisk', 0):,.2f}", _RED_500, _RED_100),
        ("Prevented Abandoned", str(cost.get("preventedAbandoned", 0)), _BLUE_600, _BLUE_100),
        ("AI Actions Today", str(cost.get("actionsToday", 0)), _AMBER_500, _AMBER_100),
    ])

    # ── GOVERNANCE & GUARDRAILS ───────────────────────────────────────────
    gov = report.get("governance", {})
    avg_conf = gov.get("avgConfidence", 0)
    _ensure_space(pdf, 42)
    _section_header(pdf, "Governance & Guardrails")
    _kpi_row(pdf, [
        ("Total Decisions", str(gov.get("totalDecisions", 0)), _BLUE_600, _BLUE_100),
        ("Auto-Approved", str(gov.get("autoApproved", 0)), _GREEN_600, _GREEN_100),
        ("Human-Approved", str(gov.get("humanApproved", 0)), _AMBER_500, _AMBER_100),
        ("Blocked", str(gov.get("blocked", 0)), _RED_500, _RED_100),
    ])
    _confidence_bar(pdf, "Avg Confidence", avg_conf)
    pdf.ln(1)

    # ── ALERT SUMMARY ─────────────────────────────────────────────────────
    alerts = report.get("alerts", {})
    by_sev = alerts.get("bySeverity", {})
    _section_header(pdf, "Alert Summary")
    _kpi_row(pdf, [
        ("Total Alerts", str(alerts.get("total", 0)), _BLUE_600, _BLUE_100),
        ("Active", str(alerts.get("active", 0)), _RED_500, _RED_100),
        ("Resolved", str(alerts.get("resolved", 0)), _GREEN_600, _GREEN_100),
        ("Critical", str(by_sev.get("critical", 0)), _RED_600, _RED_100),
    ])
    sev_items = [(k.title(), by_sev[k], _SEVERITY_COLORS.get(k, _SLATE_500))
                 for k in ["critical", "warning", "info"] if by_sev.get(k, 0) > 0]
    if sev_items:
        _ensure_space(pdf, 8 * len(sev_items) + 8)
        _chart_label(pdf, "Alerts by Severity")
        _h_bars(pdf, sev_items)

    # ── AI DECISIONS ──────────────────────────────────────────────────────
    decisions = report.get("decisions", {})
    by_agent = decisions.get("byAgent", {})
    by_gr = decisions.get("byGuardrailResult", {})
    total = decisions.get("total", 0)
    executed = decisions.get("executed", 0)
    exec_rate = executed / max(total, 1)

    _section_header(pdf, "AI Decisions")
    _kpi_row(pdf, [
        ("Total", str(total), _BLUE_600, _BLUE_100),
        ("Executed", str(executed), _GREEN_600, _GREEN_100),
        ("Execution Rate", f"{exec_rate * 100:.0f}%",
         _GREEN_600 if exec_rate >= 0.7 else _AMBER_500,
         _GREEN_100 if exec_rate >= 0.7 else _AMBER_100),
        ("Pending/Blocked", str(total - executed), _SLATE_500, _SLATE_100),
    ])

    if any(v > 0 for v in by_agent.values()):
        agent_items = [(_AGENT_LABELS.get(k, k.replace("_", " ").title()), v, _AGENT_COLORS.get(k, _BLUE_600))
                       for k, v in by_agent.items() if v > 0]
        _ensure_space(pdf, 8 * len(agent_items) + 8)
        _chart_label(pdf, "Decisions by Agent")
        _h_bars(pdf, agent_items)

    if any(v > 0 for v in by_gr.values()):
        gr_items = [(_GUARDRAIL_MAP.get(k, (k.replace("_", " ").title(), _SLATE_500))[0],
                     v,
                     _GUARDRAIL_MAP.get(k, (k, _SLATE_500))[1])
                    for k, v in by_gr.items() if v > 0]
        _ensure_space(pdf, 8 * len(gr_items) + 8)
        _chart_label(pdf, "Guardrail Outcomes")
        _h_bars(pdf, gr_items)

    # ── NEGOTIATIONS ─────────────────────────────────────────────────────
    negotiations = report.get("negotiations", {})
    neg_total = negotiations.get("total", 0)
    if neg_total > 0:
        _ensure_space(pdf, 24)
        _section_header(pdf, "Negotiations")
        _kpi_row(pdf, [
            ("Total Negotiations", str(neg_total), _PURPLE_500, _PURPLE_100),
        ])

    # ── QUEUE PERFORMANCE ─────────────────────────────────────────────────
    queues = report.get("queues", {})
    if queues:
        _ensure_space(pdf, 24 + 6 * len(queues))
        _section_header(pdf, "Queue Performance")
        headers = ["Queue", "Contacts", "Agents", "Available", "Wait (s)", "Abandon%", "SLA %"]
        widths = [34, 22, 22, 24, 22, 24, 22]
        _table_header(pdf, headers, widths)
        for i, (name, q) in enumerate(queues.items()):
            sl = q.get("serviceLevel", 0)
            ab = q.get("abandonmentRate", 0)
            row = [name, str(q.get("currentContacts", 0)), str(q.get("agentsOnline", 0)),
                   str(q.get("agentsAvailable", 0)), f"{q.get('avgWaitTime', 0):.1f}",
                   f"{ab:.1f}", f"{sl:.1f}"]
            colors = {5: _RED_500 if ab >= 10 else (_AMBER_500 if ab >= 5 else _GREEN_500),
                      6: _GREEN_500 if sl >= 90 else (_AMBER_500 if sl >= 80 else _RED_500)}
            _table_row(pdf, row, widths, i, colors)
        pdf.ln(1)

    # ── WORKFORCE SUMMARY ─────────────────────────────────────────────────
    workforce = report.get("workforce", {})
    if workforce.get("totalAgents", 0) > 0:
        by_status = workforce.get("byStatus", {})
        by_dept = workforce.get("byDepartment", {})
        top = workforce.get("topPerformers", [])
        dept_fitness = workforce.get("departmentFitness", {})
        avg_perf = workforce.get("avgPerfScore", 0)

        _ensure_space(pdf, 32)
        _section_header(pdf, "Workforce Overview")
        _kpi_row(pdf, [
            ("Total Agents", str(workforce.get("totalAgents", 0)), _BLUE_600, _BLUE_100),
            ("Available", str(by_status.get("available", 0)), _GREEN_600, _GREEN_100),
            ("Busy", str(by_status.get("busy", 0)), _AMBER_500, _AMBER_100),
            ("Relocated", str(workforce.get("relocated", 0)), _PURPLE_500, _PURPLE_100),
        ])
        _confidence_bar(pdf, "Avg Performance", avg_perf,
                        color=_GREEN_600 if avg_perf >= 0.8 else _AMBER_500)

        if by_dept:
            dept_items = [(k, v, _BLUE_500) for k, v in by_dept.items()]
            _ensure_space(pdf, 8 * len(dept_items) + 8)
            _chart_label(pdf, "Agents by Department")
            _h_bars(pdf, dept_items)

        if top:
            _ensure_space(pdf, 6 * len(top) + 14)
            _chart_label(pdf, "Top Performers")
            t_headers = ["#", "Name", "Role", "Department", "Score", "Top Skill"]
            t_widths = [8, 30, 24, 30, 18, _USABLE_W - 110]
            _table_header(pdf, t_headers, t_widths)
            for i, p in enumerate(top):
                perf = p.get("perfScore", 0)
                row = [str(i + 1), p.get("name", ""), p.get("role", "").title(),
                       p.get("department", ""), f"{perf * 100:.0f}%",
                       p.get("topSkill", "").replace("_", " ").title()]
                _table_row(pdf, row, t_widths, i,
                           {4: _GREEN_500 if perf >= 0.85 else (_AMBER_500 if perf >= 0.7 else _RED_500)})
            pdf.ln(1)

        if dept_fitness:
            _ensure_space(pdf, 7 * len(dept_fitness) + 10)
            _chart_label(pdf, "Department Fitness Scores")
            for dept, score in dept_fitness.items():
                color = _GREEN_600 if score >= 0.8 else (_AMBER_600 if score >= 0.6 else _RED_600)
                _progress_bar(pdf, dept.replace("_", " ").title(), score, color)

    # ── SKILL ROUTING ─────────────────────────────────────────────────────
    routing = report.get("skillRouting", {})
    recent = routing.get("recentRoutings", [])
    if recent:
        _ensure_space(pdf, 6 * min(len(recent), 12) + 20)
        total_routed = routing.get("totalRouted", 0)
        _section_header(pdf, f"Skill Routing  ({len(recent)} of {total_routed})")
        r_headers = ["Contact", "Agent", "Score", "Tick", "Reasoning"]
        r_widths = [26, 26, 18, 14, _USABLE_W - 84]
        _table_header(pdf, r_headers, r_widths)
        for i, r in enumerate(recent[:12]):
            score = r.get("score", 0) if isinstance(r.get("score"), (int, float)) else 0
            row = [str(r.get("contactId", ""))[:14], str(r.get("agentId", ""))[:14],
                   f"{int(score * 100)}%", str(r.get("tick", "")),
                   str(r.get("reasoning", ""))[:50]]
            _table_row(pdf, row, r_widths, i,
                       {2: _GREEN_500 if score >= 0.9 else (_AMBER_500 if score >= 0.8 else _RED_500)})

    # ── CONFIDENTIAL FOOTER ──────────────────────────────────────────────
    _ensure_space(pdf, 16)
    pdf.ln(5)
    y = pdf.get_y()
    pdf.set_fill_color(*_SLATE_50)
    pdf.rect(_MARGIN, y, _USABLE_W, 9, "F")
    pdf.set_draw_color(*_SLATE_200)
    pdf.set_line_width(0.15)
    pdf.rect(_MARGIN, y, _USABLE_W, 9, "D")
    pdf.set_xy(_MARGIN + 4, y + 1.5)
    pdf.set_font("Inter", "I", 6)
    pdf.set_text_color(*_SLATE_400)
    pdf.cell(0, 6, "This report is auto-generated by SentinelAI. Data reflects simulation state at time of generation. For internal use only.")

    return bytes(pdf.output())


# ══════════════════════════════════════════════════════════════════════════════
# FONT REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

def _register_fonts(pdf: FPDF) -> None:
    """Register Inter font family. Falls back to Helvetica if files missing."""
    try:
        pdf.add_font("Inter", "", str(_FONT_DIR / "Inter-Regular.ttf"), uni=True)
        pdf.add_font("Inter", "B", str(_FONT_DIR / "Inter-Bold.ttf"), uni=True)
        pdf.add_font("Inter", "I", str(_FONT_DIR / "Inter-Italic.ttf"), uni=True)
        pdf.add_font("InterSB", "", str(_FONT_DIR / "Inter-SemiBold.ttf"), uni=True)
        pdf.add_font("InterMd", "", str(_FONT_DIR / "Inter-Medium.ttf"), uni=True)
        pdf.add_font("InterLt", "", str(_FONT_DIR / "Inter-Light.ttf"), uni=True)
    except Exception:
        logger.warning("Inter font files not found, falling back to Helvetica")
        pdf.add_font("Inter", "", style="")
        pdf.add_font("InterSB", "", style="")
        pdf.add_font("InterMd", "", style="")
        pdf.add_font("InterLt", "", style="")


# ══════════════════════════════════════════════════════════════════════════════
# HEADER & FOOTER
# ══════════════════════════════════════════════════════════════════════════════

def _draw_header(pdf: FPDF, scenario: str, tick: int, display_ts: str) -> None:
    """Premium header with deep navy background and layered accents."""
    # Main navy background
    pdf.set_fill_color(*_SLATE_900)
    pdf.rect(0, 0, _PAGE_W, 42, "F")

    # Subtle lighter overlay strip at top for depth
    pdf.set_fill_color(20, 30, 52)
    pdf.rect(0, 0, _PAGE_W, 14, "F")

    # Blue accent bar at bottom of header
    pdf.set_fill_color(*_BLUE_600)
    pdf.rect(0, 42, _PAGE_W, 2, "F")

    # Small decorative dots (simulated with tiny rects)
    pdf.set_fill_color(30, 45, 70)
    for dx in range(0, _PAGE_W, 4):
        pdf.rect(dx, 41, 1.5, 0.5, "F")

    # Title
    pdf.set_y(8)
    pdf.set_font("Inter", "B", 24)
    pdf.set_text_color(*_WHITE)
    pdf.cell(0, 11, "SentinelAI", align="C", new_x="LMARGIN", new_y="NEXT")

    # Subtitle
    pdf.set_font("InterLt", "", 8.5)
    pdf.set_text_color(*_SLATE_400)
    pdf.cell(0, 5, "Autonomous AI Operations Layer for AWS Connect", align="C", new_x="LMARGIN", new_y="NEXT")

    # Meta info as pill-style badges
    pdf.ln(1.5)
    scenario_display = scenario.replace("_", " ").title()
    meta = f"Scenario: {scenario_display}   \u2022   Tick: {tick}   \u2022   {display_ts}"
    pdf.set_font("InterMd", "", 6.5)
    pdf.set_text_color(140, 160, 195)
    pdf.cell(0, 4, meta, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(48)
    pdf.set_text_color(*_SLATE_900)



# ══════════════════════════════════════════════════════════════════════════════
# SECTION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _section_header(pdf: FPDF, title: str) -> None:
    _ensure_space(pdf, 28)
    pdf.ln(4)
    y = pdf.get_y()

    # Left accent bar (rounded feel via stacked rects)
    pdf.set_fill_color(*_BLUE_600)
    pdf.rect(_MARGIN, y + 0.5, 3, 6, "F")

    # Title
    pdf.set_x(_MARGIN + 6)
    pdf.set_font("Inter", "B", 10)
    pdf.set_text_color(*_SLATE_900)
    pdf.cell(0, 7, title.upper(), new_x="LMARGIN", new_y="NEXT")

    # Underline (full width, subtle)
    pdf.set_draw_color(*_SLATE_200)
    pdf.set_line_width(0.25)
    pdf.line(_MARGIN, pdf.get_y(), _PAGE_W - _MARGIN, pdf.get_y())
    pdf.ln(2.5)


def _chart_label(pdf: FPDF, title: str) -> None:
    pdf.set_font("InterSB", "", 7.5)
    pdf.set_text_color(*_SLATE_700)
    pdf.cell(0, 5.5, title, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(0.5)


# ══════════════════════════════════════════════════════════════════════════════
# KPI CARDS
# ══════════════════════════════════════════════════════════════════════════════

def _kpi_row(pdf: FPDF, items: list[tuple[str, str, tuple, tuple]]) -> None:
    """Premium KPI cards with accent stripe, tinted bg, and shadow effect."""
    n = len(items)
    gap = 2.5
    card_w = (_USABLE_W - (n - 1) * gap) / n
    card_h = 17
    y = pdf.get_y()

    for i, item in enumerate(items):
        label, value, accent = item[0], item[1], item[2]
        bg_tint = item[3] if len(item) > 3 else _SLATE_50
        x = _MARGIN + i * (card_w + gap)

        if not label and not value:
            continue

        # Shadow (subtle offset rect)
        pdf.set_fill_color(*_SLATE_200)
        pdf.rect(x + 0.4, y + 0.4, card_w, card_h, "F")

        # Card body
        pdf.set_fill_color(*bg_tint)
        pdf.rect(x, y, card_w, card_h, "F")

        # Accent left stripe (vertical)
        pdf.set_fill_color(*accent)
        pdf.rect(x, y, 2, card_h, "F")

        # Border
        pdf.set_draw_color(*_SLATE_200)
        pdf.set_line_width(0.15)
        pdf.rect(x, y, card_w, card_h, "D")

        # Label
        pdf.set_xy(x + 5, y + 2)
        pdf.set_font("InterMd", "", 5.5)
        pdf.set_text_color(*_SLATE_500)
        pdf.cell(card_w - 8, 3.5, label.upper())

        # Value
        pdf.set_xy(x + 5, y + 6.5)
        pdf.set_font("Inter", "B", 12)
        pdf.set_text_color(*_SLATE_900)
        pdf.cell(card_w - 8, 8, value)

    pdf.set_y(y + card_h + 3)
    pdf.set_text_color(*_SLATE_900)


# ══════════════════════════════════════════════════════════════════════════════
# BARS & CHARTS
# ══════════════════════════════════════════════════════════════════════════════

def _confidence_bar(pdf: FPDF, label: str, ratio: float,
                    color: tuple = _BLUE_600) -> None:
    """Wide progress bar with label, used for confidence/performance metrics.
    Visually bound to the section above — no extra top spacing."""
    _ensure_space(pdf, 8)
    pct = max(0.0, min(1.0, ratio))
    y = pdf.get_y()
    label_w = 38
    pct_w = 20
    bar_w = _USABLE_W - label_w - pct_w - 4

    # Label
    pdf.set_font("InterMd", "", 7)
    pdf.set_text_color(*_SLATE_700)
    pdf.set_xy(_MARGIN, y)
    pdf.cell(label_w, 5.5, label)

    # Bar track
    bar_x = _MARGIN + label_w + 2
    bar_h = 4
    bar_y = y + 0.8

    # Track background
    pdf.set_fill_color(*_SLATE_100)
    pdf.rect(bar_x, bar_y, bar_w, bar_h, "F")
    pdf.set_draw_color(*_SLATE_200)
    pdf.set_line_width(0.1)
    pdf.rect(bar_x, bar_y, bar_w, bar_h, "D")

    # Fill with gradient effect (two-tone)
    if pct > 0:
        fill_w = bar_w * pct
        pdf.set_fill_color(*color)
        pdf.rect(bar_x, bar_y, fill_w, bar_h, "F")
        # Lighter highlight on top half for depth
        r, g, b = color
        pdf.set_fill_color(min(r + 30, 255), min(g + 30, 255), min(b + 30, 255))
        pdf.rect(bar_x, bar_y, fill_w, bar_h * 0.4, "F")

    # Percentage value
    pdf.set_xy(bar_x + bar_w + 2, y)
    pdf.set_font("Inter", "B", 8)
    pdf.set_text_color(*color)
    pdf.cell(pct_w, 5.5, f"{pct * 100:.0f}%", align="R")

    pdf.set_y(y + 7)
    pdf.set_text_color(*_SLATE_900)


def _progress_bar(pdf: FPDF, label: str, ratio: float, color: tuple) -> None:
    """Compact progress bar for lists (dept fitness, etc.)."""
    _ensure_space(pdf, 7)
    pct = max(0.0, min(1.0, ratio))
    y = pdf.get_y()
    label_w = 38
    pct_w = 18
    bar_w = _USABLE_W - label_w - pct_w - 4

    # Label
    pdf.set_font("Inter", "", 7)
    pdf.set_text_color(*_SLATE_700)
    pdf.set_xy(_MARGIN, y)
    pdf.cell(label_w, 5, label)

    # Bar
    bar_x = _MARGIN + label_w + 2
    bar_h = 3.5
    bar_y = y + 0.8
    pdf.set_fill_color(*_SLATE_100)
    pdf.rect(bar_x, bar_y, bar_w, bar_h, "F")
    if pct > 0:
        pdf.set_fill_color(*color)
        pdf.rect(bar_x, bar_y, bar_w * pct, bar_h, "F")

    # Value
    pdf.set_xy(bar_x + bar_w + 2, y)
    pdf.set_font("InterSB", "", 7)
    pdf.set_text_color(*color)
    pdf.cell(pct_w, 5, f"{pct * 100:.0f}%", align="R")

    pdf.set_y(y + 6)
    pdf.set_text_color(*_SLATE_900)


def _h_bars(pdf: FPDF, items: list[tuple[str, int, tuple]]) -> None:
    """Horizontal bar chart with labels and values."""
    max_val = max((v for _, v, _ in items), default=1) or 1
    label_w = 38
    val_w = 18
    bar_w = _USABLE_W - label_w - val_w - 4

    for label, value, color in items:
        _ensure_space(pdf, 8)
        y = pdf.get_y()

        # Label (right-aligned)
        pdf.set_font("Inter", "", 7)
        pdf.set_text_color(*_SLATE_600)
        pdf.set_xy(_MARGIN, y)
        pdf.cell(label_w, 6, label, align="R")

        # Bar track
        bar_x = _MARGIN + label_w + 2
        bar_h = 4
        bar_y = y + 1
        pdf.set_fill_color(*_SLATE_100)
        pdf.rect(bar_x, bar_y, bar_w, bar_h, "F")

        # Fill
        fill_w = (value / max_val) * bar_w
        if fill_w > 0.5:
            pdf.set_fill_color(*color)
            pdf.rect(bar_x, bar_y, fill_w, bar_h, "F")
            # Highlight top half
            r, g, b = color
            pdf.set_fill_color(min(r + 35, 255), min(g + 35, 255), min(b + 35, 255))
            pdf.rect(bar_x, bar_y, fill_w, bar_h * 0.4, "F")

        # Value
        pdf.set_font("InterSB", "", 7)
        pdf.set_text_color(*color)
        pdf.set_xy(bar_x + bar_w + 2, y)
        pdf.cell(val_w, 6, str(value))

        pdf.set_y(y + 7)

    pdf.set_text_color(*_SLATE_900)
    pdf.ln(0.5)


# ══════════════════════════════════════════════════════════════════════════════
# TABLES
# ══════════════════════════════════════════════════════════════════════════════

def _table_header(pdf: FPDF, headers: list[str], widths: list[float]) -> None:
    pdf.set_fill_color(*_SLATE_800)
    pdf.set_font("InterSB", "", 6.5)
    pdf.set_text_color(*_WHITE)
    y = pdf.get_y()
    x = _MARGIN
    for h, w in zip(headers, widths):
        pdf.set_xy(x, y)
        pdf.cell(w, 6, f"  {h}", fill=True)
        x += w
    pdf.set_y(y + 6)
    pdf.set_text_color(*_SLATE_900)


def _table_row(pdf: FPDF, cells: list[str], widths: list[float],
               idx: int, color_map: dict[int, tuple] | None = None) -> None:
    color_map = color_map or {}
    _ensure_space(pdf, 5.5)
    y = pdf.get_y()

    # Alternating row background
    if idx % 2 == 0:
        pdf.set_fill_color(*_WHITE)
    else:
        pdf.set_fill_color(*_SLATE_50)
    pdf.rect(_MARGIN, y, sum(widths), 5.5, "F")

    # Bottom border for each row
    pdf.set_draw_color(*_SLATE_100)
    pdf.set_line_width(0.1)
    pdf.line(_MARGIN, y + 5.5, _MARGIN + sum(widths), y + 5.5)

    x = _MARGIN
    for i, (val, w) in enumerate(zip(cells, widths)):
        pdf.set_xy(x, y)
        if i in color_map:
            pdf.set_font("InterSB", "", 6.5)
            pdf.set_text_color(*color_map[i])
        else:
            pdf.set_font("Inter", "", 6.5)
            pdf.set_text_color(*_SLATE_700)
        pdf.cell(w, 5.5, f"  {val}")
        x += w

    pdf.set_y(y + 5.5)
    pdf.set_text_color(*_SLATE_900)
