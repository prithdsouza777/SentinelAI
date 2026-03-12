import { Clock } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

export default function AnomalyTimeline() {
  const decisions = useDashboardStore((s) => s.decisions);
  const alerts = useDashboardStore((s) => s.alerts);

  // Combine decisions and alerts into a timeline
  const timelineEvents = [
    ...decisions.slice(0, 10).map((d) => ({
      id: d.id,
      type: "decision" as const,
      label: `${d.agentType.replace("_", " ")} — ${d.phase}`,
      detail: d.summary,
      timestamp: d.timestamp,
    })),
    ...alerts.slice(0, 10).map((a) => ({
      id: a.id,
      type: "alert" as const,
      label: a.title,
      detail: a.description,
      timestamp: a.timestamp,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Anomaly Timeline</span>
        <Clock className="h-4 w-4 text-gray-500" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {timelineEvents.length === 0 ? (
          <p className="text-sm text-gray-500">No events yet</p>
        ) : (
          timelineEvents.slice(0, 12).map((event) => (
            <div
              key={event.id}
              className="flex min-w-[140px] shrink-0 flex-col rounded-lg border border-gray-800 bg-surface p-2"
            >
              <span className="text-xs text-gray-600">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span className="mt-1 text-xs font-medium text-gray-300">
                {event.label}
              </span>
              <span className="mt-0.5 truncate text-xs text-gray-500">
                {event.detail}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
