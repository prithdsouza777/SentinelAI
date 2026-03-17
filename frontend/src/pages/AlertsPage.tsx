import { AlertTriangle, CheckCircle2, Info, XCircle, Shield } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../stores/dashboardStore";
import { alertsApi } from "../services/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { AlertSeverity } from "../types";

const severityConfig: Record<
  AlertSeverity,
  { icon: typeof Info; color: string; border: string; bg: string }
> = {
  info: {
    icon: Info,
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/10",
  },
  critical: {
    icon: XCircle,
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/10",
  },
};

type FilterType = "all" | "active" | "resolved";

export default function AlertsPage() {
  const alerts = useDashboardStore((s) => s.alerts);
  const [filter, setFilter] = useState<FilterType>("all");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");

  const filtered = alerts.filter((a) => {
    if (filter === "active" && a.resolvedAt) return false;
    if (filter === "resolved" && !a.resolvedAt) return false;
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.resolvedAt).length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alerts</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount > 0 && (
              <span className="mr-1 inline-flex items-center gap-1 text-red-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                {activeCount} active
              </span>
            )}
            {alerts.length} total alerts
          </p>
        </div>
        <Shield className="h-5 w-5 text-muted-foreground/40" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "resolved"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all",
              filter === f
                ? "bg-white/10 text-white shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-white/[0.08]" />
        {(["all", "info", "warning", "critical"] as (AlertSeverity | "all")[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all",
              severityFilter === s
                ? "bg-white/10 text-white shadow-sm"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-2">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-card/50 py-16 text-center backdrop-blur-sm"
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-400/40" />
              <p className="text-sm text-muted-foreground">
                {alerts.length === 0
                  ? "No alerts yet. The anomaly engine will detect issues automatically."
                  : "No alerts match your filters."}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((alert, i) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "flex gap-4 rounded-xl border bg-card/50 p-4 backdrop-blur-sm transition-all",
                      alert.resolvedAt
                        ? "border-white/[0.04] opacity-50"
                        : config.border,
                      !alert.resolvedAt && alert.severity === "critical" && "animate-critical-flash"
                    )}
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-foreground">{alert.title}</h3>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                        {alert.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="text-muted-foreground/70">
                          Queue: <span className="text-foreground/80">{alert.queueName}</span>
                        </span>
                        {alert.anomalyVelocity != null && (
                          <span className="text-muted-foreground/70">
                            Velocity:{" "}
                            <span className="tabular-nums text-foreground/80">
                              {alert.anomalyVelocity.toFixed(1)}
                            </span>
                          </span>
                        )}
                        {alert.resolvedAt ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Resolved
                          </span>
                        ) : (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                            alert.severity === "critical"
                              ? "bg-red-500/10 text-red-400"
                              : alert.severity === "warning"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-blue-500/10 text-blue-400"
                          )}>
                            {alert.severity}
                          </span>
                        )}
                      </div>
                      {alert.recommendedAction && (
                        <div className="mt-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">Recommended:</span>{" "}
                          {alert.recommendedAction}
                        </div>
                      )}
                      {!alert.resolvedAt && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await alertsApi.acknowledge(alert.id);
                              useDashboardStore.getState().resolveAlert(alert.id);
                            } catch { /* ignore */ }
                          }}
                          className="mt-2 h-7 bg-emerald-600/20 text-[11px] font-medium text-emerald-400 hover:bg-emerald-600/30"
                        >
                          <CheckCircle2 className="mr-1.5 h-3 w-3" />
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
