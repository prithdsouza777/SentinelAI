"""External notification service for queue spike alerts.

Supports:
- Microsoft Teams incoming webhook (Adaptive Cards)
- Outlook / SMTP email notifications

Both channels have independent cooldowns to prevent alert spam.
"""

import asyncio
import logging
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

logger = logging.getLogger("sentinelai.notifications")


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
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=card)
                if resp.status_code in (200, 202):
                    logger.info("Teams notification sent: %s", alert.get("title"))
                    return True
                else:
                    logger.warning("Teams webhook returned %s: %s", resp.status_code, resp.text[:200])
                    return False
        except Exception as e:
            logger.error("Teams notification failed: %s", e)
            return False

    # ── Outlook / SMTP Email ────────────────────────────────────────────────

    async def send_email(self, alert: dict) -> bool:
        """Send an HTML email via SMTP (Outlook, Gmail, etc.)."""
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

        html = f"""
        <html>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background: {badge_color}; padding: 16px 24px;">
              <h2 style="color: white; margin: 0; font-size: 18px;">SentinelAI Queue Alert</h2>
            </div>
            <div style="padding: 24px;">
              <div style="display: inline-block; background: {badge_color}15; color: {badge_color}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
                {severity}
              </div>
              <h3 style="color: #1e293b; margin: 0 0 12px 0;">{alert.get("title", "Queue Alert")}</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 140px;">Queue</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">{alert.get("queueName", "Unknown")}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Description</td>
                  <td style="padding: 8px 0; color: #1e293b;">{alert.get("description", "")}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Recommended Action</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">{alert.get("recommendedAction", "Monitor situation")}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Timestamp</td>
                  <td style="padding: 8px 0; color: #94a3b8; font-size: 12px;">{alert.get("timestamp", "N/A")}</td>
                </tr>
              </table>
            </div>
            <div style="background: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">Sent by SentinelAI — Autonomous AI Operations Layer</p>
            </div>
          </div>
        </body>
        </html>
        """

        recipients = [r.strip() for r in settings.smtp_to.split(",") if r.strip()]

        try:
            # Run blocking SMTP in a thread to avoid blocking the event loop
            await asyncio.to_thread(self._send_smtp, subject, html, recipients)
            logger.info("Email notification sent to %s: %s", recipients, alert.get("title"))
            return True
        except Exception as e:
            logger.error("Email notification failed: %s", e)
            return False

    def _send_smtp(self, subject: str, html: str, recipients: list[str]):
        """Blocking SMTP send (run via asyncio.to_thread)."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            if settings.smtp_port != 25:
                server.starttls()
                server.ehlo()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], recipients, msg.as_string())

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
