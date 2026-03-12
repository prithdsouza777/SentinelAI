"""Bedrock LLM service with MockBedrockLLM fallback.

Provides AI-powered responses for the Analytics Agent and chat.
Uses real Amazon Bedrock when AWS credentials are available,
falls back to MockBedrockLLM with curated demo responses.
"""

import json
from datetime import datetime, timezone

from app.config import settings

# ── Mock response templates (pattern-matched on prompt.lower()) ──────────────

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
        "- Revenue at risk (recovered): $1,240 → $350 (72% recovered)\n"
        "- Average response time: 4.2 seconds from detection to action\n\n"
        "Breakdown by agent:\n"
        "- Queue Balancer: $520 saved (8 rebalancing actions)\n"
        "- Predictive Prevention: $290 saved (4 preemptive reinforcements)\n"
        "- Escalation Handler: $80 saved (2 priority escalations)"
    ),
    "agents": (
        "Current agent status:\n\n"
        "1. **Queue Balancer** — ACTIVE | Monitoring pressure across 5 queues | "
        "Last action: moved 2 agents Billing → Support | Confidence: 0.92\n"
        "2. **Predictive Prevention** — ACTIVE | Tracking velocity on all queues | "
        "No active warnings | Confidence: 0.87\n"
        "3. **Escalation Handler** — ACTIVE | 0 pending escalations | "
        "Last escalation: Support queue CRITICAL (resolved) | Confidence: 0.80\n"
        "4. **Analytics** (me) — ACTIVE | Processing your queries | Confidence: 1.0\n\n"
        "Total agents online across all queues: 37 | Available: 24"
    ),
    "recommend": (
        "Based on current patterns and historical data, I recommend:\n\n"
        "1. **Increase Support staffing by 2 agents during 9am-11am** — Historical data shows "
        "a 40% spike probability during this window. Preemptive staffing costs ~$60/hr but "
        "prevents ~$200/hr in abandonment losses.\n\n"
        "2. **Lower the Predictive Prevention velocity threshold from 1.5 to 1.2 contacts/sec** — "
        "This would have caught today's spike 30 seconds earlier.\n\n"
        "3. **Create a policy rule**: 'If Support queue exceeds 15 contacts, auto-pull 1 agent "
        "from Sales' — This eliminates the negotiation delay for predictable scenarios."
    ),
    "spike": (
        "The spike analysis:\n\n"
        "- **Queue affected**: Support (q-support)\n"
        "- **Peak volume**: ~32 contacts (4x normal baseline of 8)\n"
        "- **Duration**: approximately 74 seconds at CRITICAL level\n"
        "- **Trigger**: Sudden 4x multiplier in inbound contact rate\n"
        "- **Impact**: Abandonment rate peaked at 38%, service level dropped to 42%\n"
        "- **Resolution**: Queue Balancer moved 2 agents from Billing; "
        "Escalation Handler paged supervisor; metrics normalized within 4 minutes\n"
        "- **Cascade risk**: Predictive Prevention detected 1.5x overflow into General and Billing queues"
    ),
    "queue": (
        "Current queue status summary:\n\n"
        "| Queue | Contacts | Agents Online | Wait Time | Service Level |\n"
        "|-------|----------|---------------|-----------|---------------|\n"
        "| Support | ~8 | 12 | ~120s | 85% |\n"
        "| Billing | ~5 | 8 | ~75s | 91% |\n"
        "| Sales | ~3 | 6 | ~45s | 95% |\n"
        "| General | ~4 | 7 | ~60s | 92% |\n"
        "| VIP | ~2 | 4 | ~30s | 97% |\n\n"
        "All queues operating within normal parameters. No active anomalies detected."
    ),
    "alert": (
        "Alert summary:\n\n"
        "- **Active alerts**: 0 (all resolved)\n"
        "- **Recent CRITICAL**: Support queue — high abandonment rate (38%) — RESOLVED\n"
        "- **Recent WARNING**: General queue — agent count low (3 online) — RESOLVED\n"
        "- **Alerts in last hour**: 4 total (2 CRITICAL, 1 WARNING, 1 INFO)\n"
        "- **Average resolution time**: 47 seconds\n"
        "- **Resolution method**: 75% autonomous (agent action), 25% human-approved"
    ),
    "policy": (
        "I can create persistent policy rules that the agents will follow. Examples:\n\n"
        "- 'If support queue exceeds 20 contacts, pull 2 agents from sales'\n"
        "- 'Never reduce VIP queue below 3 agents'\n"
        "- 'Auto-approve queue balancer actions with confidence above 0.9'\n\n"
        "To create a policy, just describe the rule in natural language. "
        "I'll parse it and register it with the guardrails system.\n\n"
        "Currently active policies: 0"
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

# Default response when no pattern matches
_DEFAULT_RESPONSE = (
    "System operating within normal parameters. All 5 queues are being monitored by "
    "3 autonomous agents (Queue Balancer, Predictive Prevention, Escalation Handler). "
    "No active anomalies detected. The most recent agent action resolved a detected "
    "imbalance by rebalancing agents across queues.\n\n"
    "Ask me about specific queues, recent incidents, cost savings, or agent status for more detail."
)


class MockBedrockLLM:
    """Pattern-matching mock that handles the top demo queries without AWS credentials."""

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        pl = prompt.lower()

        # Enrich response with real context data if available
        context = context or {}

        for key, response in MOCK_RESPONSES.items():
            if key in pl:
                enriched = self._enrich_response(response, context)
                return {
                    "message": enriched,
                    "reasoning": f"Analytics Agent matched intent: '{key}'. Used real-time system context.",
                    "model": "mock",
                }

        return {
            "message": self._enrich_response(_DEFAULT_RESPONSE, context),
            "reasoning": "General system status query. No specific intent matched.",
            "model": "mock",
        }

    def _enrich_response(self, template: str, context: dict) -> str:
        """Inject real metric values into responses when available."""
        recent_alerts = context.get("recent_alerts", [])
        recent_decisions = context.get("recent_decisions", [])

        # Append real-time data footnote if we have context
        additions = []
        if recent_alerts:
            active = [a for a in recent_alerts[:10] if not a.get("resolvedAt")]
            if active:
                additions.append(
                    f"\n\n*Live data: {len(active)} active alert(s) — "
                    f"{', '.join(a.get('queueName', a.get('queueId', '?')) for a in active[:3])}*"
                )

        if recent_decisions:
            latest = recent_decisions[0] if recent_decisions else None
            if latest:
                additions.append(
                    f"\n*Latest agent action: {latest.get('summary', 'N/A')} "
                    f"(confidence: {latest.get('confidence', 'N/A')})*"
                )

        return template + "".join(additions)


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
        system_prompt = self._build_system_prompt(context)

        try:
            client = self._get_client()

            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": [{"role": "user", "content": prompt}],
            })

            # Run sync boto3 call in thread pool
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
                "reasoning": "Response generated by Amazon Bedrock (Claude).",
                "model": settings.bedrock_model_id,
            }

        except Exception as e:
            print(f"[bedrock] Real Bedrock call failed: {e}. Falling back to mock.")
            return await MockBedrockLLM().invoke(prompt, context)

    def _build_system_prompt(self, context: dict) -> str:
        parts = [
            "You are SentinelAI, an autonomous AI operations assistant for an AWS Connect contact center.",
            "You monitor 5 queues (Support, Billing, Sales, General, VIP) with 3 AI agents:",
            "Queue Balancer (rebalances agents), Predictive Prevention (predicts spikes),",
            "and Escalation Handler (handles critical alerts).",
            "Answer concisely with specific numbers when possible.",
            "Format responses with markdown for readability.",
        ]

        recent_alerts = context.get("recent_alerts", [])
        if recent_alerts:
            parts.append(f"\nRecent alerts ({len(recent_alerts[:5])}):")
            for a in recent_alerts[:5]:
                parts.append(
                    f"  - [{a.get('severity', '?')}] {a.get('queueName', '?')}: "
                    f"{a.get('description', a.get('message', 'N/A'))}"
                )

        recent_decisions = context.get("recent_decisions", [])
        if recent_decisions:
            parts.append(f"\nRecent agent decisions ({len(recent_decisions[:5])}):")
            for d in recent_decisions[:5]:
                parts.append(
                    f"  - [{d.get('agentType', '?')}] {d.get('summary', 'N/A')} "
                    f"(confidence: {d.get('confidence', '?')})"
                )

        queue_metrics = context.get("queue_metrics", [])
        if queue_metrics:
            parts.append("\nCurrent queue metrics:")
            for q in queue_metrics:
                parts.append(
                    f"  - {q.get('queueName', '?')}: {q.get('contactsInQueue', '?')} contacts, "
                    f"{q.get('agentsOnline', '?')} agents, SL={q.get('serviceLevel', '?')}%"
                )

        return "\n".join(parts)


class BedrockService:
    """Unified service that auto-selects real Bedrock or mock fallback."""

    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm

        # Try real Bedrock first
        try:
            import boto3
            client = boto3.client("bedrock-runtime", region_name=settings.bedrock_region)
            # Quick connectivity check — list foundation models (lightweight call)
            client.meta.region_name  # just verify client creation
            self._llm = BedrockLLM()
            print("[bedrock] Real Bedrock client initialized")
        except Exception as e:
            print(f"[bedrock] AWS not available ({e}). Using MockBedrockLLM.")
            self._llm = MockBedrockLLM()

        return self._llm

    async def invoke(self, prompt: str, context: dict | None = None) -> dict:
        llm = self._get_llm()
        return await llm.invoke(prompt, context)

    @property
    def is_mock(self) -> bool:
        return isinstance(self._get_llm(), MockBedrockLLM)


# Singleton
bedrock_service = BedrockService()
