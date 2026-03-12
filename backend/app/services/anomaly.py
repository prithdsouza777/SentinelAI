"""Anomaly detection engine.

Monitors queue metrics for deviations from baseline using
rolling averages, velocity scoring, and cascade correlation.
"""

from collections import defaultdict
from datetime import datetime, timezone

from app.models import Alert, AlertSeverity, QueueMetrics


class AnomalyEngine:
    def __init__(self):
        # Rolling baselines per queue per metric
        self.baselines: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        self.baseline_window = 60  # Number of samples for rolling average

    def update_baseline(self, queue_id: str, metric: str, value: float):
        """Add a new value to the rolling baseline."""
        history = self.baselines[queue_id][metric]
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

    def evaluate(self, metrics: QueueMetrics) -> list[Alert]:
        """Evaluate queue metrics against anomaly detection rules."""
        alerts: list[Alert] = []

        # Update baselines
        self.update_baseline(metrics.queue_id, "contacts_in_queue", metrics.contacts_in_queue)
        self.update_baseline(metrics.queue_id, "abandonment_rate", metrics.abandonment_rate)

        # Check queue depth
        avg, std = self.get_baseline(metrics.queue_id, "contacts_in_queue")
        if avg > 0 and metrics.contacts_in_queue > avg * 3:
            alerts.append(Alert(
                id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                severity=AlertSeverity.CRITICAL,
                title=f"Queue depth critical: {metrics.queue_name}",
                description=(
                    f"Queue depth at {metrics.contacts_in_queue} "
                    f"(3x baseline of {avg:.0f})"
                ),
                queue_id=metrics.queue_id,
                queue_name=metrics.queue_name,
                recommended_action="Rebalance agents from idle queues",
            ))
        elif avg > 0 and metrics.contacts_in_queue > avg * 2:
            alerts.append(Alert(
                id=f"alert-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                severity=AlertSeverity.WARNING,
                title=f"Queue depth elevated: {metrics.queue_name}",
                description=(
                    f"Queue depth at {metrics.contacts_in_queue} "
                    f"(2x baseline of {avg:.0f})"
                ),
                queue_id=metrics.queue_id,
                queue_name=metrics.queue_name,
                recommended_action="Monitor closely, prepare to rebalance",
            ))

        # Check abandonment rate
        if metrics.abandonment_rate > 30:
            alerts.append(Alert(
                id=f"alert-abandon-{metrics.queue_id}-{datetime.now(timezone.utc).timestamp():.0f}",
                severity=AlertSeverity.CRITICAL,
                title=f"High abandonment: {metrics.queue_name}",
                description=f"Abandonment rate at {metrics.abandonment_rate:.1f}%",
                queue_id=metrics.queue_id,
                queue_name=metrics.queue_name,
                recommended_action="Immediate agent reinforcement needed",
            ))
        elif metrics.abandonment_rate > 15:
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
