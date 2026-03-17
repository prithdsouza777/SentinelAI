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
    <div className="rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anomaly Timeline</span>
        </div>
        {timelineEvents.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {timelineEvents.length} events
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto p-3">
        {timelineEvents.length === 0 ? (
          <div className="flex w-full items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-white/10" />
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
                  ? "border-red-500/15 bg-red-500/5"
                  : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              <div className="flex items-center gap-1.5">
                {event.type === "alert" ? (
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                ) : (
                  <BrainCircuit className="h-3 w-3 text-purple-400" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <span className="mt-1 text-[11px] font-medium text-foreground">
                {event.label}
              </span>
              <span className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {event.detail}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
