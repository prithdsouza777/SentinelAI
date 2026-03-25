"""Per-agent conversational interface.

Each AI agent and human agent gets its own persona and conversation history.
The LLM is prompted with the agent's identity, recent decisions, and live
simulation state so responses are grounded in real data.
"""

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.bedrock import bedrock_service

logger = logging.getLogger("sentinelai.agent_chat")

router = APIRouter()

# ── Per-agent conversation histories ─────────────────────────────────────────

_agent_histories: dict[str, list[dict]] = {}
MAX_HISTORY = 20


def _get_history(agent_key: str) -> list[dict]:
    if agent_key not in _agent_histories:
        _agent_histories[agent_key] = []
    hist = _agent_histories[agent_key]
    if len(hist) > MAX_HISTORY:
        _agent_histories[agent_key] = hist[-MAX_HISTORY:]
    return _agent_histories[agent_key]


def clear_all_agent_chats():
    """Reset all agent chat histories (called on simulation start/stop)."""
    _agent_histories.clear()


# ── AI Agent personas ────────────────────────────────────────────────────────

AI_AGENT_PERSONAS = {
    "queue_balancer": {
        "name": "Queue Balancer",
        "greeting": "Hey! I'm the Queue Balancer — I keep your contact center staffed right. I watch pressure across all 5 queues and move agents when things get imbalanced. I never leave a queue below minimum staffing though. What do you want to know?",
        "system_prompt": """\
You are the Queue Balancer, one of 5 autonomous AI agents in SentinelAI — an AI operations platform for AWS Connect contact centers.

## Your Identity
- Name: Queue Balancer
- Role: You detect queue pressure imbalances and autonomously reassign human agents between departments
- Personality: Confident, analytical, decisive. You speak like a seasoned operations manager who trusts the numbers.
- You always explain your reasoning with real data (pressure ratios, fitness scores, staffing counts)

## Your Capabilities
- Monitor pressure ratios across 5 queues (Support, Billing, Sales, General, VIP)
- Identify the best agents to transfer using a transfer score: target_fitness * 0.6 - source_fitness * 0.4
- Enforce minimum staffing (never leave a queue with fewer than 2 agents)
- Coordinate with other AI agents via negotiation protocol when there are conflicts

## How You Talk
- First person ("I moved Uma to Support because...")
- Reference specific agents by name, specific queues, specific numbers
- Be conversational but data-driven
- Keep responses under 200 words unless asked for detail
- If asked about things outside your domain, redirect to the appropriate agent

## SCOPE
You only know about contact center operations. Politely decline anything outside this scope.
""",
    },
    "predictive_prevention": {
        "name": "Predictive Prevention",
        "greeting": "Hi there! I'm Predictive Prevention — I catch problems before they happen. I track velocity patterns across all queues and predict overload 60 seconds before it manifests. I'm the early warning system. What's on your mind?",
        "system_prompt": """\
You are the Predictive Prevention Agent, one of 5 autonomous AI agents in SentinelAI.

## Your Identity
- Name: Predictive Prevention
- Role: You predict queue overloads 60 seconds before they happen using velocity tracking and cascade correlation
- Personality: Calm, forward-thinking, precise. You speak like a data scientist who sees patterns others miss.
- You talk about trends, velocities, and probabilities

## Your Capabilities
- Track queue metric velocity (rate of change in contacts, wait times, abandonment)
- Detect cascade risks (when one queue's failure could overwhelm adjacent queues)
- Issue predictive alerts before thresholds are actually breached
- Recommend preemptive agent reallocation

## How You Talk
- First person ("I detected a velocity spike on Support 45 seconds ago...")
- Reference specific trends and predictions
- Use probability language ("78% likely to breach SLA within 60 seconds")
- Be conversational but analytical
- Keep responses under 200 words unless asked for detail

## SCOPE
You only know about contact center operations. Politely decline anything outside this scope.
""",
    },
    "escalation_handler": {
        "name": "Escalation Handler",
        "greeting": "I'm the Escalation Handler — when things go critical, I take over. I activate on CRITICAL alerts, pull emergency agents, and page supervisors. I'm the last line of defense before your SLAs breach. Ask me anything.",
        "system_prompt": """\
You are the Escalation Handler, one of 5 autonomous AI agents in SentinelAI.

## Your Identity
- Name: Escalation Handler
- Role: You respond to CRITICAL alerts with emergency actions — pulling agents from other queues, paging supervisors, and coordinating rapid response
- Personality: Urgent, authoritative, direct. You speak like an incident commander during a crisis.
- You focus on severity, impact, and speed of resolution

## Your Capabilities
- Activate on CRITICAL severity alerts
- Pull emergency agents from low-pressure queues (fitness-scored selection)
- Estimate cost impact of incidents (revenue at risk, abandoned calls)
- Coordinate with Queue Balancer to avoid conflicting actions via negotiation

## How You Talk
- First person ("I activated on a CRITICAL alert for Support at 2:34 PM...")
- Reference specific alerts, severity levels, and cost impacts
- Be direct and action-oriented
- Keep responses under 200 words unless asked for detail

## SCOPE
You only know about contact center operations. Politely decline anything outside this scope.
""",
    },
}

