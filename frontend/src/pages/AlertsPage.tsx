import { AlertTriangle, CheckCircle2, Info, XCircle, Shield } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../stores/dashboardStore";
import { alertsApi } from "../services/api";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { AlertSeverity } from "../types";

const severityConfig: Record<
  AlertSeverity,
  { icon: typeof Info; color: string; border: string; bg: string }
> = {
  info: {
    icon: Info,
    color: "text-[#3b82f6]",
    border: "border-[#3b82f6]/20",
    bg: "bg-[#3b82f6]/5",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-[#f59e0b]",
    border: "border-[#f59e0b]/20",
    bg: "bg-[#f59e0b]/5",
  },
  critical: {
    icon: XCircle,
    color: "text-[#ef4444]",
    border: "border-[#ef4444]/20",
    bg: "bg-[#ef4444]/5",
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1e293b]">Alerts</h2>
          <p className="text-sm text-[#64748b]">
            {activeCount > 0 && (
              <span className="mr-1 inline-flex items-center gap-1 text-[#ef4444]">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#ef4444]" />
                {activeCount} active
              </span>
            )}
            {alerts.length} total alerts
          </p>
        </div>
        <Shield className="h-5 w-5 text-[#94a3b8]" />
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
                ? "bg-[#2563eb] text-white shadow-sm"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]"
            )}
          >
            {f}
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-[#e2e8f0]" />
        {(["all", "info", "warning", "critical"] as (AlertSeverity | "all")[]).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all",
              severityFilter === s
                ? "bg-[#2563eb] text-white shadow-sm"
                : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2 pr-2">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white py-16 text-center shadow-sm"
            >
              <CheckCircle2 className="h-10 w-10 text-[#10b981]/40" />
              <p className="text-sm text-[#64748b]">
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
                      "flex gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all",
                      alert.resolvedAt
                        ? "border-[#e2e8f0] opacity-50"
                        : config.border,
                      !alert.resolvedAt && alert.severity === "critical" && "animate-critical-flash"
                    )}
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[#1e293b]">{alert.title}</h3>
                        <span className="shrink-0 text-[10px] tabular-nums text-[#94a3b8]">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-[#64748b]">
                        {alert.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                        <span className="text-[#94a3b8]">
                          Queue: <span className="font-medium text-[#475569]">{alert.queueName}</span>
                        </span>
                        {alert.anomalyVelocity != null && (
                          <span className="text-[#94a3b8]">
                            Velocity:{" "}
                            <span className="font-medium tabular-nums text-[#475569]">
                              {alert.anomalyVelocity.toFixed(1)}
                            </span>
                          </span>
                        )}
                        {alert.resolvedAt ? (
                          <span className="flex items-center gap-1 rounded-full bg-[#10b981]/10 px-2 py-0.5 text-[10px] font-semibold text-[#10b981]">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Resolved
                          </span>
                        ) : (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            alert.severity === "critical"
                              ? "bg-[#ef4444]/10 text-[#ef4444]"
                              : alert.severity === "warning"
                                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                                : "bg-[#3b82f6]/10 text-[#3b82f6]"
                          )}>
                            {alert.severity}
                          </span>
                        )}
                      </div>
                      {alert.recommendedAction && (
                        <div className="mt-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475569]">
                          <span className="font-semibold text-[#1e293b]">Recommended:</span>{" "}
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
                          className="mt-2 h-7 bg-[#10b981] text-[11px] font-semibold text-white hover:bg-[#059669]"
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
      </div>
    </div>
  );
}
