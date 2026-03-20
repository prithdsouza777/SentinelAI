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
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#06b6d4]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Anomaly Timeline</span>
        </div>
        {timelineEvents.length > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-[#94a3b8]">
            {timelineEvents.length} events
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto p-3">
        {timelineEvents.length === 0 ? (
          <div className="flex w-full items-center justify-center gap-2 py-3 text-sm text-[#94a3b8]">
            <Clock className="h-4 w-4 text-[#e2e8f0]" />
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
                "flex min-w-[150px] shrink-0 flex-col rounded-lg border p-2.5",
                event.type === "alert"
                  ? "border-[#ef4444]/15 bg-[#ef4444]/5"
                  : "border-[#e2e8f0] bg-[#f8fafc]"
              )}
            >
              <div className="flex items-center gap-1.5">
                {event.type === "alert" ? (
                  <AlertTriangle className="h-3 w-3 text-[#ef4444]" />
                ) : (
                  <BrainCircuit className="h-3 w-3 text-[#8b5cf6]" />
                )}
                <span className="text-[10px] tabular-nums text-[#94a3b8]">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <span className="mt-1 text-[11px] font-semibold text-[#1e293b]">
                {event.label}
              </span>
              <span className="mt-0.5 truncate text-[10px] text-[#64748b]">
                {event.detail}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
