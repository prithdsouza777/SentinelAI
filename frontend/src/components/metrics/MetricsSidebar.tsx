import { Users, PhoneIncoming, Clock, Radio } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";

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
    { icon: PhoneIncoming, label: "In Queue", value: totals.contactsInQueue, color: "text-[#2563eb]", bg: "bg-[#2563eb]/10" },
    { icon: Users, label: "Online", value: totals.agentsOnline, color: "text-[#10b981]", bg: "bg-[#10b981]/10" },
    { icon: Users, label: "Available", value: totals.agentsAvailable, color: "text-[#06b6d4]", bg: "bg-[#06b6d4]/10" },
    { icon: Clock, label: "Avg Wait", value: `${Math.round(totals.avgWaitTime)}s`, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10" },
  ];

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="h-5 w-5 text-[#2563eb]" />
        <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">Queue Metrics</span>
      </div>

      {queues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Radio className="h-6 w-6 text-[#e2e8f0]" />
          <p className="text-sm text-[#94a3b8]">Start a simulation to see live metrics</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", m.bg)}>
                  <m.icon className={cn("h-5 w-5", m.color)} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#94a3b8]">{m.label}</p>
                  <p className="text-lg font-bold tabular-nums text-[#1e293b]">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Compact queue list — single tight table */}
          <div className="mt-4 overflow-hidden rounded-xl border border-[#e2e8f0]">
            {queues.map((q, i) => {
              const pressure = q.contactsInQueue / Math.max(q.agentsAvailable, 1);
              const status = pressure > 4 ? "critical" : pressure > 2 ? "warning" : "normal";
              return (
                <div
                  key={q.queueId}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2 text-[13px]",
                    i !== queues.length - 1 && "border-b border-[#e2e8f0]",
                    status === "critical" ? "bg-[#ef4444]/5" :
                    status === "warning" ? "bg-[#f59e0b]/5" : "bg-white"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-2 w-2 rounded-full",
                      status === "critical" ? "bg-[#ef4444] animate-pulse" :
                      status === "warning" ? "bg-[#f59e0b]" : "bg-[#10b981]"
                    )} />
                    <span className="font-semibold text-[#1e293b]">{q.queueName}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-[#64748b]">
                    <span className="tabular-nums">{q.contactsInQueue} waiting</span>
                    <span className="tabular-nums">{q.agentsAvailable} avail</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
