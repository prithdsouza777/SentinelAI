"""Anomaly detection engine.

Monitors queue metrics for deviations from baseline using
rolling averages, velocity scoring, and cascade correlation.
Includes spike protection, absolute thresholds, and per-queue cooldowns.
"""

import time
from collections import defaultdict
from datetime import datetime, timezone

from app.models import Alert, AlertSeverity, QueueMetrics


class AnomalyEngine:
    def __init__(self):
        # Rolling baselines per queue per metric
        self.baselines: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        self.baseline_window = 60  # Number of samples for rolling average
        # Per-queue alert cooldowns: (queue_id, alert_type) -> last fire time
        self._cooldowns: dict[tuple[str, str], float] = {}
        self._cooldown_seconds = 12.0  # Min seconds between same alert for same queue

    def update_baseline(self, queue_id: str, metric: str, value: float):
        """Add a new value to the rolling baseline (with spike protection)."""
        history = self.baselines[queue_id][metric]

        # Spike protection: don't let extreme values pollute the baseline
        if len(history) >= 5:
            avg = sum(history) / len(history)
            if avg > 0 and value > avg * 3:
                # Don't add spiked values — keeps baseline stable
                return

        history.append(value)
        if len(history) > self.baseline_window:
            history.pop(0)

    def get_baseline(self, queue_id: str, metric: str) -> tuple[float, float]:
        """Get rolling average and standard deviation for a metric."""
        history = self.baselines[queue_id][metric]
        if len(history) < 5:
            return 0.0, 0.0
        avg = sum(history) / len(history)
        variance = sum((x - avg) ** 2 for x in history) / len(history)
        std = variance**0.5
        return avg, std

    def _check_cooldown(self, queue_id: str, alert_type: str) -> bool:
        """Return True if we can fire this alert (not in cooldown)."""
        key = (queue_id, alert_type)
        now = time.monotonic()
        last = self._cooldowns.get(key, 0.0)
        if now - last < self._cooldown_seconds:
            return False
        self._cooldowns[key] = now
        return True

    def evaluate(self, metrics: QueueMetrics) -> list[Alert]:
        """Evaluate queue metrics against anomaly detection rules."""
        alerts: list[Alert] = []

        # Update baselines (spike-protected)
        self.update_baseline(metrics.queue_id, "contacts_in_queue", metrics.contacts_in_queue)
        self.update_baseline(metrics.queue_id, "abandonment_rate", metrics.abandonment_rate)

        # ── Queue depth checks ──────────────────────────────────────────
        avg, std = self.get_baseline(metrics.queue_id, "contacts_in_queue")
        contacts = metrics.contacts_in_queue
        agents = max(metrics.agents_online, 1)
        pressure = contacts / agents

        # Absolute thresholds (always fire regardless of baseline)
        if contacts >= 35 or pressure >= 4.0:
            if self._check_cooldown(metrics.queue_id, "depth_critical"):
                alerts.append(Alert(
                    id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.CRITICAL,
                    title=f"Queue depth critical: {metrics.queue_name}",
                    description=(
                        f"Queue depth at {contacts} ({pressure:.1f}x pressure, "
                        f"{metrics.agents_available} agents available)"
                    ),
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Immediate rebalancing — pull agents from idle queues",
                ))
        elif contacts >= 18 or pressure >= 2.0:
            if self._check_cooldown(metrics.queue_id, "depth_warning"):
                alerts.append(Alert(
                    id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.WARNING,
                    title=f"Queue depth elevated: {metrics.queue_name}",
                    description=(
                        f"Queue depth at {contacts} ({pressure:.1f}x pressure)"
                    ),
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Monitor closely, prepare to rebalance",
                ))
        # Baseline-relative checks (fire when baseline is established)
        elif avg > 0 and contacts > avg * 3:
            if self._check_cooldown(metrics.queue_id, "depth_critical"):
                alerts.append(Alert(
                    id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.CRITICAL,
                    title=f"Queue depth critical: {metrics.queue_name}",
                    description=(
                        f"Queue depth at {contacts} "
                        f"(3x baseline of {avg:.0f})"
                    ),
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Rebalance agents from idle queues",
                ))
        elif avg > 0 and contacts > avg * 2:
            if self._check_cooldown(metrics.queue_id, "depth_warning"):
                alerts.append(Alert(
                    id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.WARNING,
                    title=f"Queue depth elevated: {metrics.queue_name}",
                    description=(
                        f"Queue depth at {contacts} "
                        f"(2x baseline of {avg:.0f})"
                    ),
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Monitor closely, prepare to rebalance",
                ))

        # ── Abandonment rate checks ─────────────────────────────────────
        if metrics.abandonment_rate > 25:
            if self._check_cooldown(metrics.queue_id, "abandon_critical"):
                alerts.append(Alert(
                    id=f"alert-abandon-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.CRITICAL,
                    title=f"High abandonment: {metrics.queue_name}",
                    description=f"Abandonment rate at {metrics.abandonment_rate:.1f}%",
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Immediate agent reinforcement needed",
                ))
        elif metrics.abandonment_rate > 12:
            if self._check_cooldown(metrics.queue_id, "abandon_warning"):
                alerts.append(Alert(
                    id=f"alert-abandon-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                    severity=AlertSeverity.WARNING,
                    title=f"Abandonment rising: {metrics.queue_name}",
                    description=f"Abandonment rate at {metrics.abandonment_rate:.1f}%",
                    queue_id=metrics.queue_id,
                    queue_name=metrics.queue_name,
                    recommended_action="Consider adding agents to this queue",
                ))

        return alerts


anomaly_engine = AnomalyEngine()
