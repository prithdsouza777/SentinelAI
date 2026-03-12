"""Simulation engine for generating realistic contact center data.

Generates queue metrics, agent events, and scenario-driven data
that flows through the same pipeline as real Connect data.
"""

import asyncio
import math
import random
from datetime import datetime, timezone

from app.models import QueueMetrics

# Default simulated queues
SIMULATED_QUEUES = [
    {"id": "q-support", "name": "Support", "base_load": 8, "agents": 12},
    {"id": "q-billing", "name": "Billing", "base_load": 5, "agents": 8},
    {"id": "q-sales", "name": "Sales", "base_load": 3, "agents": 6},
    {"id": "q-general", "name": "General", "base_load": 4, "agents": 7},
    {"id": "q-vip", "name": "VIP", "base_load": 2, "agents": 4},
]

# Store original agent counts for chaos reset
_ORIGINAL_AGENTS = {q["id"]: q["agents"] for q in SIMULATED_QUEUES}

# ── Scripted Demo Scenario (3 minutes @ 2s ticks = 90 ticks) ────────────────
# Each entry fires once when tick matches. "clear_*" entries undo earlier chaos.
DEMO_SCRIPT = [
    # === Act 1: The Calm (ticks 0-14, ~30s) ===
    # Normal operations, no events — agents observing

    # === Act 2: The Storm (tick 15, ~30s mark) ===
    {"tick": 15, "type": "spike_queue",   "params": {"queue_id": "q-support", "multiplier": 4.0}},
    {"tick": 15, "type": "kill_agents",   "params": {"queue_id": "q-general", "agents_count": 4}},

    # === Act 3: Escalation (tick 22, ~44s) — secondary pressure ===
    {"tick": 22, "type": "spike_queue",   "params": {"queue_id": "q-billing", "multiplier": 2.0}},

    # === Act 4: Partial Resolution (tick 37, ~74s) — restore general agents ===
    {"tick": 37, "type": "restore_agents", "params": {"queue_id": "q-general"}},

    # === Act 5: Stabilization (tick 45, ~90s) — clear billing spike ===
    {"tick": 45, "type": "clear_spike",   "params": {"queue_id": "q-billing"}},

    # === Act 6: Full Resolution (tick 52, ~104s) — clear support spike ===
    {"tick": 52, "type": "clear_spike",   "params": {"queue_id": "q-support"}},

    # === Act 7: The Intelligence (ticks 60+, ~120s+) ===
    # Metrics normalize. User asks "What just happened?" in chat.
    # No scripted events — calm operations for the final 60s of demo.
]


class SimulationEngine:
    def __init__(self):
        self.running = False
        self.scenario: str | None = None
        self.tick = 0
        self._task: asyncio.Task | None = None
        self._chaos_events: list[dict] = []

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
                print(f"[demo] tick {self.tick}: injecting {entry['type']} {entry.get('params', {})}")
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
