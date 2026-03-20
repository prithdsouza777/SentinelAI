"""Simulation engine for generating realistic contact center data.

Generates queue metrics, agent events, and scenario-driven data
that flows through the same pipeline as real Connect data.
"""

import asyncio
import logging
import math
import random
from datetime import datetime, timezone

from app.models import QueueMetrics

logger = logging.getLogger("sentinelai.simulation")

# Default simulated queues — enriched with skill requirements
SIMULATED_QUEUES = [
    {"id": "q-support", "name": "Support", "base_load": 8, "agents": 12,
     "skills": ["troubleshooting", "product_knowledge", "technical"]},
    {"id": "q-billing", "name": "Billing", "base_load": 5, "agents": 8,
     "skills": ["billing", "payments", "account_management"]},
    {"id": "q-sales", "name": "Sales", "base_load": 3, "agents": 6,
     "skills": ["sales", "product_knowledge", "upselling"]},
    {"id": "q-general", "name": "General", "base_load": 4, "agents": 7,
     "skills": ["general_inquiry", "product_knowledge"]},
    {"id": "q-vip", "name": "VIP", "base_load": 2, "agents": 4,
     "skills": ["vip_handling", "escalation", "retention"]},
]

# Simulated human agents with skill profiles and performance history
SIMULATED_AGENTS = [
    {"id": "agent-01", "name": "Alice", "queue_id": "q-support", "skills": ["troubleshooting", "technical", "escalation"], "experience": "senior", "perf_score": 0.95},
    {"id": "agent-02", "name": "Bob", "queue_id": "q-support", "skills": ["troubleshooting", "product_knowledge"], "experience": "mid", "perf_score": 0.82},
    {"id": "agent-03", "name": "Carol", "queue_id": "q-support", "skills": ["troubleshooting", "general_inquiry"], "experience": "junior", "perf_score": 0.74},
    {"id": "agent-04", "name": "Dave", "queue_id": "q-billing", "skills": ["billing", "payments", "account_management"], "experience": "senior", "perf_score": 0.91},
    {"id": "agent-05", "name": "Eve", "queue_id": "q-billing", "skills": ["billing", "payments"], "experience": "mid", "perf_score": 0.85},
    {"id": "agent-06", "name": "Frank", "queue_id": "q-sales", "skills": ["sales", "upselling", "product_knowledge"], "experience": "senior", "perf_score": 0.93},
    {"id": "agent-07", "name": "Grace", "queue_id": "q-sales", "skills": ["sales", "product_knowledge"], "experience": "mid", "perf_score": 0.79},
    {"id": "agent-08", "name": "Hank", "queue_id": "q-general", "skills": ["general_inquiry", "product_knowledge", "troubleshooting"], "experience": "mid", "perf_score": 0.80},
    {"id": "agent-09", "name": "Iris", "queue_id": "q-general", "skills": ["general_inquiry", "billing"], "experience": "junior", "perf_score": 0.72},
    {"id": "agent-10", "name": "Jack", "queue_id": "q-vip", "skills": ["vip_handling", "escalation", "retention", "sales"], "experience": "senior", "perf_score": 0.97},
    {"id": "agent-11", "name": "Kim", "queue_id": "q-vip", "skills": ["vip_handling", "retention"], "experience": "senior", "perf_score": 0.90},
    {"id": "agent-12", "name": "Leo", "queue_id": "q-support", "skills": ["technical", "troubleshooting", "product_knowledge"], "experience": "senior", "perf_score": 0.88},
]

# Contact types with required skills (for skill-based routing)
CONTACT_TYPES = [
    {"type": "technical_issue", "required_skills": ["troubleshooting", "technical"], "priority": "normal"},
    {"type": "billing_dispute", "required_skills": ["billing", "payments"], "priority": "normal"},
    {"type": "sales_inquiry", "required_skills": ["sales", "product_knowledge"], "priority": "normal"},
    {"type": "account_upgrade", "required_skills": ["sales", "upselling"], "priority": "normal"},
    {"type": "vip_complaint", "required_skills": ["vip_handling", "escalation"], "priority": "high"},
    {"type": "general_question", "required_skills": ["general_inquiry"], "priority": "low"},
    {"type": "retention_call", "required_skills": ["retention", "sales"], "priority": "high"},
    {"type": "payment_issue", "required_skills": ["billing", "account_management"], "priority": "normal"},
]

# Store original agent counts for chaos reset
_ORIGINAL_AGENTS = {q["id"]: q["agents"] for q in SIMULATED_QUEUES}

