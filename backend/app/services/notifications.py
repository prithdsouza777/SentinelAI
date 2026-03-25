"""External notification service for queue spike alerts.

Supports:
- Microsoft Teams incoming webhook (Adaptive Cards)
- Gmail / SMTP email notifications

Both channels have independent cooldowns to prevent alert spam.
"""

import asyncio
import logging
import smtplib
import time
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import httpx

from app.config import settings

logger = logging.getLogger("sentinelai.notifications")


def _kpi_cell(label: str, value: object, color: str) -> str:
    """Return an inline-styled HTML KPI cell for use in email templates."""
    return (
        f'<div style="flex:1;padding:16px 20px;border-right:1px solid #e2e8f0;text-align:center;">'
        f'<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;'
        f'color:#94a3b8;margin-bottom:6px;">{label}</div>'
        f'<div style="font-size:22px;font-weight:800;color:{color};font-variant-numeric:tabular-nums;">'
        f'{value}</div>'
        f"</div>"
    )


class NotificationService:
    def __init__(self):
        # Per-channel cooldowns: channel -> last_send_time
        self._cooldowns: dict[str, float] = {}
        # Shared HTTP client for connection reuse (Teams webhooks)
        self._http_client: httpx.AsyncClient | None = None

    def _check_cooldown(self, channel: str) -> bool:
        """Return True if enough time has passed since last notification on this channel."""
        now = time.monotonic()
        last = self._cooldowns.get(channel, 0.0)
        if now - last < settings.notification_cooldown:
            return False
        self._cooldowns[channel] = now
        return True

    def _should_notify(self, severity: str, notify_on: str) -> bool:
        """Check if this severity level warrants a notification given the config."""
        if notify_on == "none":
            return False
        if notify_on == "all":
            return True
        if notify_on == "warning":
            return severity in ("warning", "critical")
        if notify_on == "critical":
            return severity == "critical"
        return False

    # ── Microsoft Teams ─────────────────────────────────────────────────────

    async def send_teams(self, alert: dict) -> bool:
        """Send an Adaptive Card to a Teams incoming webhook."""
        url = settings.teams_webhook_url
        if not url:
            return False

        if not self._should_notify(alert.get("severity", ""), settings.teams_notify_on):
            return False

        if not self._check_cooldown("teams"):
            logger.debug("Teams notification skipped (cooldown)")
            return False

        severity = alert.get("severity", "info").upper()
        color = {"CRITICAL": "attention", "WARNING": "warning", "INFO": "good"}.get(severity, "default")

        # Adaptive Card payload (Teams webhook format)
        card = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": None,
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.4",
                        "body": [
                            {
                                "type": "TextBlock",
                                "size": "medium",
                                "weight": "bolder",
                                "text": f"SentinelAI Alert - {severity}",
                                "style": "heading",
                                "color": color,
                            },
                            {
                                "type": "TextBlock",
                                "text": alert.get("title", "Queue Alert"),
                                "weight": "bolder",
                                "wrap": True,
                            },
                            {
                                "type": "FactSet",
                                "facts": [
                                    {"title": "Queue", "value": alert.get("queueName", "Unknown")},
                                    {"title": "Severity", "value": severity},
                                    {"title": "Description", "value": alert.get("description", "")},
                                    {"title": "Recommended Action", "value": alert.get("recommendedAction", "Monitor situation")},
                                ],
                            },
                            {
                                "type": "TextBlock",
                                "text": f"Timestamp: {alert.get('timestamp', 'N/A')}",
                                "size": "small",
                                "isSubtle": True,
                            },
                        ],
                    },
                }
            ],
        }

        try:
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=10.0)
            resp = await self._http_client.post(url, json=card)
            if resp.status_code in (200, 202):
                logger.info("Teams notification sent: %s", alert.get("title"))
                return True
            else:
                logger.warning("Teams webhook returned %s: %s", resp.status_code, resp.text[:200])
                return False
        except Exception as e:
            logger.error("Teams notification failed: %s", e)
            return False

    # ── Gmail / SMTP Email ─────────────────────────────────────────────────

    async def send_email(self, alert: dict) -> bool:
        """Send an HTML email via Gmail SMTP."""
        if not settings.smtp_host or not settings.smtp_to:
            return False

        if not self._should_notify(alert.get("severity", ""), settings.email_notify_on):
            return False

        if not self._check_cooldown("email"):
            logger.debug("Email notification skipped (cooldown)")
            return False

        severity = alert.get("severity", "info").upper()
        subject = f"[SentinelAI {severity}] {alert.get('title', 'Queue Alert')}"

        color_map = {"CRITICAL": "#ef4444", "WARNING": "#f59e0b", "INFO": "#3b82f6"}
        badge_color = color_map.get(severity, "#64748b")
        badge_bg = {"CRITICAL": "#fef2f2", "WARNING": "#fffbeb", "INFO": "#eff6ff"}.get(severity, "#f8fafc")

        # Convert timestamp to IST for display
        from datetime import datetime, timezone, timedelta
        ist = timezone(timedelta(hours=5, minutes=30))
        raw_ts = alert.get("timestamp", "")
        try:
            dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            display_ts = dt.astimezone(ist).strftime("%d %b %Y, %I:%M %p IST")
        except Exception:
            display_ts = raw_ts or "N/A"

        html = f"""
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                  <!-- Header bar — mirrors dashboard header -->
                  <tr>
                    <td>
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px 12px 0 0; border: 1px solid #e2e8f0; border-bottom: none;">
                        <tr>
                          <td style="padding: 14px 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td>
                                  <table cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td style="background: linear-gradient(135deg, #3b82f6, #2563eb); width: 32px; height: 32px; border-radius: 8px; text-align: center; vertical-align: middle;">
                                        <span style="color: #ffffff; font-size: 16px; line-height: 32px;">&#9889;</span>
                                      </td>
                                      <td style="padding-left: 10px;">
                                        <span style="font-size: 17px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px;">Sentinel</span><span style="font-size: 17px; font-weight: 700; color: #3b82f6; letter-spacing: -0.3px;">AI</span>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                                <td align="right" style="vertical-align: middle;">
                                  <span style="display: inline-block; background: {badge_bg}; color: {badge_color}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid {badge_color}20;">
                                    {severity} ALERT
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Severity accent line -->
                  <tr>
                    <td style="padding: 0;"><div style="height: 3px; background: {badge_color};"></div></td>
                  </tr>

                  <!-- Main content card — dashboard panel style -->
                  <tr>
                    <td>
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-bottom: none;">

                        <!-- Alert title + timestamp -->
                        <tr>
                          <td style="padding: 24px 24px 0 24px;">
                            <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.3;">
                              {alert.get("title", "Queue Alert")}
                            </h1>
                            <span style="font-size: 12px; color: #94a3b8;">{display_ts}</span>
                          </td>
                        </tr>

                        <!-- Description -->
                        <tr>
                          <td style="padding: 14px 24px 0 24px;">
                            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                              {alert.get("description", "")}
                            </p>
                          </td>
                        </tr>

                        <!-- Divider -->
                        <tr>
                          <td style="padding: 18px 24px;">
                            <div style="border-top: 1px solid #e2e8f0;"></div>
                          </td>
                        </tr>

                        <!-- Detail row — dashboard metric card style -->
                        <tr>
                          <td style="padding: 0 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; width: 48%;">
                                  <span style="display: block; font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Queue</span>
                                  <span style="font-size: 15px; font-weight: 600; color: #1e293b;">{alert.get("queueName", "Unknown")}</span>
                                </td>
                                <td style="width: 4%;"></td>
                                <td style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; width: 48%;">
                                  <span style="display: block; font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Severity</span>
                                  <span style="font-size: 15px; font-weight: 700; color: {badge_color};">{severity}</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Recommended action — blue accent card like AI Decision Feed -->
                        <tr>
                          <td style="padding: 12px 24px 24px 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; border-left: 4px solid #2563eb;">
                              <tr>
                                <td style="padding: 14px 16px;">
                                  <span style="display: block; font-size: 10px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">&#9889; Recommended Action</span>
                                  <span style="font-size: 14px; color: #1e293b; font-weight: 500; line-height: 1.5;">{alert.get("recommendedAction", "Monitor situation")}</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>

                  <!-- Footer — matching dashboard border style -->
                  <tr>
                    <td>
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; border-top: none;">
                        <tr>
                          <td style="padding: 16px 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td>
                                  <span style="font-size: 12px; font-weight: 600; color: #1e293b;">Sentinel</span><span style="font-size: 12px; font-weight: 600; color: #3b82f6;">AI</span>
                                  <span style="font-size: 11px; color: #94a3b8;"> &mdash; Autonomous AI Operations</span>
                                </td>
                                <td align="right">
                                  <span style="font-size: 11px; color: #94a3b8;">Built by </span><span style="font-size: 11px; font-weight: 600; color: #475569;">Cirrus</span><span style="font-size: 11px; font-weight: 600; color: #f87171;">Labs</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """

        recipients = [r.strip() for r in settings.smtp_to.split(",") if r.strip()]

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from or settings.smtp_user
            msg["To"] = ", ".join(recipients)
            msg.attach(MIMEText(html, "html"))

            # Run blocking SMTP in a thread to avoid blocking the event loop
            await asyncio.to_thread(self._send_smtp, msg, recipients)
            logger.info("Email notification sent to %s: %s", recipients, alert.get("title"))
            return True
        except Exception as e:
            logger.error("Email notification failed: %s", e)
            return False

    def _send_smtp(self, msg: MIMEMultipart, recipients: list[str]) -> tuple[bool, str]:
        """Blocking SMTP send (run via asyncio.to_thread)."""
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            if settings.smtp_port != 25:
                server.starttls()
                server.ehlo()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], recipients, msg.as_string())
        return True, "Email sent"

    # ── On-demand Report Email (user-triggered) ─────────────────────────────

    async def send_report_email(
        self, 
        report: dict, 
        attachment_base64: str = None, 
        attachment_name: str = "report.pdf"
    ) -> tuple[bool, str]:
        """Send a rich HTML session report email. No cooldown — user-triggered."""
        if not settings.smtp_host or not settings.smtp_to:
            return False, "SMTP not configured. Go to Settings → Notifications to set it up."

        recipients = [r.strip() for r in settings.smtp_to.split(",") if r.strip()]
        generated_at = report.get("generatedAt", "N/A")
        scenario = report.get("simulationScenario") or "Idle"
        tick = report.get("simulationTick", 0)

        # ── Alert summary
        alerts = report.get("alerts", {})
        decisions = report.get("decisions", {})
        skill_routing = report.get("skillRouting", {})
        cost = report.get("costImpact", {})
        gov = report.get("governance", {})
        queues = report.get("queues", {})

        total_decisions = decisions.get("total", 0)
        auto_approved = gov.get("autoApproved", 0)
        auto_pct = round(auto_approved / max(total_decisions, 1) * 100)
        avg_conf = round(gov.get("avgConfidence", 0) * 100)

        # Build queue rows HTML
        queue_rows_html = ""
        for qname, q in queues.items():
            sl = q.get("serviceLevel", 0)
            sl_color = "#10b981" if sl >= 85 else ("#f59e0b" if sl >= 75 else "#ef4444")
            queue_rows_html += f"""
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:7px 8px;color:#1e293b;font-weight:500;">{qname}</td>
              <td style="padding:7px 8px;text-align:center;color:#475569;">{q.get('currentContacts', 0)}</td>
              <td style="padding:7px 8px;text-align:center;color:#475569;">{q.get('agentsOnline', 0)}</td>
              <td style="padding:7px 8px;text-align:center;color:#475569;">{q.get('avgWaitTime', 0):.1f}s</td>
              <td style="padding:7px 8px;text-align:center;color:{sl_color};font-weight:600;">{sl:.1f}%</td>
              <td style="padding:7px 8px;text-align:center;color:#475569;">{q.get('abandonmentRate', 0):.1f}%</td>
            </tr>"""

        subject = f"[SentinelAI] Session Report — {scenario} (Tick {tick})"

        html = f"""
        <html>
        <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;margin:0;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;
                      border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#172554 0%,#1e40af 100%);padding:24px 28px;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                SentinelAI — Session Report
              </h1>
              <p style="color:#93c5fd;margin:6px 0 0 0;font-size:13px;">
                Scenario: <strong style="color:#ffffff;">{scenario}</strong> &nbsp;·&nbsp;
                Tick: <strong style="color:#ffffff;">{tick}</strong> &nbsp;·&nbsp;
                Generated: {generated_at[:19].replace('T',' ')} UTC
              </p>
            </div>

            <!-- KPI Strip -->
            <div style="display:flex;gap:0;border-bottom:1px solid #e2e8f0;">
              {_kpi_cell('Total Alerts', alerts.get('total', 0), '#f59e0b')}
              {_kpi_cell('Decisions', total_decisions, '#3b82f6')}
              {_kpi_cell('Executed', decisions.get('executed', 0), '#10b981')}
              {_kpi_cell('Contacts Routed', skill_routing.get('totalRouted', 0), '#3b82f6')}
            </div>

            <!-- Cost Impact -->
            <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
              <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;
                          color:#64748b;margin:0 0 14px 0;">💰 Cost Impact</h2>
              <div style="display:flex;gap:0;">
                {_kpi_cell('Total Saved', f"${cost.get('totalSaved', 0):,.0f}", '#10b981')}
                {_kpi_cell('Revenue at Risk', f"${cost.get('revenueAtRisk', 0):,.0f}", '#ef4444')}
                {_kpi_cell('Prevented Abandoned', cost.get('preventedAbandoned', 0), '#3b82f6')}
                {_kpi_cell('Actions Today', cost.get('actionsToday', 0), '#64748b')}
              </div>
            </div>

            <!-- Governance -->
            <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
              <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;
                          color:#64748b;margin:0 0 14px 0;">🛡️ Governance</h2>
              <div style="display:flex;gap:0;">
                {_kpi_cell('Auto-Approved', f"{auto_pct}%", '#10b981')}
                {_kpi_cell('Blocked', gov.get('blocked', 0), '#ef4444')}
                {_kpi_cell('Avg Confidence', f"{avg_conf}%", '#3b82f6')}
                {_kpi_cell('Total Decisions', total_decisions, '#64748b')}
              </div>
            </div>

            <!-- Queue Performance -->
            <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
              <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;
                          color:#64748b;margin:0 0 14px 0;">📊 Queue Performance</h2>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px;text-align:left;color:#475569;font-weight:600;">Queue</th>
                    <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Contacts</th>
                    <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Agents</th>
                    <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Avg Wait</th>
                    <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Service Level</th>
                    <th style="padding:8px;text-align:center;color:#475569;font-weight:600;">Abandon Rate</th>
                  </tr>
                </thead>
                <tbody>{queue_rows_html}</tbody>
              </table>
            </div>

            <!-- Footer -->
            <div style="background:#f8fafc;padding:14px 28px;">
              <p style="color:#94a3b8;font-size:11px;margin:0;">
                Sent by <strong>SentinelAI</strong> — Autonomous AI Operations Layer for AWS Connect
              </p>
            </div>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = ", ".join(recipients)

        # HTML part
        msg_html = MIMEText(html, "html")
        msg.attach(msg_html)

        # Optional PDF attachment
        if attachment_base64:
            try:
                if "," in attachment_base64:
                    attachment_base64 = attachment_base64.split(",")[1]
                
                part = MIMEBase("application", "pdf")
                part.set_payload(base64.b64decode(attachment_base64))
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={attachment_name}",
                )
                msg.attach(part)
            except Exception as e:
                logger.error("Failed to attach PDF: %s", e)

        try:
            await asyncio.to_thread(self._send_smtp, msg, recipients)
            logger.info("Report email sent to %s", recipients)
            return True, f"Report emailed to {settings.smtp_to}"
        except Exception as e:
            logger.error("Report email failed: %s", e)
            return False, f"Failed to send email: {e}"

    # ── Dispatch (called from alert pipeline) ───────────────────────────────

    async def notify(self, alert: dict):
        """Send alert to all configured channels (fire-and-forget)."""
        tasks = []
        if settings.teams_webhook_url:
            tasks.append(self.send_teams(alert))
        if settings.smtp_host and settings.smtp_to:
            tasks.append(self.send_email(alert))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    logger.error("Notification dispatch error: %s", r)


notification_service = NotificationService()
