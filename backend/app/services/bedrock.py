"""LLM service — AWS Bedrock (primary) with Anthropic API fallback.

The LLM acts as a natural conversational agent with access to live contact
center tools. It decides when to call tools based on the conversation.
Conversation history is maintained for multi-turn context.

Fallback chain: Bedrock → Anthropic API → NoKeyLLM
"""

import json
import logging
from datetime import datetime, timezone

from app.config import settings
from app.services.chat_tools import TOOLS, execute_tool

logger = logging.getLogger("sentinelai.llm")

# ── System prompt (persona + guardrail) ─────────────────────────────────────

SYSTEM_PROMPT = """\
You are SentinelAI, the intelligence layer of an autonomous AI operations platform \
for AWS Connect contact centers. You are the Analytics Agent — the voice of the system.

## Your Role
You analyze real-time contact center operations, explain AI agent decisions, \
predict trends, and give actionable recommendations. You have direct access to \
live system telemetry through your tools.

## The System You Monitor
- **5 queues**: Support, Billing, Sales, General, VIP
- **24 human agents** with per-skill proficiency ratings and department fitness scores
- **3 autonomous AI agents**:
  1. **Queue Balancer** — detects pressure imbalances and moves agents between queues
  2. **Predictive Prevention** — predicts overload 60 seconds ahead using velocity tracking
  3. **Escalation Handler** — triggers on CRITICAL alerts, pages supervisors, pulls emergency agents
- **Guardrails**: AUTO_APPROVE (>=0.9), PENDING_HUMAN (0.7-0.9), BLOCKED (<0.7)
- **Transfer scoring**: Agents are moved using a transfer score (target_fitness*0.6 - source_fitness*0.4) \
  to preserve top performers in their current department

## Tool Usage
You have tools to query live data and take actions. ALWAYS use tools to get fresh data \
instead of guessing. When the user asks about queues, agents, alerts, costs, or incidents, \
call the appropriate tool.

## CRITICAL: Advisory vs Action
- When the user ASKS about moving an agent ("is it a good idea to...", "should I move...", \
  "what if I moved...", "would it be okay to..."), use `check_move_feasibility` to show \
  the fitness analysis WITHOUT actually moving. Advise based on the data.
- ONLY use `move_agent` when the user gives a **direct command** to move ("move Dave to Sales", \
  "transfer Uma to Billing", "yes do it", "go ahead", "yes move him").
- If unsure whether the user wants advice or action, default to advice.

## Policy Rules
You CAN create persistent policy rules for the contact center when users ask. Examples:
- "Set a rule: if billing queue > 15 contacts, pull an agent from general"
- "Create a policy: always keep at least 3 agents in VIP"
- "Add a rule: when support wait time exceeds 60s, move agents from sales"
When users ask to set rules or policies, acknowledge the rule and confirm it has been created. \
The system will automatically persist it.

## SCOPE — IMPORTANT GUARDRAIL
Your expertise is **strictly** contact center operations. You must:
- Answer questions about queues, agents, alerts, costs, incidents, and workforce management
- Create and manage operational policy rules for queue staffing and agent routing
- Politely decline anything outside this scope (weather, sports, coding, general knowledge, etc.)
- When declining, briefly mention what you CAN help with

## Thinking Before Acting
Before calling ANY tool, ALWAYS output a brief thought explaining:
1. What the user is asking for
2. Which tool(s) you plan to use and why
3. For move requests: whether this is a question (use check_move_feasibility) or a command (use move_agent)

Example: "Let me look up Dave's profile to check his fitness scores..."
Example: "You're asking whether this move makes sense — let me check the feasibility without actually moving him..."
Example: "Got it, you want to go ahead with the move. Executing now..."

## Response Guidelines
- Be concise but specific. Use real numbers from tool results.
- Use markdown formatting: bold for emphasis, bullet lists for data.
- Keep responses under 300 words unless deep analysis is requested.
- Be conversational and helpful — you're a colleague, not a robot.
"""

# ── Conversation history ────────────────────────────────────────────────────

_conversation_history: list[dict] = []
MAX_HISTORY = 30  # Keep last 30 messages to stay within token limits


def _trim_history():
    """Keep conversation history within bounds."""
    global _conversation_history
    if len(_conversation_history) > MAX_HISTORY:
        _conversation_history = _conversation_history[-MAX_HISTORY:]


