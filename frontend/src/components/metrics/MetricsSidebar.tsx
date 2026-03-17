import { Users, PhoneIncoming, Clock, Radio } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/ui/spotlight-card";

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
    { icon: PhoneIncoming, label: "In Queue", value: totals.contactsInQueue, color: "text-blue-400", spotlightColor: "rgba(59, 130, 246, 0.06)" },
    { icon: Users, label: "Online", value: totals.agentsOnline, color: "text-emerald-400", spotlightColor: "rgba(34, 197, 94, 0.06)" },
    { icon: Users, label: "Available", value: totals.agentsAvailable, color: "text-cyan-400", spotlightColor: "rgba(6, 182, 212, 0.06)" },
    { icon: Clock, label: "Avg Wait", value: `${Math.round(totals.avgWaitTime)}s`, color: "text-amber-400", spotlightColor: "rgba(245, 158, 11, 0.06)" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <Radio className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Queue Metrics</span>
      </div>

      {queues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Radio className="h-5 w-5 text-white/10" />
          <p className="text-xs text-muted-foreground">Start a simulation to see live metrics</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <SpotlightCard key={m.label} spotlightColor={m.spotlightColor} className="p-2.5">
                <div className="flex items-center gap-2">
                  <m.icon className={cn("h-4 w-4", m.color)} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-bold tabular-nums">{m.value}</p>
                  </div>
                </div>
              </SpotlightCard>
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
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]",
                    status === "critical"
                      ? "border-red-500/20 bg-red-500/5"
                      : status === "warning"
                        ? "border-amber-500/15 bg-amber-500/5"
                        : "border-white/[0.06] bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      status === "critical" ? "bg-red-400 animate-pulse" :
                      status === "warning" ? "bg-amber-400" : "bg-emerald-400"
                    )} />
                    <span className="font-medium text-foreground">{q.queueName}</span>
                  </div>
                  <div className="flex gap-3 text-muted-foreground">
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
