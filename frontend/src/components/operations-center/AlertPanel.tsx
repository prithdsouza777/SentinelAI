import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import type { AlertSeverity } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

const severityConfig: Record<AlertSeverity, { icon: typeof Info; color: string; borderColor: string }> = {
  info: { icon: Info, color: "text-blue-400", borderColor: "border-blue-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", borderColor: "border-amber-500/20" },
  critical: { icon: XCircle, color: "text-red-400", borderColor: "border-red-500/30" },
};

export default function AlertPanel() {
  const alerts = useDashboardStore((s) => s.alerts);
  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alerts</span>
        </div>
        {activeAlerts.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            {activeAlerts.length} active
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle className="h-6 w-6 text-white/10" />
                <p className="text-sm text-muted-foreground">No active alerts</p>
                <p className="text-xs text-muted-foreground/60">System healthy</p>
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
                      "rounded-xl border bg-card/80 p-2.5 transition-all",
                      alert.resolvedAt
                        ? "border-white/[0.04] opacity-40"
                        : alert.severity === "critical"
                          ? "animate-critical-flash border-red-500/30"
                          : config.borderColor
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-foreground">{alert.title}</p>
                        <p className="text-[11px] text-muted-foreground">{alert.description}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
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
