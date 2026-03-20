import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import type { AlertSeverity } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

const severityConfig: Record<AlertSeverity, { icon: typeof Info; color: string; borderColor: string; bg: string }> = {
  info: { icon: Info, color: "text-[#3b82f6]", borderColor: "border-[#3b82f6]/20", bg: "bg-[#3b82f6]/5" },
  warning: { icon: AlertTriangle, color: "text-[#f59e0b]", borderColor: "border-[#f59e0b]/20", bg: "bg-[#f59e0b]/5" },
  critical: { icon: XCircle, color: "text-[#ef4444]", borderColor: "border-[#ef4444]/25", bg: "bg-[#ef4444]/5" },
};

export default function AlertPanel() {
  const alerts = useDashboardStore((s) => s.alerts);
  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Alerts</span>
        </div>
        {activeAlerts.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-[#ef4444]/20 bg-[#ef4444]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ef4444]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ef4444]" />
            {activeAlerts.length} active
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle className="h-6 w-6 text-[#e2e8f0]" />
                <p className="text-sm font-medium text-[#64748b]">No active alerts</p>
                <p className="text-xs text-[#94a3b8]">System healthy</p>
              </div>
            ) : (
              alerts.slice(0, 20).map((alert) => {
                const config = severityConfig[alert.severity];
                const Icon = config.icon;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-xl border p-2.5 transition-all",
                      alert.resolvedAt
                        ? "border-[#e2e8f0] bg-[#f8fafc] opacity-50"
                        : alert.severity === "critical"
                          ? "animate-critical-flash border-[#ef4444]/25 bg-[#ef4444]/5"
                          : cn(config.borderColor, config.bg)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#1e293b]">{alert.title}</p>
                        <p className="text-[11px] text-[#64748b]">{alert.description}</p>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-[#94a3b8]">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