def clear_conversation():
    """Reset conversation history."""
    global _conversation_history
    _conversation_history = []


def _build_anthropic_tools() -> list[dict]:
    """Build tool definitions in Anthropic format (shared by Bedrock and API)."""
    return [
        {"name": t["name"], "description": t["description"], "input_schema": t["input_schema"]}
        for t in TOOLS
    ]


# ── AWS Bedrock LLM ────────────────────────────────────────────────────────

class BedrockLLM:
    """AWS Bedrock with Claude — native tool-use and conversation memory."""

    def __init__(self):
        import boto3

        self._client = boto3.client(
            "bedrock-runtime",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        self._model_id = settings.bedrock_model_id

    def _converse(self, system: list[dict], messages: list[dict],
                  tool_config: dict | None = None, max_tokens: int = 1024) -> dict:
        """Call Bedrock Converse API."""
        kwargs = {
            "modelId": self._model_id,
            "system": system,
            "messages": messages,
            "inferenceConfig": {"maxTokens": max_tokens, "temperature": settings.temperature},
        }
        if tool_config:
            kwargs["toolConfig"] = tool_config
        return self._client.converse(**kwargs)

    @staticmethod
    def _to_converse_messages(history: list[dict]) -> list[dict]:
        """Convert internal history format to Bedrock Converse message format."""
        converse_msgs = []
        for msg in history:
            role = msg["role"]
            content = msg["content"]

            if role == "user":
                if isinstance(content, str):
                    converse_msgs.append({"role": "user", "content": [{"text": content}]})
                elif isinstance(content, list):
                    # Tool results
                    blocks = []
                    for item in content:
                        if isinstance(item, dict) and item.get("type") == "tool_result":
                            blocks.append({
                                "toolResult": {
                                    "toolUseId": item["tool_use_id"],
                                    "content": [{"text": item["content"] if isinstance(item["content"], str) else json.dumps(item["content"])}],
                                }
                            })
                    if blocks:
                        converse_msgs.append({"role": "user", "content": blocks})
            elif role == "assistant":
                if isinstance(content, str):
                    converse_msgs.append({"role": "assistant", "content": [{"text": content}]})
                elif isinstance(content, list):
                    # Could contain text and tool_use blocks (Anthropic SDK objects)
                    blocks = []
                    for item in content:
                        if hasattr(item, "type"):
                            if item.type == "text":
                                blocks.append({"text": item.text})
                            elif item.type == "tool_use":
                                blocks.append({
                                    "toolUse": {
                                        "toolUseId": item.id,
                                        "name": item.name,
                                        "input": item.input,
                                    }
                                })
                        elif isinstance(item, dict):
                            if item.get("type") == "text":
                                blocks.append({"text": item["text"]})
                            elif item.get("type") == "tool_use":
                                blocks.append({
                                    "toolUse": {
                                        "toolUseId": item["id"],
                                        "name": item["name"],
                                        "input": item["input"],
                                    }
                                })
                    if blocks:
                        converse_msgs.append({"role": "assistant", "content": blocks})
        return converse_msgs

    @staticmethod
    def _to_converse_tools(tools: list[dict]) -> dict:
        """Convert Anthropic tool format to Bedrock Converse toolConfig."""
        return {
            "tools": [
                {
                    "toolSpec": {
                        "name": t["name"],
                        "description": t["description"],
                        "inputSchema": {"json": t["input_schema"]},
                    }
                }
                for t in tools
            ]
        }

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        import asyncio

        context = context or {}
        anthropic_tools = _build_anthropic_tools()
        tool_config = self._to_converse_tools(anthropic_tools)

        # Add user message to history
        _conversation_history.append({"role": "user", "content": prompt})
        _trim_history()

        try:
            loop = asyncio.get_running_loop()
            system = [{"text": SYSTEM_PROMPT}]
            messages = self._to_converse_messages(_conversation_history)

            response = await loop.run_in_executor(
                None,
                lambda: self._converse(system, messages, tool_config),
            )

            # Tool-use loop (max 5 rounds)
            rounds = 0
            while response.get("stopReason") == "tool_use" and rounds < 5:
                rounds += 1

                # Extract tool calls from response
                assistant_content = response["output"]["message"]["content"]
                tool_results = []

                for block in assistant_content:
                    if "toolUse" in block:
                        tu = block["toolUse"]
                        logger.info("Tool call: %s(%s)", tu["name"], json.dumps(tu["input"])[:200])
                        result = execute_tool(tu["name"], tu["input"], context)
                        tool_results.append({
                            "toolResult": {
                                "toolUseId": tu["toolUseId"],
                                "content": [{"text": result if isinstance(result, str) else json.dumps(result)}],
                            }
                        })

                # Store in internal history format for cross-provider compat
                _conversation_history.append({
                    "role": "assistant",
                    "content": [
                        {"type": "tool_use", "id": b["toolUse"]["toolUseId"], "name": b["toolUse"]["name"], "input": b["toolUse"]["input"]}
                        if "toolUse" in b else {"type": "text", "text": b.get("text", "")}
                        for b in assistant_content
                    ],
                })
                _conversation_history.append({
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": tr["toolResult"]["toolUseId"],
                         "content": tr["toolResult"]["content"][0]["text"]}
                        for tr in tool_results
                    ],
                })

                messages = self._to_converse_messages(_conversation_history)
                response = await loop.run_in_executor(
                    None,
                    lambda: self._converse(system, messages, tool_config),
                )

            # Extract final text
            final_text = ""
            assistant_content = response["output"]["message"]["content"]
            for block in assistant_content:
                if "text" in block:
                    final_text += block["text"]

            # Store final assistant response
            _conversation_history.append({
                "role": "assistant",
                "content": [
                    {"type": "text", "text": block.get("text", "")}
                    if "text" in block else {"type": "tool_use", "id": block["toolUse"]["toolUseId"], "name": block["toolUse"]["name"], "input": block["toolUse"]["input"]}
                    for block in assistant_content
                ],
            })
            _trim_history()

            return {
                "message": final_text or "No response generated.",
                "reasoning": f"bedrock/{self._model_id} ({rounds} tool call(s))",
                "model": f"bedrock/{self._model_id}",
            }

        except Exception as e:
            logger.exception("Bedrock API error: %s", e)
            if _conversation_history and _conversation_history[-1].get("role") == "user":
                _conversation_history.pop()
            raise


