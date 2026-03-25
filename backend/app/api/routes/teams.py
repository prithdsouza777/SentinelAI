"""Microsoft Teams Bot Framework messaging endpoint.

Receives all Bot Framework activities at POST /api/teams/messages:
- message: user chat, Action.Submit from Adaptive Cards
- conversationUpdate: bot installed/removed

Bot Framework expects a 200 response within ~15 seconds, so long-running
operations (LLM chat, report generation) are dispatched to background tasks
and replies are sent proactively.
"""

import asyncio
import logging
import re

from fastapi import APIRouter, Request
from starlette.responses import JSONResponse

from app.services.teams_bot import teams_bot

logger = logging.getLogger("sentinelai.teams")

router = APIRouter()

_REPORT_PATTERN = re.compile(
    r"\b(generate|create|send|get|download|build|make)\b.*\breport\b"
    r"|\breport\b.*\b(generate|create|send|get|download|build|make)\b",
    re.IGNORECASE,
)

_OK = JSONResponse({"status": "ok"}, status_code=200)


def _fire_and_forget(coro):
    """Schedule a coroutine as a background task with error logging."""
    def _on_done(t):
        if not t.cancelled() and t.exception():
            logger.error("Teams background task failed: %s", t.exception(), exc_info=t.exception())
    task = asyncio.create_task(coro)
    task.add_done_callback(_on_done)
    return task


@router.post("/teams/messages")
async def teams_messages(request: Request):
    """Bot Framework messaging endpoint.

    Returns 200 immediately for all activity types.
    Long-running work (chat, reports) runs in background tasks.
    """
    body = await request.json()
    activity_type = body.get("type", "")

    # Always store conversation reference for proactive messaging
    teams_bot.store_conversation_ref(body)

    service_url = body.get("serviceUrl", "").rstrip("/")
    conv_id = body.get("conversation", {}).get("id", "")
    reply_to = body.get("id")

    if activity_type == "conversationUpdate":
        # Welcome message is fast — can handle inline
        _fire_and_forget(_handle_conversation_update(body, service_url, conv_id))
        return _OK

    if activity_type == "message":
        # Card Action.Submit — approval buttons (fast path)
        if body.get("value") and body["value"].get("sentinelAction"):
            _fire_and_forget(_handle_approval(body, request.app.state, service_url, conv_id, reply_to))
            return _OK

        # Regular text message
        text = (body.get("text") or "").strip()
        text_clean = re.sub(r"<at>.*?</at>\s*", "", text).strip()

        # Report request detection
        if text_clean and _REPORT_PATTERN.search(text_clean):
            _fire_and_forget(_handle_report(body, request.app.state, service_url, conv_id, reply_to))
            return _OK

        # Chat message → Analytics Agent (slow — background task)
        _fire_and_forget(_handle_chat(body, request.app.state, service_url, conv_id, reply_to))
        return _OK

    # Unhandled activity types (invoke, etc.) — acknowledge
    return _OK


async def _handle_conversation_update(
    body: dict, service_url: str, conv_id: str
) -> None:
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


async def _handle_approval(
    body: dict, app_state, service_url: str, conv_id: str, reply_to: str | None,
) -> None:
    """Handle Adaptive Card approval/reject action."""
    try:
        result_text = await teams_bot.handle_approval_action(body, app_state)
        await teams_bot.send_reply(service_url, conv_id, reply_to, result_text)
    except Exception as e:
        logger.error("Teams approval error: %s", e, exc_info=True)
        await teams_bot.send_reply(service_url, conv_id, reply_to, "Error processing approval action.")


async def _handle_chat(
    body: dict, app_state, service_url: str, conv_id: str, reply_to: str | None,
) -> None:
    """Process chat message through Analytics Agent and send reply."""
    try:
        response_text = await teams_bot.handle_chat_message(body, app_state)
        await teams_bot.send_reply(service_url, conv_id, reply_to, response_text)
    except Exception as e:
        logger.error("Teams chat error: %s", e, exc_info=True)
        await teams_bot.send_reply(
            service_url, conv_id, reply_to,
            "Sorry, something went wrong processing your message. Please try again.",
        )


async def _handle_report(
    body: dict,
    app_state,
    service_url: str,
    conv_id: str,
    reply_to: str | None,
) -> None:
    """Generate PDF report and send as attachment."""
    try:
        await teams_bot.send_reply(
            service_url, conv_id, reply_to,
            "Generating your session report..."
        )
        text, attachments = await teams_bot.handle_report_request(body, app_state)
        await teams_bot.send_reply(service_url, conv_id, None, text, attachments)
    except Exception as e:
        logger.error("Teams report error: %s", e, exc_info=True)
        await teams_bot.send_reply(
            service_url, conv_id, reply_to,
            "Failed to generate the report. Please try again.",
        )
