import { Users, PhoneIncoming, Clock } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

export default function MetricsSidebar() {
  const queues = useDashboardStore((s) => s.queues);

  const totals = queues.reduce(
    (acc, q) => ({
      contactsInQueue: acc.contactsInQueue + q.contactsInQueue,
      agentsOnline: acc.agentsOnline + q.agentsOnline,
      agentsAvailable: acc.agentsAvailable + q.agentsAvailable,
      avgWaitTime:
        acc.avgWaitTime + q.avgWaitTime / Math.max(queues.length, 1),
    }),
    { contactsInQueue: 0, agentsOnline: 0, agentsAvailable: 0, avgWaitTime: 0 }
  );

  const metrics = [
    {
      icon: PhoneIncoming,
      label: "In Queue",
      value: totals.contactsInQueue,
      color: "text-blue-400",
    },
    {
      icon: Users,
      label: "Agents Online",
      value: totals.agentsOnline,
      color: "text-green-400",
    },
    {
      icon: Users,
      label: "Available",
      value: totals.agentsAvailable,
      color: "text-emerald-400",
    },
    {
      icon: Clock,
      label: "Avg Wait",
      value: `${Math.round(totals.avgWaitTime)}s`,
      color: "text-yellow-400",
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Queue Metrics</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-center gap-2 rounded-lg bg-surface p-2"
          >
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <div>
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-sm font-semibold">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {queues.length > 0 && (
        <div className="mt-3 space-y-2">
          {queues.map((q) => (
            <div
              key={q.queueId}
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs"
            >
              <span className="font-medium text-gray-300">{q.queueName}</span>
              <div className="flex gap-3 text-gray-500">
                <span>{q.contactsInQueue} waiting</span>
                <span>{q.agentsAvailable} avail</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
