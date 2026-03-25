"""Microsoft Teams Bot — Bot Framework REST API integration.

Provides bidirectional Teams communication:
- Chat: same LLM pipeline as POST /chat (Analytics Agent + tool-use)
- Approval cards: proactive Adaptive Cards with Approve/Reject buttons
- Reports: server-side PDF generation sent as file attachment

Uses the Bot Framework REST API directly (no SDK) for FastAPI compatibility.
"""

import asyncio
import base64
import logging
import re
import time
from dataclasses import dataclass, field

import httpx

from app.config import settings

logger = logging.getLogger("sentinelai.teams_bot")

# ── Conversation reference (for proactive messaging) ─────────────────────────


@dataclass
class ConversationRef:
    service_url: str
    conversation_id: str
    channel_id: str = ""
    tenant_id: str = ""
    bot_id: str = ""
    bot_name: str = "SentinelAI"


# ── Core service ─────────────────────────────────────────────────────────────


class TeamsBotService:
    """Singleton service for Teams Bot Framework REST API interactions."""

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires: float = 0.0
        self._conversation_refs: dict[str, ConversationRef] = {}
        self._chat_histories: dict[str, list[dict]] = {}
        self._max_history: int = 30

    # ── Auth ──────────────────────────────────────────────────────────────

    def _is_configured(self) -> bool:
        return bool(settings.teams_bot_app_id and settings.teams_bot_app_secret)

    async def _get_token(self) -> str:
        """Fetch or return cached OAuth2 token for Bot Framework."""
        if self._token and time.monotonic() < self._token_expires:
            return self._token

        url = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": settings.teams_bot_app_id,
            "client_secret": settings.teams_bot_app_secret,
            "scope": "https://api.botframework.com/.default",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=data)
            resp.raise_for_status()
            body = resp.json()

        self._token = body["access_token"]
        # Refresh 5 minutes before actual expiry
        self._token_expires = time.monotonic() + body.get("expires_in", 3600) - 300
        logger.info("Teams Bot OAuth2 token acquired (expires in %ss)", body.get("expires_in"))
        return self._token

    # ── Conversation reference store ─────────────────────────────────────

    def has_conversations(self) -> bool:
        return bool(self._conversation_refs)

    def store_conversation_ref(self, activity: dict) -> None:
        """Extract and persist conversation reference from an incoming activity."""
        conv = activity.get("conversation", {})
        conv_id = conv.get("id", "")
        if not conv_id:
            return

        self._conversation_refs[conv_id] = ConversationRef(
            service_url=activity.get("serviceUrl", "").rstrip("/"),
            conversation_id=conv_id,
            channel_id=activity.get("channelId", ""),
            tenant_id=conv.get("tenantId", ""),
            bot_id=activity.get("recipient", {}).get("id", ""),
            bot_name=activity.get("recipient", {}).get("name", "SentinelAI"),
        )

    # ── Send helpers ─────────────────────────────────────────────────────

    async def send_activity(
        self,
        service_url: str,
        conversation_id: str,
        activity_payload: dict,
    ) -> dict | None:
        """POST an activity to Bot Framework Connector.

        Works in two modes:
        - Authenticated (App ID + Secret configured): sends with Bearer token
        - Emulator / local (no credentials): sends without auth header
        """
        if not service_url or not conversation_id:
            return None

        url = f"{service_url}/v3/conversations/{conversation_id}/activities"
        headers: dict[str, str] = {"Content-Type": "application/json"}

        if self._is_configured():
            token = await self._get_token()
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=activity_payload, headers=headers)
                if resp.status_code in (200, 201, 202):
                    return resp.json()
                logger.warning("Bot send failed HTTP %s: %s", resp.status_code, resp.text[:300])
        except Exception as e:
            logger.error("Bot send_activity error: %s", e)
        return None

    async def send_reply(
        self,
        service_url: str,
        conversation_id: str,
        reply_to_id: str | None,
        text: str | None = None,
        attachments: list[dict] | None = None,
    ) -> dict | None:
        """Send a reply to a specific activity."""
        payload: dict = {"type": "message"}
        if text:
            payload["text"] = text
        if reply_to_id:
            payload["replyToId"] = reply_to_id
        if attachments:
            payload["attachments"] = attachments
        return await self.send_activity(service_url, conversation_id, payload)

    # ── Proactive approval card ──────────────────────────────────────────

    def _build_approval_card(self, decision: dict) -> dict:
        """Build an Adaptive Card for a PENDING_HUMAN decision."""
        agent_type = decision.get("agentType", "unknown").replace("_", " ").title()
        confidence = decision.get("confidence", 0)
        confidence_pct = f"{confidence * 100:.0f}%"
        summary = decision.get("summary", decision.get("action", "Unknown action"))
        decision_id = decision.get("id", "N/A")

        return {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "contentUrl": None,
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "SentinelAI — Approval Required",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "Warning",
                        "style": "heading",
                    },
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "PENDING HUMAN REVIEW",
                                        "color": "Warning",
                                        "weight": "Bolder",
                                        "size": "Small",
                                    }
                                ],
                            }
                        ],
                    },
                    {
                        "type": "FactSet",
                        "facts": [
                            {"title": "Agent", "value": agent_type},
                            {"title": "Action", "value": summary},
                            {"title": "Confidence", "value": confidence_pct},
                            {"title": "Decision ID", "value": decision_id[:12] + "..."},
                        ],
                    },
                    {
                        "type": "TextBlock",
                        "text": "Auto-approves in 30s if no action taken.",
                        "isSubtle": True,
                        "size": "Small",
                        "spacing": "Medium",
                    },
                ],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Approve",
                        "style": "positive",
                        "data": {
                            "sentinelAction": "approve",
                            "decisionId": decision_id,
                        },
                    },
                    {
                        "type": "Action.Submit",
                        "title": "Reject",
                        "style": "destructive",
                        "data": {
                            "sentinelAction": "reject",
                            "decisionId": decision_id,
                        },
                    },
                ],
            },
        }

    async def send_proactive_approval_card(self, decision: dict) -> None:
        """Send an approval card to all stored conversations."""
        if not self._conversation_refs:
            return

        card = self._build_approval_card(decision)
        payload = {
            "type": "message",
            "attachments": [card],
        }

        tasks = []
        for ref in self._conversation_refs.values():
            tasks.append(
                self.send_activity(ref.service_url, ref.conversation_id, payload)
            )
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for r in results:
                if isinstance(r, Exception):
                    logger.error("Proactive approval card error: %s", r)

    # ── Approval action handler ──────────────────────────────────────────

    async def handle_approval_action(self, activity: dict, app_state) -> str:
        """Handle an Action.Submit from an approval card."""
        value = activity.get("value", {})
        action = value.get("sentinelAction", "")
        decision_id = value.get("decisionId", "")

        if not decision_id or action not in ("approve", "reject"):
            return "Invalid action. Expected approve or reject with a decision ID."

        from app.agents.orchestrator import orchestrator

        approved = action == "approve"
        user_name = activity.get("from", {}).get("name", "Teams user")
        ok = await orchestrator.handle_human_decision(
            decision_id, approved=approved, approver=f"teams:{user_name}"
        )

        if not ok:
            return f"Could not {action} decision `{decision_id[:12]}...` — it may have already been processed or auto-approved."

        if approved:
            try:
                decisions = list(getattr(app_state, "recent_decisions", []))
                await orchestrator.execute_approved_decision(decision_id, decisions)
            except Exception:
                pass
            return f"Decision **approved** by {user_name} and executed."
        else:
            return f"Decision **rejected** by {user_name}."

    # ── Chat handler ─────────────────────────────────────────────────────

    async def handle_chat_message(self, activity: dict, app_state) -> str:
        """Process a Teams chat message through the Analytics Agent."""
        text = (activity.get("text") or "").strip()
        # Remove bot @mention if present
        text = re.sub(r"<at>.*?</at>\s*", "", text).strip()

        if not text:
            return "Please send a message and I'll help you with queue management, alerts, and more."

        # Injection detection (reuse patterns from chat.py)
        from app.api.routes.chat import _detect_injection
        if _detect_injection(text):
            return "Message blocked: potentially adversarial input detected."

        # Build context (same as _build_chat_context in chat.py)
        context = self._build_context(app_state)

        # Route through Analytics Agent
        from app.agents.analytics import analytics_agent
        from app.services.sanitizer import sanitize_string

        sanitized = sanitize_string(text)
        try:
            result = await asyncio.wait_for(
                analytics_agent.query(sanitized, context),
                timeout=25.0,
            )
            return result.get("message", "I couldn't generate a response. Please try again.")
        except asyncio.TimeoutError:
            return "Request timed out. The system might be busy — please try again in a moment."
        except Exception as e:
            logger.error("Teams chat error: %s", e)
            return "An error occurred processing your message. Please try again."

    def _build_context(self, app_state) -> dict:
        """Build LLM context from app.state (mirrors _build_chat_context)."""
        from app.agents.guardrails import guardrails

        context: dict = {}
        try:
            context["recent_alerts"] = list(getattr(app_state, "recent_alerts", []))[:20]
            context["recent_decisions"] = list(getattr(app_state, "recent_decisions", []))[:15]
            context["queue_metrics"] = list(getattr(app_state, "latest_metrics", {}).values())
            context["recent_negotiations"] = list(getattr(app_state, "recent_negotiations", []))[:5]

            from app.agents.orchestrator import orchestrator
            context["cost_data"] = {
                "totalSaved": orchestrator._total_saved,
                "revenueAtRisk": orchestrator._revenue_at_risk,
                "totalPreventedAbandoned": orchestrator._prevented_abandoned,
                "actionsToday": orchestrator._actions_today,
            }
            context["governance"] = guardrails.get_governance_summary()

            from app.services.agent_database import agent_database
            if agent_database._initialized:
                context["workforce"] = [
                    {
                        "id": a.id,
                        "name": a.name,
                        "role": a.role,
                        "currentQueue": a.current_queue_id,
                        "homeQueue": a.home_queue_id,
                        "status": a.status,
                        "topSkills": sorted(
                            [(sp.skill_name, sp.proficiency) for sp in a.skill_proficiencies],
                            key=lambda x: -x[1],
                        )[:4],
                        "deptScores": {
                            ds.department_name: round(ds.fitness_score, 2)
                            for ds in a.department_scores
                        },
                    }
                    for a in agent_database.get_all_agents()
                ]
        except Exception:
            pass
        return context

    # ── Report handler ───────────────────────────────────────────────────

    async def handle_report_request(self, activity: dict, app_state) -> tuple[str, list[dict]]:
        """Generate a PDF report and return (text, attachments) for the reply."""
        try:
            from app.api.routes.reports import _build_report_from_state
            from app.services.pdf_report import generate_report_pdf

            report = _build_report_from_state(app_state)
            pdf_bytes = generate_report_pdf(report)
            pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")

            scenario = report.get("simulationScenario", "session")
            tick = report.get("simulationTick", 0)
            filename = f"SentinelAI_Report_{scenario}_tick{tick}.pdf"

            attachment = {
                "contentType": "application/vnd.microsoft.teams.card.file.consent",
                "contentUrl": None,
                "name": filename,
                "content": None,
            }

            # For Teams, send as inline base64 file
            inline_attachment = {
                "contentType": "application/pdf",
                "contentUrl": f"data:application/pdf;base64,{pdf_b64}",
                "name": filename,
            }

            text = (
                f"Here's your **SentinelAI Session Report** "
                f"(Scenario: {scenario}, Tick: {tick})."
            )
            return text, [inline_attachment]

        except Exception as e:
            logger.error("Report generation failed: %s", e)
            return "Failed to generate the report. Please try again.", []


# ── Singleton ────────────────────────────────────────────────────────────────
teams_bot = TeamsBotService()