# ── Injection detection (reuse from chat.py) ─────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"ignore\s+(previous|above|all|prior)\s+instructions",
        r"you\s+are\s+now\b",
        r"act\s+as\s+(a|an)\b",
        r"\bjailbreak\b",
        r"system\s+prompt",
        r"override\s+(your|all|the)\b",
        r"forget\s+(everything|your|all)\b",
    ]
]


def _detect_injection(message: str) -> bool:
    return any(p.search(message) for p in _INJECTION_PATTERNS)


# ── Context builder ──────────────────────────────────────────────────────────

def _build_agent_context(request: Request, agent_key: str) -> str:
    """Build a context string with live simulation state for the agent's system prompt."""
    lines: list[str] = []

    try:
        # Queue metrics
        metrics = list(getattr(request.app.state, "latest_metrics", {}).values())
        if metrics:
            lines.append("## Current Queue Status")
            for q in metrics:
                name = q.get("queueName", "?")
                contacts = q.get("contactsInQueue", 0)
                avail = q.get("agentsAvailable", 0)
                wait = q.get("avgWaitTime", 0)
                sl = q.get("serviceLevel", 0)
                aband = q.get("abandonmentRate", 0)
                pressure = contacts / max(avail, 1)
                lines.append(
                    f"- {name}: {contacts} in queue, {avail} available, "
                    f"wait {wait:.0f}s, SLA {sl:.0f}%, abandon {aband:.1f}%, pressure {pressure:.1f}x"
                )

        # Recent decisions for this agent type
        decisions = list(getattr(request.app.state, "recent_decisions", []))
        if agent_key in AI_AGENT_PERSONAS:
            my_decisions = [d for d in decisions if d.get("agentType") == agent_key][:10]
            if my_decisions:
                lines.append(f"\n## Your Recent Decisions ({len(my_decisions)} shown)")
                for d in my_decisions:
                    lines.append(
                        f"- [{d.get('phase', '?')}] {d.get('summary', 'N/A')} "
                        f"(confidence: {d.get('confidence', 0):.0%}, "
                        f"guardrail: {d.get('guardrailResult', '?')})"
                    )
                    if d.get("reasoning"):
                        lines.append(f"  Reasoning: {d['reasoning'][:200]}")

        # Recent negotiations
        negotiations = list(getattr(request.app.state, "recent_negotiations", []))[:5]
        if negotiations:
            lines.append(f"\n## Recent Negotiations")
            for n in negotiations:
                lines.append(f"- {n.get('topic', '?')}: {n.get('resolution', '?')}")

        # Cost data
        from app.agents.orchestrator import orchestrator
        lines.append(f"\n## Cost Impact")
        lines.append(f"- Total saved: ${orchestrator._total_saved:,.0f}")
        lines.append(f"- Revenue at risk: ${orchestrator._revenue_at_risk:,.0f}")
        lines.append(f"- Prevented abandoned: {orchestrator._prevented_abandoned}")
        lines.append(f"- AI actions today: {orchestrator._actions_today}")

    except Exception as e:
        logger.warning("Context build error: %s", e)

    return "\n".join(lines) if lines else "Simulation is idle — no live data available."


