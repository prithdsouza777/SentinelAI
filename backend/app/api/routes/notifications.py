"""Notification configuration and test endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings
from app.services.notifications import notification_service

router = APIRouter()


class NotificationConfig(BaseModel):
    teams_webhook_url: str = ""
    teams_notify_on: str = "critical"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_to: str = ""
    email_notify_on: str = "critical"
    notification_cooldown: int = 60


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
    """Update notification settings at runtime (not persisted to .env)."""
    if config.teams_webhook_url is not None:
        settings.teams_webhook_url = config.teams_webhook_url
    settings.teams_notify_on = config.teams_notify_on

    if config.smtp_host is not None:
        settings.smtp_host = config.smtp_host
    settings.smtp_port = config.smtp_port
    if config.smtp_user is not None:
        settings.smtp_user = config.smtp_user
    # Only update password if it's not the masked placeholder
    if config.smtp_password and config.smtp_password != "********":
        settings.smtp_password = config.smtp_password
    if config.smtp_from is not None:
        settings.smtp_from = config.smtp_from
    if config.smtp_to is not None:
        settings.smtp_to = config.smtp_to
    settings.email_notify_on = config.email_notify_on
    settings.notification_cooldown = config.notification_cooldown

    return {"status": "updated"}


@router.post("/notifications/test/teams")
async def test_teams():
    """Send a test notification to Teams."""
    if not settings.teams_webhook_url:
        return {"status": "error", "message": "Teams webhook URL not configured"}

    test_alert = {
        "id": "test-alert",
        "severity": "warning",
        "title": "Test Alert - SentinelAI Notifications",
        "description": "This is a test notification from SentinelAI. If you see this, Teams integration is working.",
        "queueName": "Test Queue",
        "recommendedAction": "No action needed - this is a test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Bypass cooldown for test
    notification_service._cooldowns.pop("teams", None)
    ok = await notification_service.send_teams(test_alert)
    if ok:
        return {"status": "ok", "message": "Test notification sent to Teams"}
    return {"status": "error", "message": "Failed to send Teams notification. Check webhook URL."}


@router.post("/notifications/test/email")
async def test_email():
    """Send a test notification via email."""
    if not settings.smtp_host or not settings.smtp_to:
        return {"status": "error", "message": "SMTP not configured or no recipients set"}

    test_alert = {
        "id": "test-alert",
        "severity": "critical",
        "title": "Test Alert - SentinelAI Notifications",
        "description": "This is a test email from SentinelAI. If you see this, Gmail/email integration is working.",
        "queueName": "Test Queue",
        "recommendedAction": "No action needed - this is a test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Bypass cooldown for test
    notification_service._cooldowns.pop("email", None)
    ok = await notification_service.send_email(test_alert)
    if ok:
        return {"status": "ok", "message": f"Test email sent to {settings.smtp_to}"}
    return {"status": "error", "message": "Failed to send email. Check SMTP settings."}