# ── Scripted Demo Scenario (3 minutes @ 2s ticks = 90 ticks) ────────────────
# Each entry fires once when tick matches. "clear_*" entries undo earlier chaos.
DEMO_SCRIPT = [
    # === Act 1: The Calm (ticks 0-14, ~30s) ===
    # Normal operations, no events — agents observing, cost at $0, green across the board

    # === Act 2: The Storm (tick 15, ~30s mark) ===
    # Support queue gets slammed + General loses agents — dual-point failure
    {"tick": 15, "type": "spike_queue",   "params": {"queue_id": "q-support", "multiplier": 4.0}},
    {"tick": 15, "type": "kill_agents",   "params": {"queue_id": "q-general", "agents_count": 4}},

    # === Act 3: The Cascade (tick 20, ~40s) — pressure spreads ===
    # Support overflow spills into Billing — triggers multiple agents simultaneously
    {"tick": 20, "type": "spike_queue",   "params": {"queue_id": "q-billing", "multiplier": 2.5}},
    # VIP starts feeling pressure too (smaller spike, triggers Predictive Prevention)
    {"tick": 23, "type": "spike_queue",   "params": {"queue_id": "q-vip", "multiplier": 2.0}},

    # === Act 4: The Negotiation (tick 26, ~52s) ===
    # Queue Balancer wants to pull from Sales -> Support
    # Escalation Handler wants to pull from Sales -> Billing
    # Both target Sales as donor — CONFLICT triggers negotiation protocol
    # (This happens naturally because both agents will fire on the same tick)

    # === Act 5: Partial Resolution (tick 33, ~66s) — agents recovering General ===
    {"tick": 33, "type": "restore_agents", "params": {"queue_id": "q-general"}},
    {"tick": 35, "type": "clear_spike",   "params": {"queue_id": "q-vip"}},

    # === Act 6: Stabilization (tick 40, ~80s) — crisis subsiding ===
    {"tick": 40, "type": "clear_spike",   "params": {"queue_id": "q-billing"}},

    # === Act 7: Full Resolution (tick 48, ~96s) — clear the main spike ===
    {"tick": 48, "type": "clear_spike",   "params": {"queue_id": "q-support"}},

    # === Act 8: The Intelligence (ticks 55+, ~110s+) ===
    # Metrics normalize. User asks "What just happened?" in chat.
    # Cost ticker shows total savings. Governance scorecard shows decisions.
    # No scripted events — calm operations for the final ~70s of demo.
]