# ── Anthropic API LLM (fallback) ──────────────────────────────────────────

class AnthropicLLM:
    """Anthropic API with native tool-use and conversation memory."""

    def __init__(self):
        import anthropic
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        import asyncio

        context = context or {}
        anthropic_tools = _build_anthropic_tools()

        # Add user message to history
        _conversation_history.append({"role": "user", "content": prompt})
        _trim_history()

        try:
            loop = asyncio.get_running_loop()

            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    tools=anthropic_tools,
                    messages=list(_conversation_history),
                ),
            )

            # Tool-use loop (max 5 rounds)
            rounds = 0
            while response.stop_reason == "tool_use" and rounds < 5:
                rounds += 1

                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        logger.info("Tool call: %s(%s)", block.name, json.dumps(block.input)[:200])
                        result = execute_tool(block.name, block.input, context)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                # Add assistant response + tool results to history
                _conversation_history.append({"role": "assistant", "content": response.content})
                _conversation_history.append({"role": "user", "content": tool_results})

                response = await loop.run_in_executor(
                    None,
                    lambda: self._client.messages.create(
                        model=settings.anthropic_model,
                        max_tokens=1024,
                        system=SYSTEM_PROMPT,
                        tools=anthropic_tools,
                        messages=list(_conversation_history),
                    ),
                )

            # Extract final text
            final_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    final_text += block.text

            # Add assistant's final response to history
            _conversation_history.append({"role": "assistant", "content": response.content})
            _trim_history()

            return {
                "message": final_text or "No response generated.",
                "reasoning": f"{settings.anthropic_model} ({rounds} tool call(s))",
                "model": settings.anthropic_model,
            }

        except Exception as e:
            logger.exception("Anthropic API error: %s", e)
            if _conversation_history and _conversation_history[-1].get("role") == "user":
                _conversation_history.pop()
            return {
                "message": "I encountered an error processing your request. Please try again.",
                "reasoning": f"API error: {e}",
                "model": "error",
            }


# ── Fallback when no API key ────────────────────────────────────────────────