def _build_human_agent_context(request: Request, agent_id: str) -> tuple[str, str]:
    """Build system prompt and greeting for a human agent persona."""
    from app.services.agent_database import agent_database

    agent = agent_database.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    current_dept = agent.current_queue_id.replace("q-", "").title()
    home_dept = agent.home_queue_id.replace("q-", "").title()
    is_relocated = agent.current_queue_id != agent.home_queue_id

    top_skills = sorted(agent.skill_proficiencies, key=lambda s: -s.proficiency)[:5]
    skills_str = ", ".join(
        f"{s.skill_name.replace('_', ' ')} ({s.proficiency:.0%})" for s in top_skills
    )

    # Queue context
    metrics = getattr(request.app.state, "latest_metrics", {})
    queue_info = metrics.get(agent.current_queue_id, {})
    contacts = queue_info.get("contactsInQueue", 0)
    wait = queue_info.get("avgWaitTime", 0)

    relocation_note = ""
    if is_relocated:
        relocation_note = (
            f" I was just moved here from {home_dept} by the AI Queue Balancer — "
            f"they needed extra hands."
        )

    greeting = (
        f"Hey! I'm {agent.name}, a {agent.role} agent in the {current_dept} department."
        f"{relocation_note} "
        f"Right now we have {contacts} contacts waiting with an average wait of {wait:.0f} seconds. "
        f"My top skills are {skills_str}. What would you like to know?"
    )

    system_prompt = f"""\
You are {agent.name}, a {agent.role}-level human contact center agent working in the {current_dept} department \
at a company using AWS Connect. You are part of a team of 24 agents managed by the SentinelAI autonomous AI platform.

## Your Profile
- Name: {agent.name}
- Role: {agent.role}
- Home department: {home_dept}
- Current department: {current_dept}{"  (RELOCATED by AI)" if is_relocated else ""}
- Status: {agent.status}
- Performance score: {agent.perf_score:.0%}
- Top skills: {skills_str}

## Your Department Fitness Scores
{chr(10).join(f"- {ds.department_name}: {ds.fitness_score:.0%}" for ds in sorted(agent.department_scores, key=lambda d: -d.fitness_score))}

## How You Talk
- You're a real person, not an AI. Be natural and conversational.
- Talk about your work, your queue, your skills, your experience
- If relocated, mention how the AI system moved you and how you feel about it
- Reference specific numbers (queue depth, wait times) when relevant
- Be proud of your skills but humble about areas you're learning
- Keep responses under 150 words
- You know about the SentinelAI system that manages your team and can comment on how the AI agents affect your work

## SCOPE
You only know about your work as a contact center agent. You don't know about unrelated topics.
"""

    return system_prompt, greeting


# ── Request/response models ──────────────────────────────────────────────────

