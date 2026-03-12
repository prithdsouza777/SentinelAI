import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardStore } from "../../stores/dashboardStore";
import type { AlertSeverity } from "../../types";

const severityConfig: Record<AlertSeverity, { icon: typeof Info; class: string }> = {
  info: { icon: Info, class: "badge-info" },
  warning: { icon: AlertTriangle, class: "badge-warning" },
  critical: { icon: XCircle, class: "badge-danger" },
};

export default function AlertPanel() {
  const alerts = useDashboardStore((s) => s.alerts);
  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="card-header">
        <span className="card-title">Alerts</span>
        {activeAlerts.length > 0 && (
          <span className="badge badge-danger">{activeAlerts.length} active</span>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4" />
            All clear — no active alerts
          </div>
        ) : (
          alerts.slice(0, 20).map((alert) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={clsx(
                  "animate-fade-in rounded-lg border bg-surface p-2.5",
                  alert.resolvedAt ? "border-gray-800 opacity-50" : "border-gray-700"
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", config.class.replace("badge-", "text-accent-"))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200">
                      {alert.title}
                    </p>
                    <p className="text-xs text-gray-500">{alert.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-600">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
