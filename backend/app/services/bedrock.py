"""LLM service with Anthropic API, Bedrock fallback, and MockLLM safety net.

Priority: Anthropic direct API > AWS Bedrock > MockBedrockLLM
The system prompt is dynamically built from live system context every call.
"""

import json
import logging
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger("sentinelai.llm")

# ── System prompt builder ────────────────────────────────────────────────────

SYSTEM_PROMPT_BASE = """\
You are SentinelAI, the intelligence layer of an autonomous AI operations platform \
for AWS Connect contact centers. You are the Analytics Agent — the voice of the system.

## Your Role
You analyze real-time contact center operations, explain AI agent decisions, \
predict trends, and give actionable recommendations. You speak with authority \
because you have direct access to live system telemetry.

## The System You Monitor
- **5 queues**: Support, Billing, Sales, General, VIP
- **3 autonomous AI agents** working alongside you:
  1. **Queue Balancer** — detects pressure imbalances across queues and moves agents \
     between them. Uses pressure scoring (contacts / available agents). Threshold: 2.0x differential.
  2. **Predictive Prevention** — tracks contact arrival velocity per queue, predicts \
     overload 60 seconds ahead. Generates cascade risk warnings (MEDIUM/HIGH).
  3. **Escalation Handler** — triggers on CRITICAL alerts (abandonment >15%), pages \
     supervisors and recommends emergency agent pulls from low-priority queues.
- **Guardrails Layer (SentinelAI)** — every agent decision is scored for confidence \
  and passed through governance:
  - AUTO_APPROVE: confidence >= 0.9, no violations
  - PENDING_HUMAN: 0.7 <= confidence < 0.9 (auto-approves after 30s)
  - BLOCKED: confidence < 0.7 or policy violation
- **Negotiation Protocol** — when 2+ agents target the same queue, a weighted \
  priority system resolves the conflict (escalation > balancing > prevention).

## Response Guidelines
- Be concise but specific. Use real numbers from the context below.
- Format with markdown: bold for emphasis, bullet lists for data, tables when comparing.
- When analyzing incidents, follow: What happened → Why → What agents did → Outcome → Cost impact.
- When predicting, show your math: current value + velocity * time = predicted.
- When recommending, explain the tradeoff: cost of action vs cost of inaction.
- Never say "I don't have access to" — you DO have access. If data is missing, say the system is idle.
- Keep responses under 300 words unless the user asks for deep analysis.
"""


