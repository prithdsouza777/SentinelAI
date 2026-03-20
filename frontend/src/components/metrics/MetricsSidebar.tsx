import { Users, PhoneIncoming, Clock, Radio } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="h-4 w-4 text-[#2563eb]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Queue Metrics</span>
      </div>

      {queues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Radio className="h-5 w-5 text-[#e2e8f0]" />
          <p className="text-xs text-[#94a3b8]">Start a simulation to see live metrics</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", m.bg)}>
                  <m.icon className={cn("h-4 w-4", m.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-[#94a3b8]">{m.label}</p>
                  <p className="text-sm font-bold tabular-nums text-[#1e293b]">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5">
            {queues.map((q, i) => {
              const pressure = q.contactsInQueue / Math.max(q.agentsAvailable, 1);
              const status = pressure > 4 ? "critical" : pressure > 2 ? "warning" : "normal";
              return (
                <motion.div
                  key={q.queueId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]",
                    status === "critical"
                      ? "border-[#ef4444]/20 bg-[#ef4444]/5"
                      : status === "warning"
                        ? "border-[#f59e0b]/15 bg-[#f59e0b]/5"
                        : "border-[#e2e8f0] bg-[#f8fafc]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status === "critical" ? "bg-[#ef4444] animate-pulse" :
                      status === "warning" ? "bg-[#f59e0b]" : "bg-[#10b981]"
                    )} />
                    <span className="font-medium text-[#1e293b]">{q.queueName}</span>
                  </div>
                  <div className="flex gap-3 text-[#64748b]">
                    <span className="tabular-nums">{q.contactsInQueue} waiting</span>
                    <span className="tabular-nums">{q.agentsAvailable} avail</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