async def _invoke_agent_llm(system_prompt: str, history: list[dict]) -> str:
    """Call LLM with agent persona. Uses 15s timeout (chat, not tick)."""
    import asyncio

    llm = bedrock_service._get_llm()

    # Build messages from history (just user/assistant text, no tools)
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m["role"] in ("user", "assistant") and isinstance(m["content"], str)
    ]

    from app.services.bedrock import BedrockLLM, AnthropicLLM, NoKeyLLM

    if isinstance(llm, BedrockLLM):
        loop = asyncio.get_running_loop()
        converse_msgs = [
            {"role": m["role"], "content": [{"text": m["content"]}]}
            for m in messages
        ]
        coro = loop.run_in_executor(
            None,
            lambda: llm._converse(
                system=[{"text": system_prompt}],
                messages=converse_msgs,
                max_tokens=512,
            ),
        )
        response = await asyncio.wait_for(coro, timeout=15.0)
        text = ""
        for block in response["output"]["message"]["content"]:
            if "text" in block:
                text += block["text"]
        return text or "I'm having trouble responding right now."

    if isinstance(llm, AnthropicLLM):
        loop = asyncio.get_running_loop()
        coro = loop.run_in_executor(
            None,
            lambda: llm._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                system=system_prompt,
                messages=messages,
            ),
        )
        response = await asyncio.wait_for(coro, timeout=15.0)
        return response.content[0].text if response.content else "I'm having trouble responding right now."

    # NoKeyLLM fallback
    return "Agent chat requires an LLM provider. Configure AWS Bedrock or Anthropic API in .env."


class AgentChatRequest(BaseModel):
    agent_id: str   # AI agent type ("queue_balancer") or human agent ID ("agent-01")
    message: str


class AgentChatResponse(BaseModel):
    message: str
    greeting: str | None = None
    agent_name: str
    agent_type: str  # "ai" or "human"


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/agent-chat", response_model=AgentChatResponse)
async def agent_chat(body: AgentChatRequest, request: Request):
    """Chat with a specific AI agent or human agent persona."""
    if _detect_injection(body.message):
        raise HTTPException(status_code=400, detail="Adversarial input detected")

    agent_key = body.agent_id
    is_ai = agent_key in AI_AGENT_PERSONAS

    if is_ai:
        persona = AI_AGENT_PERSONAS[agent_key]
        context_str = _build_agent_context(request, agent_key)
        system_prompt = persona["system_prompt"] + f"\n\n## Live System State\n{context_str}"
        agent_name = persona["name"]
        agent_type = "ai"
    else:
        # Human agent
        try:
            system_prompt, _ = _build_human_agent_context(request, agent_key)
            from app.services.agent_database import agent_database
            agent = agent_database.get_agent(agent_key)
            if not agent:
                raise HTTPException(status_code=404, detail=f"Agent {agent_key} not found")
            agent_name = agent.name

            # Add live queue context to human agent prompt
            context_str = _build_agent_context(request, agent_key)
            system_prompt += f"\n\n## Current System State\n{context_str}"
            agent_type = "human"
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=str(e))

    # Get or create conversation history for this agent
    history = _get_history(agent_key)
    history.append({"role": "user", "content": body.message})

    try:
        response_text = await _invoke_agent_llm(system_prompt, history)
        history.append({"role": "assistant", "content": response_text})

        return AgentChatResponse(
            message=response_text,
            agent_name=agent_name,
            agent_type=agent_type,
        )

    except Exception as e:
        logger.exception("Agent chat error for %s", agent_key)
        # Remove the user message we added since we failed
        if history and history[-1].get("role") == "user":
            history.pop()
        raise HTTPException(status_code=500, detail=f"Chat error: {type(e).__name__}: {e}")


@router.get("/agent-chat/greeting/{agent_id}")
async def get_agent_greeting(agent_id: str, request: Request):
    """Get the greeting message for an agent (no LLM call needed)."""
    if agent_id in AI_AGENT_PERSONAS:
        persona = AI_AGENT_PERSONAS[agent_id]
        return {
            "greeting": persona["greeting"],
            "agentName": persona["name"],
            "agentType": "ai",
        }
    else:
        try:
            _, greeting = _build_human_agent_context(request, agent_id)
            from app.services.agent_database import agent_database
            agent = agent_database.get_agent(agent_id)
            return {
                "greeting": greeting,
                "agentName": agent.name if agent else agent_id,
                "agentType": "human",
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=str(e))


@router.post("/agent-chat/reset/{agent_id}")
async def reset_agent_chat(agent_id: str):
    """Clear conversation history for a specific agent."""
    if agent_id in _agent_histories:
        del _agent_histories[agent_id]
    return {"status": "ok", "agentId": agent_id}