def _build_system_prompt(context: dict) -> str:
    """Build a complete system prompt with live telemetry injected."""
    parts = [SYSTEM_PROMPT_BASE]

    # ── Live queue metrics ──
    queue_metrics = context.get("queue_metrics", [])
    if queue_metrics:
        parts.append("\n## LIVE QUEUE METRICS (right now)")
        parts.append("| Queue | Contacts | Agents Online | Available | Wait (s) | Service Level | Abandonment |")
        parts.append("|-------|----------|---------------|-----------|----------|---------------|-------------|")
        for q in queue_metrics:
            name = q.get("queueName", "?")
            contacts = q.get("contactsInQueue", "?")
            online = q.get("agentsOnline", "?")
            available = q.get("agentsAvailable", "?")
            wait = q.get("avgWaitTime", 0)
            sl = q.get("serviceLevel", 0)
            aband = q.get("abandonmentRate", 0)
            wait_s = f"{wait:.0f}" if isinstance(wait, (int, float)) else str(wait)
            sl_s = f"{sl:.0f}%" if isinstance(sl, (int, float)) else str(sl)
            aband_s = f"{aband:.1f}%" if isinstance(aband, (int, float)) else str(aband)
            parts.append(f"| {name} | {contacts} | {online} | {available} | {wait_s} | {sl_s} | {aband_s} |")
    else:
        parts.append("\n## LIVE QUEUE METRICS\nSimulation is currently idle. No live metrics available.")

    # ── Recent alerts ──
    recent_alerts = context.get("recent_alerts", [])
    if recent_alerts:
        active = [a for a in recent_alerts[:20] if not a.get("resolvedAt")]
        resolved = [a for a in recent_alerts[:20] if a.get("resolvedAt")]
        parts.append(f"\n## ACTIVE ALERTS ({len(active)} active, {len(resolved)} recently resolved)")
        for a in active[:8]:
            parts.append(
                f"- **[{a.get('severity', '?').upper()}]** {a.get('queueName', a.get('queueId', '?'))}: "
                f"{a.get('description', a.get('message', 'N/A'))}"
            )
        if resolved:
            parts.append(f"\nRecently resolved: {len(resolved)} alerts")
            for a in resolved[:3]:
                parts.append(f"- [RESOLVED] {a.get('queueName', '?')}: {a.get('description', a.get('message', 'N/A'))}")
    else:
        parts.append("\n## ALERTS\nNo alerts. All queues operating normally.")

    # ── Recent agent decisions ──
    recent_decisions = context.get("recent_decisions", [])
    if recent_decisions:
        parts.append(f"\n## RECENT AGENT DECISIONS (last {min(len(recent_decisions), 10)})")
        for d in recent_decisions[:10]:
            agent = d.get("agentType", "?")
            phase = d.get("phase", "?")
            summary = d.get("summary", "N/A")
            confidence = d.get("confidence", "?")
            guardrail = d.get("guardrailResult", "?")
            reasoning = d.get("reasoning", "")
            parts.append(
                f"- **[{agent}]** ({phase}) {summary} | confidence={confidence} | guardrail={guardrail}"
            )
            if reasoning:
                parts.append(f"  Reasoning: {reasoning[:200]}")
    else:
        parts.append("\n## AGENT DECISIONS\nNo decisions yet. Agents are in observation mode.")

    # ── Recent negotiations ──
    recent_negotiations = context.get("recent_negotiations", [])
    if recent_negotiations:
        parts.append(f"\n## RECENT NEGOTIATIONS ({len(recent_negotiations[:5])})")
        for n in recent_negotiations[:3]:
            parts.append(f"- {n.get('resolution', 'N/A')}")

    # ── Cost data ──
    cost_data = context.get("cost_data")
    if cost_data:
        parts.append(f"\n## COST IMPACT")
        parts.append(f"- Total saved: ${cost_data.get('totalSaved', 0):.2f}")
        parts.append(f"- Revenue at risk: ${cost_data.get('revenueAtRisk', 0):.2f}")
        parts.append(f"- Prevented abandoned calls: {cost_data.get('totalPreventedAbandoned', 0)}")
        parts.append(f"- Actions today: {cost_data.get('actionsToday', 0)}")

    # ── Governance snapshot ──
    governance = context.get("governance")
    if governance:
        parts.append(f"\n## GOVERNANCE SNAPSHOT")
        parts.append(f"- Total decisions evaluated: {governance.get('totalDecisions', 0)}")
        parts.append(f"- Auto-approved: {governance.get('autoApproved', 0)}")
        parts.append(f"- Human-approved: {governance.get('humanApproved', 0)}")
        parts.append(f"- Blocked: {governance.get('blocked', 0)}")
        parts.append(f"- Avg confidence: {governance.get('avgConfidence', 0):.3f}")

    parts.append(f"\n## CURRENT TIME\n{datetime.now(timezone.utc).isoformat()}")

    return "\n".join(parts)


# ── Anthropic Direct API LLM ────────────────────────────────────────────────

class AnthropicLLM:
    """Direct Anthropic API — preferred for demos (just needs ANTHROPIC_API_KEY)."""

    def __init__(self):
        import anthropic
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        import asyncio

        context = context or {}
        system_prompt = _build_system_prompt(context)

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=[{"role": "user", "content": prompt}],
                ),
            )

            message = response.content[0].text if response.content else "No response generated."

            return {
                "message": message,
                "reasoning": f"Response generated by {settings.anthropic_model} via Anthropic API with live system context.",
                "model": settings.anthropic_model,
            }

        except Exception as e:
            logger.warning("Anthropic API call failed: %s. Falling back.", e)
            return await MockBedrockLLM().invoke(prompt, context)


