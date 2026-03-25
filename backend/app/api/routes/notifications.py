"""Notification configuration and test endpoints."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.notifications import NotificationError, notification_service

router = APIRouter()


class NotificationConfig(BaseModel):
    teams_webhook_url: Optional[str] = None
    teams_notify_on: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_to: Optional[str] = None
    email_notify_on: Optional[str] = None
    notification_cooldown: Optional[int] = None


@router.get("/notifications/config")
async def get_config():
    """Return current notification settings (password masked)."""
    return {
        "teamsWebhookUrl": settings.teams_webhook_url,
        "teamsNotifyOn": settings.teams_notify_on,
        "smtpHost": settings.smtp_host,
        "smtpPort": settings.smtp_port,
        "smtpUser": settings.smtp_user,
        "smtpPassword": "********" if settings.smtp_password else "",
        "smtpFrom": settings.smtp_from,
        "smtpTo": settings.smtp_to,
        "emailNotifyOn": settings.email_notify_on,
        "notificationCooldown": settings.notification_cooldown,
    }


@router.put("/notifications/config")
async def update_config(config: NotificationConfig):
    """Update notification settings at runtime (only fields that are sent)."""
    if config.teams_webhook_url is not None:
        settings.teams_webhook_url = config.teams_webhook_url
    if config.teams_notify_on is not None:
        settings.teams_notify_on = config.teams_notify_on
    if config.smtp_host is not None:
        settings.smtp_host = config.smtp_host
    if config.smtp_port is not None:
        settings.smtp_port = config.smtp_port
    if config.smtp_user is not None:
        settings.smtp_user = config.smtp_user
    if config.smtp_password is not None and config.smtp_password != "********":
        settings.smtp_password = config.smtp_password
    if config.smtp_from is not None:
        settings.smtp_from = config.smtp_from
    if config.smtp_to is not None:
        settings.smtp_to = config.smtp_to
    if config.email_notify_on is not None:
        settings.email_notify_on = config.email_notify_on
    if config.notification_cooldown is not None:
        settings.notification_cooldown = config.notification_cooldown

    return {"status": "updated"}


@router.post("/notifications/test/teams")
async def test_teams():
    """Send a test notification to Teams."""
    if not settings.teams_webhook_url:
        return {"status": "error", "message": "Teams webhook URL not configured."}

    test_alert = {
        "id": "test-alert",
        "severity": "warning",
        "title": "Test Alert - SentinelAI Notifications",
        "description": "This is a test notification from SentinelAI. If you see this, Teams integration is working.",
        "queueName": "Test Queue",
        "recommendedAction": "No action needed - this is a test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await notification_service.send_teams(test_alert, force=True)
        return {"status": "ok", "message": "Test notification sent to Teams."}
    except NotificationError as e:
        return {"status": "error", "message": str(e)}


@router.post("/notifications/test/email")
async def test_email():
    """Send a test notification via email (adapts to current email mode)."""
    # Pre-flight checks with specific messages
    if not settings.smtp_host:
        return {"status": "error", "message": "SMTP host not configured. Set it in the form above or in .env."}
    if not settings.smtp_to:
        return {"status": "error", "message": "No recipient email configured. Set SMTP_TO in the form above or in .env."}
    if not settings.smtp_user:
        return {"status": "error", "message": "SMTP username not set. Required for authentication."}
    if not settings.smtp_password:
        return {"status": "error", "message": "SMTP password not set. For Gmail, use an App Password."}

    try:
        if settings.email_notify_on == "human_approval":
            test_decision = {
                "id": "test-decision-0001",
                "agentType": "queue_balancer",
                "confidence": 0.72,
                "action": "move_agents:from=q-sales:to=q-support:count=2",
                "summary": "Test — Move 2 agents from Sales to Support (this is a test notification)",
                "queueId": "q-support",
                "guardrailResult": "PENDING_HUMAN",
                "policyViolations": [],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await notification_service.send_pending_approval_email(test_decision, force=True)
        else:
            test_alert = {
                "id": "test-alert",
                "severity": "critical",
                "title": "Test Alert - SentinelAI Notifications",
                "description": "This is a test email from SentinelAI. If you see this, email integration is working.",
                "queueName": "Test Queue",
                "recommendedAction": "No action needed - this is a test",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await notification_service.send_email(test_alert, force=True)

        return {"status": "ok", "message": f"Test email sent to {settings.smtp_to}"}
    except NotificationError as e:
        return {"status": "error", "message": str(e)}
