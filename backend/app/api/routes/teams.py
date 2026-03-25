"""Microsoft Teams Bot Framework messaging endpoint.

Receives all Bot Framework activities at POST /api/teams/messages:
- message: user chat, Action.Submit from Adaptive Cards
- conversationUpdate: bot installed/removed
"""

import logging
import re

from fastapi import APIRouter, Request

from app.services.teams_bot import teams_bot

logger = logging.getLogger("sentinelai.teams")

router = APIRouter()

_REPORT_PATTERN = re.compile(
    r"\b(generate|create|send|get|download|build|make)\b.*\breport\b"
    r"|\breport\b.*\b(generate|create|send|get|download|build|make)\b",
    re.IGNORECASE,
)


@router.post("/teams/messages")
async def teams_messages(request: Request):
    """Bot Framework messaging endpoint.

    Azure Bot Service sends all activities here. We handle:
    - conversationUpdate: bot added → welcome message
    - message with value: Adaptive Card Action.Submit (approve/reject)
    - message matching report pattern: generate + send PDF
    - message (text): route through Analytics Agent chat
    """
    body = await request.json()
    activity_type = body.get("type", "")

    # Always store conversation reference for proactive messaging
    teams_bot.store_conversation_ref(body)

    service_url = body.get("serviceUrl", "").rstrip("/")
    conv_id = body.get("conversation", {}).get("id", "")
    reply_to = body.get("id")

    if activity_type == "conversationUpdate":
        return await _handle_conversation_update(body, service_url, conv_id)

    if activity_type == "message":
        # Card Action.Submit — approval buttons
        if body.get("value") and body["value"].get("sentinelAction"):
            result_text = await teams_bot.handle_approval_action(body, request.app.state)
            await teams_bot.send_reply(service_url, conv_id, reply_to, result_text)
            return {"status": "ok"}

        # Regular text message
        text = (body.get("text") or "").strip()
        # Remove bot @mention tags
        text_clean = re.sub(r"<at>.*?</at>\s*", "", text).strip()

        # Report request detection
        if text_clean and _REPORT_PATTERN.search(text_clean):
            return await _handle_report(body, request, service_url, conv_id, reply_to)

        # Chat message → Analytics Agent
        response_text = await teams_bot.handle_chat_message(body, request.app.state)
        await teams_bot.send_reply(service_url, conv_id, reply_to, response_text)
        return {"status": "ok"}

    # Unhandled activity types (invoke, etc.) — acknowledge
    return {"status": "ok"}


async def _handle_conversation_update(
    body: dict, service_url: str, conv_id: str
) -> dict:
    """Send welcome message when bot is added to a conversation."""
    members_added = body.get("membersAdded", [])
    bot_id = body.get("recipient", {}).get("id", "")

    if any(m.get("id") == bot_id for m in members_added):
        welcome = (
            "**SentinelAI Bot** is ready!\n\n"
            "I can help you with:\n"
            "- **Queue status** — Ask about current queue health\n"
            "- **Agent management** — Move agents, check profiles\n"
            "- **Alerts** — View active and recent alerts\n"
            "- **Approvals** — I'll send cards for decisions needing human review\n"
            "- **Reports** — Say *\"generate report\"* to get a PDF\n\n"
            "Just type your question!"
        )
        await teams_bot.send_reply(service_url, conv_id, body.get("id"), welcome)

    return {"status": "ok"}


async def _handle_report(
    body: dict,
    request: Request,
    service_url: str,
    conv_id: str,
    reply_to: str | None,
) -> dict:
    """Generate PDF report and send as attachment."""
    # Send a "working on it" message first
    await teams_bot.send_reply(
        service_url, conv_id, reply_to,
        "Generating your session report..."
    )

    text, attachments = await teams_bot.handle_report_request(body, request.app.state)
    await teams_bot.send_reply(service_url, conv_id, None, text, attachments)
    return {"status": "ok"}
