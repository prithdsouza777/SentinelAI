"""External notification service for queue spike alerts.

Supports:
- Microsoft Teams incoming webhook (Adaptive Cards)
- Gmail / SMTP email notifications

Both channels have independent cooldowns to prevent alert spam.
"""

import asyncio
import logging
import smtplib
import ssl
import time
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import httpx

from app.config import settings

logger = logging.getLogger("sentinelai.notifications")


class NotificationError(Exception):
    """Raised when a notification fails to send."""


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
        if notify_on == "none" or notify_on == "human_approval":
            return False
        if notify_on == "all":
            return True
        if notify_on == "warning":
            return severity in ("warning", "critical")
        if notify_on == "critical":
            return severity == "critical"
        return False

    # ── Microsoft Teams ─────────────────────────────────────────────────────

    async def send_teams(self, alert: dict, *, force: bool = False) -> bool:
        """Send an Adaptive Card to a Teams incoming webhook.

        Raises NotificationError with details when force=True (test mode).
        Returns False silently when force=False (pipeline mode).
        """
        url = settings.teams_webhook_url
        if not url:
            if force:
                raise NotificationError("Teams webhook URL is not configured.")
            return False

        if not force and not self._should_notify(alert.get("severity", ""), settings.teams_notify_on):
            return False

        if not force and not self._check_cooldown("teams"):
            logger.debug("Teams notification skipped (cooldown)")
            return False

        severity = alert.get("severity", "info").upper()
        color = {"CRITICAL": "attention", "WARNING": "warning", "INFO": "good"}.get(severity, "default")

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
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=card)
                if resp.status_code in (200, 202):
                    logger.info("Teams notification sent: %s", alert.get("title"))
                    return True
                msg = f"Teams webhook returned HTTP {resp.status_code}: {resp.text[:200]}"
                logger.warning(msg)
                if force:
                    raise NotificationError(msg)
                return False
        except NotificationError:
            raise
        except httpx.ConnectError:
            msg = "Could not connect to Teams webhook URL. Check the URL is correct and reachable."
            logger.error(msg)
            if force:
                raise NotificationError(msg)
            return False
        except httpx.TimeoutException:
            msg = "Teams webhook request timed out after 10 seconds."
            logger.error(msg)
            if force:
                raise NotificationError(msg)
            return False
        except Exception as e:
            logger.error("Teams notification failed: %s", e)
            if force:
                raise NotificationError(f"Teams notification failed: {e}")
            return False

    # ── Gmail / SMTP Email ─────────────────────────────────────────────────

    def _send_smtp(self, subject: str, html: str, recipients: list[str]):
        """Blocking SMTP send (run via asyncio.to_thread).

        Raises NotificationError with specific diagnostics on failure.
        """
        sender = settings.smtp_from or settings.smtp_user
        if not sender:
            raise NotificationError("No sender address. Set SMTP_FROM or SMTP_USER.")
        if not recipients:
            raise NotificationError("No recipients. Set SMTP_TO.")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(html, "html"))

        port = settings.smtp_port
        host = settings.smtp_host
        ctx = ssl.create_default_context()

        try:
            if port == 465:
                # Implicit SSL (SMTPS)
                with smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) as server:
                    if settings.smtp_user and settings.smtp_password:
                        server.login(settings.smtp_user, settings.smtp_password)
                    server.sendmail(sender, recipients, msg.as_string())
            else:
                # STARTTLS (port 587) or plain (port 25)
                with smtplib.SMTP(host, port, timeout=15) as server:
                    server.ehlo()
                    if port != 25:
                        server.starttls(context=ctx)
                        server.ehlo()
                    if settings.smtp_user and settings.smtp_password:
                        server.login(settings.smtp_user, settings.smtp_password)
                    server.sendmail(sender, recipients, msg.as_string())
        except smtplib.SMTPAuthenticationError as e:
            raise NotificationError(
                f"SMTP authentication failed ({e.smtp_code}). "
                "For Gmail, use an App Password (not your account password). "
                "Enable 2FA at myaccount.google.com, then create an App Password."
            ) from e
        except smtplib.SMTPConnectError as e:
            raise NotificationError(
                f"Could not connect to {host}:{port} ({e.smtp_code}). "
                "Check SMTP host and port."
            ) from e
        except smtplib.SMTPRecipientsRefused as e:
            bad = ", ".join(e.recipients.keys())
            raise NotificationError(f"Recipients refused by server: {bad}") from e
        except smtplib.SMTPSenderRefused as e:
            raise NotificationError(
                f"Sender address '{sender}' refused by server ({e.smtp_code}). "
                "Set SMTP_FROM to a valid address for this SMTP account."
            ) from e
        except smtplib.SMTPException as e:
            raise NotificationError(f"SMTP error: {e}") from e
        except ConnectionRefusedError:
            raise NotificationError(
                f"Connection refused to {host}:{port}. "
                "Is the SMTP host correct? Try smtp.gmail.com:587."
            )
        except TimeoutError:
            raise NotificationError(
                f"Connection to {host}:{port} timed out after 15 seconds. "
                "Check host/port and your network."
            )
        except OSError as e:
            raise NotificationError(f"Network error connecting to {host}:{port}: {e}") from e

    async def _send_email_inner(self, subject: str, html: str) -> bool:
        """Shared email sending logic. Raises NotificationError on failure."""
        recipients = [r.strip() for r in settings.smtp_to.split(",") if r.strip()]
        if not recipients:
            raise NotificationError("No recipients configured in SMTP_TO.")

        await asyncio.to_thread(self._send_smtp, subject, html, recipients)
        logger.info("Email sent to %s: %s", recipients, subject[:60])
        return True

    async def send_email(self, alert: dict, *, force: bool = False) -> bool:
        """Send an HTML alert email via SMTP.

        Raises NotificationError with details when force=True (test mode).
        Returns False silently when force=False (pipeline mode).
        """
        if not settings.smtp_host or not settings.smtp_to:
            if force:
                raise NotificationError("SMTP host or recipients not configured.")
            return False

        if not force and not self._should_notify(alert.get("severity", ""), settings.email_notify_on):
            return False

        if not force and not self._check_cooldown("email"):
            logger.debug("Email notification skipped (cooldown)")
            return False

        severity = alert.get("severity", "info").upper()
        subject = f"[SentinelAI {severity}] {alert.get('title', 'Queue Alert')}"

        color_map = {"CRITICAL": "#ef4444", "WARNING": "#f59e0b", "INFO": "#3b82f6"}
        badge_color = color_map.get(severity, "#64748b")
        badge_bg = {"CRITICAL": "#fef2f2", "WARNING": "#fffbeb", "INFO": "#eff6ff"}.get(severity, "#f8fafc")

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
                  <tr>
                    <td style="padding: 0;"><div style="height: 3px; background: {badge_color};"></div></td>
                  </tr>
                  <tr>
                    <td>
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-bottom: none;">
                        <tr>
                          <td style="padding: 24px 24px 0 24px;">
                            <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.3;">
                              {alert.get("title", "Queue Alert")}
                            </h1>
                            <span style="font-size: 12px; color: #94a3b8;">{display_ts}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 14px 24px 0 24px;">
                            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
                              {alert.get("description", "")}
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 18px 24px;">
                            <div style="border-top: 1px solid #e2e8f0;"></div>
                          </td>
                        </tr>
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

        # Build workforce HTML
        workforce = report.get("workforce", {})
        workforce_html = ""
        if workforce.get("totalAgents", 0) > 0:
            by_status = workforce.get("byStatus", {})
            avg_perf = round(workforce.get("avgPerfScore", 0) * 100)
            top_rows = ""
            for i, p in enumerate(workforce.get("topPerformers", [])[:5]):
                perf_pct = round(p.get("perfScore", 0) * 100)
                perf_color = "#10b981" if perf_pct >= 85 else "#475569"
                top_rows += (
                    f'<tr style="border-bottom:1px solid #f1f5f9;">'
                    f'<td style="padding:6px 8px;color:#475569;">{i+1}</td>'
                    f'<td style="padding:6px 8px;color:#1e293b;font-weight:500;">{p.get("name","")}</td>'
                    f'<td style="padding:6px 8px;color:#475569;text-transform:capitalize;">{p.get("role","")}</td>'
                    f'<td style="padding:6px 8px;color:#475569;">{p.get("department","")}</td>'
                    f'<td style="padding:6px 8px;text-align:right;color:{perf_color};font-weight:600;">{perf_pct}%</td>'
                    f'<td style="padding:6px 8px;color:#475569;text-transform:capitalize;">{p.get("topSkill","")}</td>'
                    f'</tr>'
                )
            top_table = ""
            if top_rows:
                top_table = f"""
                <div style="margin-top:14px;">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#64748b;margin-bottom:8px;">
                    Top Performers
                  </div>
                  <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="background:#f8fafc;">
                      <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">#</th>
                      <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Name</th>
                      <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Role</th>
                      <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Dept</th>
                      <th style="padding:6px 8px;text-align:right;color:#475569;font-weight:600;">Perf</th>
                      <th style="padding:6px 8px;text-align:left;color:#475569;font-weight:600;">Top Skill</th>
                    </tr></thead>
                    <tbody>{top_rows}</tbody>
                  </table>
                </div>"""

            workforce_html = f"""
            <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0;">
              <h2 style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;
                          color:#64748b;margin:0 0 14px 0;">👥 Workforce</h2>
              <div style="display:flex;gap:0;">
                {_kpi_cell('Total Agents', workforce.get('totalAgents', 0), '#3b82f6')}
                {_kpi_cell('Available', by_status.get('available', 0), '#10b981')}
                {_kpi_cell('Busy', by_status.get('busy', 0), '#f59e0b')}
                {_kpi_cell('Relocated', workforce.get('relocated', 0), '#f59e0b')}
                {_kpi_cell('Avg Perf', f"{avg_perf}%", '#3b82f6')}
              </div>
              {top_table}
            </div>"""

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

            {workforce_html}

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

    async def send_pending_approval_email(self, decision: dict, *, force: bool = False) -> bool:
        """Send an HTML email for a decision that needs human approval.

        Raises NotificationError with details when force=True (test mode).
        Returns False silently when force=False (pipeline mode).
        """
        if not settings.smtp_host or not settings.smtp_to:
            if force:
                raise NotificationError("SMTP host or recipients not configured.")
            return False

        if not force and not self._check_cooldown("email_approval"):
            logger.debug("Approval email skipped (cooldown)")
            return False

        agent_type = decision.get("agentType", "unknown").replace("_", " ").title()
        confidence = decision.get("confidence", 0)
        confidence_pct = f"{confidence * 100:.0f}%"
        summary = decision.get("summary", decision.get("action", "Unknown action"))
        guardrail = decision.get("guardrailResult", "PENDING_HUMAN")
        decision_id = decision.get("id", "N/A")

        from datetime import datetime, timezone, timedelta
        ist = timezone(timedelta(hours=5, minutes=30))
        raw_ts = decision.get("timestamp", "")
        try:
            dt = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
            display_ts = dt.astimezone(ist).strftime("%d %b %Y, %I:%M %p IST")
        except Exception:
            display_ts = raw_ts or "N/A"

        subject = f"[SentinelAI] Human Approval Required — {agent_type} ({confidence_pct})"

        html = f"""
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                <tr><td>
                  <table width="100%" style="background:#fff;border-radius:12px 12px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
                    <tr><td style="padding:14px 24px;">
                      <table width="100%"><tr>
                        <td>
                          <span style="font-size:17px;font-weight:700;color:#1e293b;">Sentinel</span><span style="font-size:17px;font-weight:700;color:#3b82f6;">AI</span>
                        </td>
                        <td align="right">
                          <span style="display:inline-block;background:#fef3c7;color:#f59e0b;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;border:1px solid #f59e0b20;">
                            APPROVAL REQUIRED
                          </span>
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td><div style="height:3px;background:#f59e0b;"></div></td></tr>
                <tr><td>
                  <table width="100%" style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-bottom:none;">
                    <tr><td style="padding:24px 24px 0;">
                      <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1e293b;">Human Approval Needed</h1>
                      <span style="font-size:12px;color:#94a3b8;">{display_ts}</span>
                    </td></tr>
                    <tr><td style="padding:14px 24px 0;">
                      <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">{summary}</p>
                    </td></tr>
                    <tr><td style="padding:18px 24px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
                    <tr><td style="padding:0 24px;">
                      <table width="100%"><tr>
                        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;width:30%;">
                          <span style="display:block;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">Agent</span>
                          <span style="font-size:15px;font-weight:600;color:#1e293b;">{agent_type}</span>
                        </td>
                        <td style="width:3%;"></td>
                        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;width:30%;">
                          <span style="display:block;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">Confidence</span>
                          <span style="font-size:15px;font-weight:700;color:#f59e0b;">{confidence_pct}</span>
                        </td>
                        <td style="width:3%;"></td>
                        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;width:34%;">
                          <span style="display:block;font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;">Guardrail</span>
                          <span style="font-size:15px;font-weight:700;color:#f59e0b;">{guardrail}</span>
                        </td>
                      </tr></table>
                    </td></tr>
                    <tr><td style="padding:12px 24px 24px;">
                      <table width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;border-left:4px solid #f59e0b;">
                        <tr><td style="padding:14px 16px;">
                          <span style="display:block;font-size:10px;font-weight:600;color:#f59e0b;text-transform:uppercase;margin-bottom:4px;">Decision ID</span>
                          <span style="font-size:13px;color:#1e293b;font-family:monospace;">{decision_id}</span>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </td></tr>
                <tr><td>
                  <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 12px 12px;border-top:none;">
                    <tr><td style="padding:16px 24px;">
                      <span style="font-size:12px;font-weight:600;color:#1e293b;">Sentinel</span><span style="font-size:12px;font-weight:600;color:#3b82f6;">AI</span>
                      <span style="font-size:11px;color:#94a3b8;"> — Autonomous AI Operations</span>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """

        try:
            return await self._send_email_inner(subject, html)
        except NotificationError:
            if force:
                raise
            logger.error("Approval email failed", exc_info=True)
            return False

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

    async def notify_pending_decision(self, decision: dict):
        """Send pending-approval emails when email_notify_on == 'human_approval'."""
        if settings.email_notify_on != "human_approval":
            return
        if not settings.smtp_host or not settings.smtp_to:
            return
        try:
            await self.send_pending_approval_email(decision)
        except Exception as e:
            logger.error("Pending-decision email dispatch error: %s", e)


notification_service = NotificationService()
