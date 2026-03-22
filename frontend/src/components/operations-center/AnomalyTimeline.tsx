import { Clock, BrainCircuit, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { motion } from "framer-motion";

export default function AnomalyTimeline() {
  const decisions = useDashboardStore((s) => s.decisions);
  const alerts = useDashboardStore((s) => s.alerts);

  const timelineEvents = [
    ...decisions.slice(0, 10).map((d) => ({
      id: d.id,
      type: "decision" as const,
      label: `${d.agentType.replace("_", " ")} - ${d.phase}`,
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
    <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Clock className="h-5 w-5 text-[#06b6d4]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">Anomaly Timeline</span>
        </div>
        {timelineEvents.length > 0 && (
          <span className="text-xs font-medium tabular-nums text-[#94a3b8]">
            {timelineEvents.length} events
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto p-4">
        {timelineEvents.length === 0 ? (
          <div className="flex w-full items-center justify-center gap-2 py-4 text-sm text-[#94a3b8]">
            <Clock className="h-5 w-5 text-[#e2e8f0]" />
            <span>Timeline will populate when agents detect anomalies</span>
          </div>
        ) : (
          timelineEvents.slice(0, 12).map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "flex min-w-[170px] shrink-0 flex-col rounded-xl border p-3",
                event.type === "alert"
                  ? "border-[#ef4444]/15 bg-[#ef4444]/5"
                  : "border-[#e2e8f0] bg-[#f8fafc]"
              )}
            >
              <div className="flex items-center gap-1.5">
                {event.type === "alert" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#ef4444]" />
                ) : (
                  <BrainCircuit className="h-3.5 w-3.5 text-[#8b5cf6]" />
                )}
                <span className="text-[11px] tabular-nums text-[#94a3b8]">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <span className="mt-1.5 text-xs font-bold text-[#1e293b]">
                {event.label}
              </span>
              <span className="mt-1 truncate text-[11px] text-[#64748b]">
                {event.detail}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
