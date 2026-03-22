import { AlertTriangle, CheckCircle, Info, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import type { AlertSeverity } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const severityConfig: Record<AlertSeverity, { icon: typeof Info; color: string; borderColor: string; bg: string }> = {
  info: { icon: Info, color: "text-[#3b82f6]", borderColor: "border-[#3b82f6]/20", bg: "bg-[#3b82f6]/5" },
  warning: { icon: AlertTriangle, color: "text-[#f59e0b]", borderColor: "border-[#f59e0b]/20", bg: "bg-[#f59e0b]/5" },
  critical: { icon: XCircle, color: "text-[#ef4444]", borderColor: "border-[#ef4444]/25", bg: "bg-[#ef4444]/5" },
};

export default function AlertPanel() {
  const alerts = useDashboardStore((s) => s.alerts);
  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">Alerts</span>
        </div>
        {activeAlerts.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-[#ef4444]/20 bg-[#ef4444]/10 px-3 py-1 text-[11px] font-bold text-[#ef4444]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef4444]" />
            {activeAlerts.length} active
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="h-8 w-8 text-[#e2e8f0]" />
                <p className="text-sm font-medium text-[#64748b]">No active alerts</p>
                <p className="text-xs text-[#94a3b8]">System healthy</p>
              </div>
            ) : (
              alerts.slice(0, 4).map((alert) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-xl border p-3 transition-all",
                      alert.resolvedAt
                        ? "border-[#e2e8f0] bg-[#f8fafc] opacity-50"
                        : alert.severity === "critical"
                          ? "animate-critical-flash border-[#ef4444]/25 bg-[#ef4444]/5"
                          : cn(config.borderColor, config.bg)
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1e293b]">{alert.title}</p>
                        <p className="text-xs text-[#64748b]">{alert.description}</p>
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-[#94a3b8]">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
          {alerts.length > 4 && (
            <Link
              to="/alerts"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2.5 text-xs font-semibold text-[#2563eb] transition-colors hover:bg-[#2563eb]/5"
            >
              View all {alerts.length} alerts
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