class SimulationEngine:
    def __init__(self):
        self.running = False
        self.scenario: str | None = None
        self.tick = 0
        self._task: asyncio.Task | None = None
        self._chaos_events: list[dict] = []
        self._routing_log: list[dict] = []  # skill routing decisions

    def generate_incoming_contact(self) -> dict | None:
        """Generate a random incoming contact with skill requirements. ~40% chance per tick."""
        if random.random() > 0.4:
            return None
        contact_type = random.choice(CONTACT_TYPES)
        return {
            "id": f"contact-{self.tick}-{random.randint(100,999)}",
            "type": contact_type["type"],
            "required_skills": contact_type["required_skills"],
            "priority": contact_type["priority"],
        }

    def get_available_agents(self) -> list[dict]:
        """Return agents not currently at capacity (simplified availability check)."""
        available = []
        for agent in SIMULATED_AGENTS:
            q = next((q for q in SIMULATED_QUEUES if q["id"] == agent["queue_id"]), None)
            if q and q["agents"] > 0:
                available.append(agent)
        return available

    def log_routing(self, contact_id: str, agent_id: str, score: float, reasoning: str):
        """Log a skill-based routing decision."""
        self._routing_log.append({
            "contactId": contact_id,
            "agentId": agent_id,
            "score": round(score, 3),
            "reasoning": reasoning,
            "tick": self.tick,
        })
        if len(self._routing_log) > 100:
            self._routing_log.pop(0)

    def generate_metrics(self) -> list[QueueMetrics]:
        """Generate a snapshot of queue metrics with natural variation, applying any active chaos."""
        # Apply scripted demo events for the current tick
        if self.scenario == "sentinelai_demo":
            self._apply_demo_script()

        now = datetime.now(timezone.utc)
        metrics = []

        for queue in SIMULATED_QUEUES:
            # Natural time-based variation (sine wave)
            time_factor = math.sin(self.tick * 0.1) * 0.3 + 1.0
            noise = random.gauss(0, 0.15)

            contacts = max(0, int(queue["base_load"] * time_factor + noise * queue["base_load"]))
            agents_online = queue["agents"]
            agents_available = max(0, agents_online - contacts // 2)
            avg_wait = max(0, contacts * 15 + random.gauss(0, 10))
            avg_handle = 180 + random.gauss(0, 30)
            abandon_rate = max(0, min(100, (contacts / max(agents_online, 1)) * 5 + random.gauss(0, 2)))
            service_level = max(0, min(100, 95 - contacts * 2 + random.gauss(0, 3)))

            metrics.append(QueueMetrics(
                queue_id=queue["id"],
                queue_name=queue["name"],
                contacts_in_queue=contacts,
                oldest_contact_age=avg_wait * 1.5,
                agents_online=agents_online,
                agents_available=agents_available,
                avg_wait_time=avg_wait,
                avg_handle_time=avg_handle,
                abandonment_rate=abandon_rate,
                service_level=service_level,
                contacts_handled=random.randint(20, 60),
                timestamp=now,
            ))

        # Apply chaos events to the generated metrics (chaos persists across ticks)
        for event in self._chaos_events:
            etype = event["type"]
            params = event.get("params", {})

            if etype == "spike_queue":
                queue_id = params.get("queue_id")
                multiplier = float(params.get("multiplier", 4.0))
                for m in metrics:
                    if m.queue_id == queue_id:
                        m.contacts_in_queue = int(m.contacts_in_queue * multiplier)
                        m.abandonment_rate = min(100, m.abandonment_rate * 1.5)
                        m.service_level = max(0, m.service_level * 0.5)
                        m.agents_available = max(0, m.agents_available - m.contacts_in_queue // 3)
                        m.avg_wait_time = m.avg_wait_time * multiplier

            elif etype == "kill_agents":
                queue_id = params.get("queue_id")
                agents_count = int(params.get("agents_count", 3))
                for m in metrics:
                    if m.queue_id == queue_id:
                        m.agents_online = max(1, m.agents_online - agents_count)
                        m.agents_available = max(0, m.agents_available - agents_count)

            elif etype == "restore_agents":
                queue_id = params.get("queue_id")
                original = _ORIGINAL_AGENTS.get(queue_id)
                if original is not None:
                    for m in metrics:
                        if m.queue_id == queue_id:
                            m.agents_online = original
                            m.agents_available = max(0, original - m.contacts_in_queue // 2)

            elif etype == "cascade_failure":
                source_queue = params.get("source_queue")
                for m in metrics:
                    if m.queue_id == source_queue:
                        m.contacts_in_queue = int(m.contacts_in_queue * 5)
                        m.abandonment_rate = min(100, m.abandonment_rate * 2.0)
                        m.service_level = max(0, m.service_level * 0.3)
                        m.avg_wait_time = m.avg_wait_time * 4
                    else:
                        m.contacts_in_queue = int(m.contacts_in_queue * 1.5)
                        m.abandonment_rate = min(100, m.abandonment_rate * 1.2)
                        m.service_level = max(0, m.service_level * 0.8)

            elif etype == "network_delay":
                delay_ms = float(params.get("delay_ms", 500))
                for m in metrics:
                    m.avg_wait_time = m.avg_wait_time + delay_ms / 1000

            # clear_spike is handled at inject time (removes matching spike_queue events)
            # so it won't appear in the loop — it's a meta-event

        self.tick += 1
        return metrics

    def inject_chaos(self, event_type: str, params: dict):
        """Inject a chaos event into the simulation."""
        if event_type == "clear_spike":
            # Remove spike_queue events for the given queue
            queue_id = params.get("queue_id")
            self._chaos_events = [
                e for e in self._chaos_events
                if not (e["type"] == "spike_queue" and e.get("params", {}).get("queue_id") == queue_id)
            ]
            return
        self._chaos_events.append({"type": event_type, "params": params})

    def adjust_queue(self, queue_id: str, agents_delta: int):
        """Adjust agent count for a queue. Called by Queue Balancer execute()."""
        for q in SIMULATED_QUEUES:
            if q["id"] == queue_id:
                q["agents"] = max(1, q["agents"] + agents_delta)
                break

    def clear_chaos(self):
        """Remove all chaos events and reset queues to original base values."""
        self._chaos_events.clear()
        for q in SIMULATED_QUEUES:
            q["agents"] = _ORIGINAL_AGENTS[q["id"]]

    def _apply_demo_script(self):
        """Check DEMO_SCRIPT for events matching the current tick and inject them."""
        for entry in DEMO_SCRIPT:
            if entry["tick"] == self.tick:
                logger.info("Demo tick %d: injecting %s %s", self.tick, entry["type"], entry.get("params", {}))
                self.inject_chaos(entry["type"], entry.get("params", {}))

    async def start(self, scenario: str = "normal"):
        """Start the simulation loop."""
        self.running = True
        self.scenario = scenario
        self.tick = 0

    async def stop(self):
        """Stop the simulation loop."""
        self.running = False
        self.scenario = None
        self.clear_chaos()
        if self._task:
            self._task.cancel()
            self._task = None


simulation_engine = SimulationEngine()