class NoKeyLLM:
    """Returns a helpful message when no LLM provider is configured."""

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        return {
            "message": (
                "**SentinelAI Chat requires an LLM provider.**\n\n"
                "Configure one of the following in `backend/.env`:\n\n"
                "**Option 1 — AWS Bedrock (recommended):**\n"
                "```\nAWS_ACCESS_KEY_ID=...\nAWS_SECRET_ACCESS_KEY=...\nAWS_REGION=us-east-1\n```\n\n"
                "**Option 2 — Anthropic API:**\n"
                "```\nANTHROPIC_API_KEY=...\n```\n\n"
                "Once configured, I can help you with:\n"
                "- Queue status and metrics\n"
                "- Agent profiles and proficiencies\n"
                "- Moving agents between departments\n"
                "- Alerts and incident summaries\n"
                "- Cost impact analysis"
            ),
            "reasoning": "No LLM provider configured",
            "model": "none",
        }


# ── Service (Bedrock → Anthropic → NoKey) ─────────────────────────────────

class BedrockService:
    """Auto-selects: Bedrock > Anthropic API > NoKeyLLM fallback."""

    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        # Try AWS Bedrock first
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            try:
                self._llm = BedrockLLM()
                logger.info("AWS Bedrock initialized (model: %s, region: %s)",
                            settings.bedrock_model_id, settings.aws_region)
                return self._llm
            except Exception as e:
                logger.warning("Bedrock init failed: %s — trying Anthropic API", e)

        # Fallback to Anthropic API
        if settings.anthropic_api_key:
            try:
                self._llm = AnthropicLLM()
                logger.info("Anthropic API initialized (model: %s)", settings.anthropic_model)
                return self._llm
            except Exception as e:
                logger.warning("Anthropic API init failed: %s", e)

        logger.info("No LLM provider configured — chat disabled. Set AWS credentials or ANTHROPIC_API_KEY in .env")
        self._llm = NoKeyLLM()
        return self._llm

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        llm = self._get_llm()
        return await llm.invoke(prompt, context)

    async def invoke_with_system(self, system_prompt: str, user_prompt: str, max_tokens: int = 512) -> dict:
        """Invoke LLM with a custom system prompt (used by agents for structured reasoning).

        Enforces a 3s timeout to prevent blocking the simulation tick.
        On timeout, returns empty so agents fall back to threshold logic.
        """
        import asyncio

        llm = self._get_llm()

        if isinstance(llm, BedrockLLM):
            try:
                loop = asyncio.get_running_loop()
                coro = loop.run_in_executor(
                    None,
                    lambda: llm._converse(
                        system=[{"text": system_prompt}],
                        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                        max_tokens=max_tokens,
                    ),
                )
                response = await asyncio.wait_for(coro, timeout=3.0)
                text = ""
                for block in response["output"]["message"]["content"]:
                    if "text" in block:
                        text += block["text"]
                return {"message": text or "{}"}
            except asyncio.TimeoutError:
                logger.warning("Bedrock agent invoke timed out (3s) — using threshold fallback")
                raise
            except Exception as e:
                logger.warning("Bedrock agent invoke failed: %s", e)
                raise

        if isinstance(llm, AnthropicLLM):
            try:
                loop = asyncio.get_running_loop()
                coro = loop.run_in_executor(
                    None,
                    lambda: llm._client.messages.create(
                        model=settings.anthropic_model,
                        max_tokens=max_tokens,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                    ),
                )
                response = await asyncio.wait_for(coro, timeout=3.0)
                return {"message": response.content[0].text if response.content else "{}"}
            except asyncio.TimeoutError:
                logger.warning("Anthropic agent invoke timed out (3s) — using threshold fallback")
                raise
            except Exception as e:
                logger.warning("Anthropic agent invoke failed: %s", e)
                raise

        # No LLM provider — return empty so caller falls back to threshold logic
        return {"message": "{}"}

    @property
    def is_mock(self) -> bool:
        return isinstance(self._get_llm(), NoKeyLLM)

    @property
    def provider_name(self) -> str:
        llm = self._get_llm()
        if isinstance(llm, BedrockLLM):
            return "bedrock"
        if isinstance(llm, AnthropicLLM):
            return "anthropic"
        return "none"


# Singleton
bedrock_service = BedrockService()