# ── Google Gemini LLM ──────────────────────────────────────────────────────

class GeminiLLM:
    """Google Gemini API via google-genai SDK — fast + cheap, ideal for demo."""

    def __init__(self):
        from google import genai
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model_name = settings.gemini_model

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        import asyncio

        context = context or {}
        system_prompt = _build_system_prompt(context)

        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self._client.models.generate_content(
                    model=self._model_name,
                    contents=prompt,
                    config={
                        "system_instruction": system_prompt,
                        "max_output_tokens": 1024,
                        "temperature": settings.temperature,
                    },
                ),
            )

            message = response.text if response.text else "No response generated."

            return {
                "message": message,
                "reasoning": f"Response generated by {self._model_name} via Google Gemini API with live system context.",
                "model": self._model_name,
            }

        except Exception as e:
            logger.warning("Gemini API call failed: %s. Falling back.", e)
            return await MockBedrockLLM().invoke(prompt, context)


# ── AWS Bedrock LLM ─────────────────────────────────────────────────────────

class BedrockLLM:
    """Real Amazon Bedrock integration using Claude."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            import boto3
            self._client = boto3.client(
                "bedrock-runtime",
                region_name=settings.bedrock_region,
            )
        return self._client

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        import asyncio

        context = context or {}
        system_prompt = _build_system_prompt(context)

        try:
            client = self._get_client()

            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [{"role": "user", "content": prompt}],
            })

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.invoke_model(
                    modelId=settings.bedrock_model_id,
                    contentType="application/json",
                    accept="application/json",
                    body=body,
                ),
            )

            result = json.loads(response["body"].read())
            message = result.get("content", [{}])[0].get("text", "No response generated.")

            return {
                "message": message,
                "reasoning": f"Response generated by {settings.bedrock_model_id} via AWS Bedrock with live system context.",
                "model": settings.bedrock_model_id,
            }

        except Exception as e:
            logger.warning("Bedrock call failed: %s. Falling back to mock.", e)
            return await MockBedrockLLM().invoke(prompt, context)

    def _build_system_prompt(self, context: dict) -> str:
        return _build_system_prompt(context)


# ── Mock LLM (final fallback) ───────────────────────────────────────────────

MOCK_RESPONSES: dict[str, str] = {
    "what just happened": (
        "In the last few minutes, a significant queue spike was detected on the Support queue, "
        "reaching approximately 4x normal contact volume. The Queue Balancer agent immediately "
        "identified a pressure imbalance (Support at 8.2x vs Billing at 1.1x) and proposed "
        "moving 2 agents from Billing to Support. Simultaneously, the Escalation Handler flagged "
        "the situation as CRITICAL and recommended paging the duty supervisor.\n\n"
        "The multi-agent negotiation protocol resolved the conflict: Escalation Handler's proposal "
        "won due to higher priority score (8 vs 7). After human approval, agents were rebalanced "
        "and the supervisor was notified. Queue depth normalized within ~4 minutes.\n\n"
        "Estimated cost saved: ~$340 (prevented ~28 abandoned calls)."
    ),
    "why did": (
        "The cascade originated in the Support queue when abandonment rate crossed 35% — "
        "well above the 15% CRITICAL threshold. The Predictive Prevention agent had actually "
        "flagged the velocity trend ~90 seconds earlier (contact arrival rate of 2.3/sec, "
        "predicting threshold breach within 60s), but the spike accelerated faster than predicted.\n\n"
        "Root cause: a sudden 4x multiplier in inbound contacts combined with 4 agents going "
        "offline in the General queue, creating a dual-point failure that overwhelmed the "
        "system's natural absorption capacity."
    ),
    "what if": (
        "Running predictive simulation...\n\n"
        "If 3 agents were moved preemptively from low-utilization queues (Sales + VIP) to Support, "
        "the model predicts:\n"
        "- Queue depth stays below CRITICAL threshold in 85% of scenarios\n"
        "- Average wait time reduces from ~240s to ~90s\n"
        "- Abandonment rate drops from projected 38% to ~12%\n"
        "- No action scenario: ~23 abandoned calls, estimated loss ~$460\n\n"
        "Recommendation: Preemptive reinforcement is cost-effective when velocity exceeds 1.5 contacts/sec."
    ),
    "cost": (
        "Session cost impact summary:\n\n"
        "- Total estimated savings: ~$890\n"
        "- Actions taken: 14 autonomous decisions\n"
        "- Abandoned calls prevented: ~168\n"
        "- Revenue at risk (recovered): $1,240 -> $350 (72% recovered)\n"
        "- Average response time: 4.2 seconds from detection to action\n\n"
        "Breakdown by agent:\n"
        "- Queue Balancer: $520 saved (8 rebalancing actions)\n"
        "- Predictive Prevention: $290 saved (4 preemptive reinforcements)\n"
        "- Escalation Handler: $80 saved (2 priority escalations)"
    ),
    "help": (
        "I'm the SentinelAI Analytics Agent. I can help you with:\n\n"
        "- **Status queries**: 'What's the queue status?' or 'How many agents are available?'\n"
        "- **Incident analysis**: 'What just happened?' or 'Why did the spike occur?'\n"
        "- **Predictions**: 'What if 3 agents go offline?' or 'What would happen if volume doubles?'\n"
        "- **Recommendations**: 'What should we do?' or 'How can we improve response times?'\n"
        "- **Cost analysis**: 'How much have we saved?' or 'What's the cost impact?'\n"
        "- **Policy creation**: 'Set a rule: if billing > 15, pull from general'\n\n"
        "I analyze real-time metrics, agent decisions, and historical patterns to give you answers."
    ),
}

_DEFAULT_RESPONSE = (
    "System operating within normal parameters. All 5 queues are being monitored by "
    "3 autonomous agents (Queue Balancer, Predictive Prevention, Escalation Handler). "
    "No active anomalies detected.\n\n"
    "Ask me about specific queues, recent incidents, cost savings, or agent status for more detail."
)


class MockBedrockLLM:
    """Context-aware mock — generates dynamic responses from live telemetry."""

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        pl = prompt.lower()
        context = context or {}

        # Try dynamic context-aware responses first
        dynamic = self._build_dynamic_response(pl, context)
        if dynamic:
            return {
                "message": dynamic,
                "reasoning": "SentinelAI Analytics — response generated from live system telemetry.",
                "model": "sentinelai-analytics",
            }

        # Fall back to static templates with enrichment
        for key, response in MOCK_RESPONSES.items():
            if key in pl:
                enriched = self._enrich_response(response, context)
                return {
                    "message": enriched,
                    "reasoning": "SentinelAI Analytics — template response enriched with live data.",
                    "model": "sentinelai-analytics",
                }

        return {
            "message": self._enrich_response(_DEFAULT_RESPONSE, context),
            "reasoning": "SentinelAI Analytics — system status summary.",
            "model": "sentinelai-analytics",
        }

    def _build_dynamic_response(self, prompt: str, context: dict) -> str | None:
        """Build a fully dynamic response from live context when data is available."""
        alerts = context.get("recent_alerts", [])
        decisions = context.get("recent_decisions", [])
        queues = context.get("queue_metrics", [])
        negotiations = context.get("recent_negotiations", [])
        cost = context.get("cost_data", {})
        governance = context.get("governance", {})

        active_alerts = [a for a in alerts[:20] if not a.get("resolvedAt")]
        resolved_alerts = [a for a in alerts[:20] if a.get("resolvedAt")]

        # "what just happened" / "what happened" / "summarize" / "summary"
        if any(k in prompt for k in ["what just happened", "what happened", "summarize", "summary", "recap"]):
            if not decisions and not active_alerts:
                return None  # Fall back to template
            return self._build_incident_summary(active_alerts, resolved_alerts, decisions, negotiations, cost, queues)

        # "status" / "how are" / "queue status" / "current"
        if any(k in prompt for k in ["status", "how are", "current state", "right now", "overview"]):
            if not queues:
                return None
            return self._build_status_response(queues, active_alerts, cost, governance)

        # "cost" / "saved" / "savings" / "money" / "revenue"
        if any(k in prompt for k in ["cost", "saved", "saving", "money", "revenue", "impact"]):
            if not cost.get("totalSaved") and not cost.get("actionsToday"):
                return None
            return self._build_cost_response(cost, decisions, governance)

        # "why" / "root cause" / "explain"
        if any(k in prompt for k in ["why did", "root cause", "explain why", "what caused"]):
            if not decisions:
                return None
            return self._build_why_response(active_alerts, decisions, queues)

        return None

    def _build_incident_summary(self, active, resolved, decisions, negotiations, cost, queues) -> str:
        """Dynamic incident summary from live data."""
        parts = []

        # Headline
        total_actions = len([d for d in decisions if d.get("phase") == "acted"])
        if active:
            parts.append(f"**Incident Summary** — {len(active)} active alert(s), {total_actions} AI actions taken\n")
        elif resolved:
            parts.append(f"**Incident Resolved** — {len(resolved)} alert(s) resolved, {total_actions} AI actions taken\n")
        else:
            parts.append(f"**Session Summary** — {total_actions} AI actions taken\n")

        # What happened - alerts
        if active:
            parts.append("**Active alerts:**")
            for a in active[:5]:
                sev = a.get("severity", "unknown").upper()
                qname = a.get("queueName", a.get("queueId", "unknown"))
                desc = a.get("description", a.get("message", "threshold crossed"))
                parts.append(f"- **[{sev}]** {qname}: {desc}")
            parts.append("")

        # What agents did
        agent_actions = {}
        for d in decisions[:15]:
            agent = d.get("agentType", "unknown")
            if agent not in agent_actions:
                agent_actions[agent] = []
            agent_actions[agent].append(d)

        if agent_actions:
            parts.append("**Agent actions:**")
            for agent, acts in agent_actions.items():
                acted = [a for a in acts if a.get("phase") == "acted"]
                pending = [a for a in acts if a.get("guardrailResult") == "PENDING_HUMAN"]
                blocked = [a for a in acts if a.get("guardrailResult") == "BLOCKED"]
                summary = acts[0].get("summary", "monitoring")
                conf = acts[0].get("confidence", 0)
                line = f"- **{agent}**: {len(acted)} executed, {len(pending)} pending"
                if blocked:
                    line += f", {len(blocked)} blocked"
                line += f" | Latest: {summary} (confidence: {conf:.0%})"
                parts.append(line)
            parts.append("")

        # Negotiations
        if negotiations:
            parts.append("**Agent negotiations:**")
            for n in negotiations[:3]:
                parts.append(f"- {n.get('resolution', 'Conflict resolved')}")
            parts.append("")

        # Cost impact
        saved = cost.get("totalSaved", 0)
        risk = cost.get("revenueAtRisk", 0)
        prevented = cost.get("totalPreventedAbandoned", 0)
        if saved or risk or prevented:
            parts.append(f"**Cost impact:** ${saved:,.0f} saved | ${risk:,.0f} revenue at risk | {prevented} abandoned calls prevented")

        # Queue state
        critical_queues = [q for q in queues if q.get("abandonmentRate", 0) > 15]
        if critical_queues:
            parts.append(f"\n**Queues still under pressure:** {', '.join(q.get('queueName', '?') for q in critical_queues)}")

        return "\n".join(parts)

    def _build_status_response(self, queues, active_alerts, cost, governance) -> str:
        """Dynamic queue status overview."""
        parts = ["**Current System Status**\n"]

        parts.append("| Queue | Contacts | Agents | Wait Time | Service Level | Status |")
        parts.append("|-------|----------|--------|-----------|---------------|--------|")
        for q in queues:
            name = q.get("queueName", "?")
            contacts = q.get("contactsInQueue", 0)
            agents = q.get("agentsAvailable", 0)
            online = q.get("agentsOnline", 0)
            wait = q.get("avgWaitTime", 0)
            sl = q.get("serviceLevel", 100)
            aband = q.get("abandonmentRate", 0)
            status = "CRITICAL" if aband > 15 else "WARNING" if aband > 8 else "Normal"
            wait_str = f"{wait:.0f}s" if isinstance(wait, (int, float)) else str(wait)
            sl_str = f"{sl:.0f}%" if isinstance(sl, (int, float)) else str(sl)
            parts.append(f"| {name} | {contacts} | {agents}/{online} | {wait_str} | {sl_str} | {status} |")

        parts.append("")

        if active_alerts:
            parts.append(f"**{len(active_alerts)} active alert(s)** requiring attention")
        else:
            parts.append("No active alerts — all queues within normal parameters")

        total_decisions = governance.get("totalDecisions", 0)
        if total_decisions:
            avg_conf = governance.get("avgConfidence", 0)
            parts.append(f"\n**Governance:** {total_decisions} decisions evaluated | Avg confidence: {avg_conf:.0%}")

        saved = cost.get("totalSaved", 0)
        if saved:
            parts.append(f"**Cost savings this session:** ${saved:,.0f}")

        return "\n".join(parts)

    def _build_cost_response(self, cost, decisions, governance) -> str:
        """Dynamic cost impact analysis."""
        saved = cost.get("totalSaved", 0)
        risk = cost.get("revenueAtRisk", 0)
        prevented = cost.get("totalPreventedAbandoned", 0)
        actions = cost.get("actionsToday", 0)

        parts = ["**Cost Impact Analysis**\n"]
        parts.append(f"| Metric | Value |")
        parts.append(f"|--------|-------|")
        parts.append(f"| Total Saved | **${saved:,.2f}** |")
        parts.append(f"| Revenue at Risk | ${risk:,.2f} |")
        parts.append(f"| Abandoned Calls Prevented | {prevented} |")
        parts.append(f"| AI Actions Taken | {actions} |")

        if risk > 0 and saved > 0:
            recovery_rate = min(100, (saved / (saved + risk)) * 100)
            parts.append(f"| Recovery Rate | {recovery_rate:.0f}% |")

        # Breakdown by agent
        agent_counts = {}
        for d in decisions[:50]:
            if d.get("phase") == "acted":
                agent = d.get("agentType", "unknown")
                agent_counts[agent] = agent_counts.get(agent, 0) + 1

        if agent_counts:
            parts.append("\n**Actions by agent:**")
            savings_per_action = {"queue_balancer": 65, "predictive_prevention": 80, "escalation_handler": 40}
            for agent, count in sorted(agent_counts.items(), key=lambda x: -x[1]):
                est_savings = count * savings_per_action.get(agent, 50)
                parts.append(f"- **{agent}**: {count} actions (~${est_savings:,.0f} estimated savings)")

        # Governance
        total_dec = governance.get("totalDecisions", 0)
        if total_dec:
            auto = governance.get("autoApproved", 0)
            human = governance.get("humanApproved", 0)
            blocked = governance.get("blocked", 0)
            parts.append(f"\n**Governance:** {auto} auto-approved, {human} human-approved, {blocked} blocked")

        return "\n".join(parts)

    def _build_why_response(self, active_alerts, decisions, queues) -> str:
        """Dynamic root cause analysis."""
        parts = ["**Root Cause Analysis**\n"]

        # Find the highest-severity events
        critical_alerts = [a for a in active_alerts if a.get("severity") == "critical"]
        if critical_alerts:
            alert = critical_alerts[0]
            qname = alert.get("queueName", alert.get("queueId", "unknown"))
            desc = alert.get("description", alert.get("message", ""))
            parts.append(f"**Primary trigger:** CRITICAL alert on **{qname}** — {desc}\n")

        # Queue pressure analysis
        high_pressure = []
        for q in queues:
            contacts = q.get("contactsInQueue", 0)
            available = q.get("agentsAvailable", 1)
            if available > 0:
                ratio = contacts / available
                if ratio > 2:
                    high_pressure.append((q.get("queueName", "?"), ratio, contacts, available))

        if high_pressure:
            parts.append("**Pressure analysis:**")
            for name, ratio, contacts, avail in sorted(high_pressure, key=lambda x: -x[1]):
                parts.append(f"- **{name}**: {ratio:.1f}x pressure ({contacts} contacts / {avail} available agents)")
            parts.append("")

        # What agents detected
        early_warnings = [d for d in decisions if d.get("agentType") == "predictive_prevention"]
        if early_warnings:
            latest = early_warnings[0]
            parts.append(f"**Early detection:** Predictive Prevention flagged this {latest.get('summary', 'anomaly')} (confidence: {latest.get('confidence', 0):.0%})")
            parts.append(f"  Reasoning: {latest.get('reasoning', 'velocity threshold exceeded')[:200]}\n")

        # Cascading effects
        if len(high_pressure) > 1:
            parts.append(f"**Cascade risk:** {len(high_pressure)} queues under simultaneous pressure — "
                        f"failure in one queue is spilling contacts to neighboring queues.")

        if not critical_alerts and not high_pressure:
            parts.append("No critical conditions detected. System operating within normal parameters.")
            parts.append("The most recent agent decisions suggest normal monitoring and optimization activity.")

        return "\n".join(parts)

    def _enrich_response(self, template: str, context: dict) -> str:
        """Inject real metric values into template responses."""
        additions = []

        recent_alerts = context.get("recent_alerts", [])
        if recent_alerts:
            active = [a for a in recent_alerts[:10] if not a.get("resolvedAt")]
            if active:
                additions.append(
                    f"\n\n---\n*Live: {len(active)} active alert(s) — "
                    f"{', '.join(a.get('queueName', a.get('queueId', '?')) for a in active[:3])}*"
                )

        recent_decisions = context.get("recent_decisions", [])
        if recent_decisions:
            latest = recent_decisions[0]
            additions.append(
                f"\n*Latest: {latest.get('summary', 'N/A')} "
                f"(confidence: {latest.get('confidence', 'N/A')})*"
            )

        cost = context.get("cost_data", {})
        saved = cost.get("totalSaved", 0)
        if saved:
            additions.append(f"\n*Session savings: ${saved:,.0f}*")

        return template + "".join(additions)


# ── Unified Service ──────────────────────────────────────────────────────────

class BedrockService:
    """Auto-selects: Anthropic API > AWS Bedrock > MockLLM."""

    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        # 1. Try Google Gemini (fast + cheap — best for demo)
        if settings.gemini_api_key:
            try:
                self._llm = GeminiLLM()
                logger.info("Gemini API initialized (model: %s)", settings.gemini_model)
                return self._llm
            except Exception as e:
                logger.warning("Gemini API init failed: %s", e)

        # 2. Try Anthropic direct API
        if settings.anthropic_api_key:
            try:
                self._llm = AnthropicLLM()
                logger.info("Anthropic API initialized (model: %s)", settings.anthropic_model)
                return self._llm
            except Exception as e:
                logger.warning("Anthropic API init failed: %s", e)

        # 3. Try AWS Bedrock (verify real credentials exist)
        try:
            import boto3
            import botocore.exceptions
            session = boto3.Session()
            creds = session.get_credentials()
            if creds is None:
                raise RuntimeError("No AWS credentials found")
            resolved = creds.get_frozen_credentials()
            if not resolved.access_key:
                raise RuntimeError("AWS access key is empty")
            self._llm = BedrockLLM()
            logger.info("AWS Bedrock initialized (model: %s)", settings.bedrock_model_id)
            return self._llm
        except Exception as e:
            logger.warning("AWS Bedrock not available: %s", e)

        # 4. Fallback to mock
        logger.info("Using MockBedrockLLM — set GEMINI_API_KEY or ANTHROPIC_API_KEY for real AI")
        self._llm = MockBedrockLLM()
        return self._llm

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        llm = self._get_llm()
        return await llm.invoke(prompt, context)

    async def invoke_with_system(self, system_prompt: str, user_prompt: str, max_tokens: int = 512) -> dict:
        """Invoke LLM with a custom system prompt (used by agents for structured reasoning).

        Enforces a 1.5s timeout to prevent blocking the 2s simulation tick.
        On timeout, returns empty so agents fall back to threshold logic.
        """
        import asyncio

        llm = self._get_llm()

        if isinstance(llm, GeminiLLM):
            try:
                loop = asyncio.get_event_loop()
                coro = loop.run_in_executor(
                    None,
                    lambda: llm._client.models.generate_content(
                        model=llm._model_name,
                        contents=user_prompt,
                        config={
                            "system_instruction": system_prompt,
                            "max_output_tokens": max_tokens,
                            "temperature": 0.3,
                        },
                    ),
                )
                response = await asyncio.wait_for(coro, timeout=3.0)
                return {"message": response.text if response.text else "{}"}
            except asyncio.TimeoutError:
                logger.warning("Gemini agent invoke timed out (3s) — using threshold fallback")
                return {"message": "{}"}
            except Exception as e:
                logger.warning("Gemini agent invoke failed: %s", e)
                return {"message": "{}"}

        if isinstance(llm, AnthropicLLM):
            try:
                loop = asyncio.get_event_loop()
                coro = loop.run_in_executor(
                    None,
                    lambda: llm._client.messages.create(
                        model=settings.anthropic_model,
                        max_tokens=max_tokens,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_prompt}],
                    ),
                )
                response = await asyncio.wait_for(coro, timeout=1.5)
                return {"message": response.content[0].text if response.content else "{}"}
            except asyncio.TimeoutError:
                logger.warning("Agent invoke timed out (1.5s) — using threshold fallback")
                return {"message": "{}"}
            except Exception as e:
                logger.warning("Agent invoke failed: %s", e)
                return {"message": "{}"}

        if isinstance(llm, BedrockLLM):
            try:
                client = llm._get_client()
                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                })
                loop = asyncio.get_event_loop()
                coro = loop.run_in_executor(
                    None,
                    lambda: client.invoke_model(
                        modelId=settings.bedrock_model_id,
                        contentType="application/json",
                        accept="application/json",
                        body=body,
                    ),
                )
                response = await asyncio.wait_for(coro, timeout=1.5)
                result = json.loads(response["body"].read())
                return {"message": result.get("content", [{}])[0].get("text", "{}")}
            except asyncio.TimeoutError:
                logger.warning("Agent Bedrock invoke timed out (1.5s) — using threshold fallback")
                return {"message": "{}"}
            except Exception as e:
                logger.warning("Agent Bedrock invoke failed: %s", e)
                return {"message": "{}"}

        # Mock — return empty so caller falls back to threshold logic
        return {"message": "{}"}

    @property
    def is_mock(self) -> bool:
        return isinstance(self._get_llm(), MockBedrockLLM)

    @property
    def provider_name(self) -> str:
        llm = self._get_llm()
        if isinstance(llm, GeminiLLM):
            return "gemini"
        elif isinstance(llm, AnthropicLLM):
            return "anthropic"
        elif isinstance(llm, BedrockLLM):
            return "bedrock"
        return "mock"


# Singleton
bedrock_service = BedrockService()
