import { AlertTriangle, CheckCircle, Info, XCircle, Filter } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useDashboardStore } from "../stores/dashboardStore";
import { alertsApi } from "../services/api";
import type { AlertSeverity } from "../types";

const severityConfig: Record<
  AlertSeverity,
  { icon: typeof Info; color: string; bg: string }
> = {
  info: { icon: Info, color: "text-accent-info", bg: "bg-accent-info/10" },
  warning: {
    icon: AlertTriangle,
    color: "text-accent-warning",
    bg: "bg-accent-warning/10",
  },
  critical: {
    icon: XCircle,
    color: "text-accent-danger",
    bg: "bg-accent-danger/10",
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
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alerts</h2>
          <p className="text-sm text-gray-500">
            {activeCount} active alert{activeCount !== 1 ? "s" : ""} — {alerts.length} total
          </p>
        </div>
        <Filter className="h-4 w-4 text-gray-500" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "active", "resolved"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              filter === f
                ? "bg-brand-600/15 text-brand-400"
                : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            )}
          >
            {f}
          </button>
        ))}
        <div className="mx-2 w-px bg-gray-800" />
        {(["all", "info", "warning", "critical"] as (AlertSeverity | "all")[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                severityFilter === s
                  ? "bg-brand-600/15 text-brand-400"
                  : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              )}
            >
              {s}
            </button>
          )
        )}
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle className="h-8 w-8 text-accent-success" />
            <p className="text-sm text-gray-400">
              {alerts.length === 0
                ? "No alerts yet. The anomaly engine will detect issues automatically."
                : "No alerts match your filters."}
            </p>
          </div>
        ) : (
          filtered.map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={clsx(
                  "card flex gap-4",
                  alert.resolvedAt && "opacity-50"
                )}
              >
                <div
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    config.bg
                  )}
                >
                  <Icon className={clsx("h-5 w-5", config.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-gray-200">{alert.title}</h3>
                    <span className="shrink-0 text-xs text-gray-600">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {alert.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-gray-500">
                      Queue: <span className="text-gray-300">{alert.queueName}</span>
                    </span>
                    {alert.anomalyVelocity != null && (
                      <span className="text-gray-500">
                        Velocity:{" "}
                        <span className="text-gray-300">
                          {alert.anomalyVelocity.toFixed(1)}
                        </span>
                      </span>
                    )}
                    {alert.resolvedAt ? (
                      <span className="badge badge-success">Resolved</span>
                    ) : (
                      <span className={clsx("badge", `badge-${alert.severity === "critical" ? "danger" : alert.severity}`)}>
                        {alert.severity}
                      </span>
                    )}
                  </div>
                  {alert.recommendedAction && (
                    <div className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-gray-400">
                      <span className="font-medium text-gray-300">
                        Recommended:
                      </span>{" "}
                      {alert.recommendedAction}
                    </div>
                  )}
                  {!alert.resolvedAt && (
                    <button
                      onClick={async () => {
                        try {
                          await alertsApi.acknowledge(alert.id);
                          useDashboardStore.getState().resolveAlert(alert.id);
                        } catch { /* ignore */ }
                      }}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent-success/15 px-3 py-1.5 text-xs font-medium text-accent-success transition-colors hover:bg-accent-success/25"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
