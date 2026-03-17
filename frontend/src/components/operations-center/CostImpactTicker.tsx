import { AlertTriangle, DollarSign, TrendingUp, ShieldCheck } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion, AnimatePresence } from "framer-motion";

function StatBlock({
  icon: Icon,
  label,
  children,
  iconColor,
  glowClass,
}: {
  icon: typeof DollarSign;
  label: string;
  children: React.ReactNode;
  iconColor: string;
  glowClass?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]", glowClass)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

export default function CostImpactTicker() {
  const cost = useDashboardStore((s) => s.costSummary);
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const hasSavings = cost.totalSaved > 0;

  if (!simulationActive && !hasSavings) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-sm">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Cost impact will appear when simulation is active</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex items-center gap-6 overflow-hidden rounded-xl border border-white/[0.06] bg-card/80 p-4 backdrop-blur-sm",
        hasSavings && "glow-green"
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-blue-500/[0.03]" />

      <AnimatePresence>
        {(cost.revenueAtRisk ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <StatBlock icon={AlertTriangle} label="Revenue at Risk" iconColor="text-red-400" glowClass="animate-pulse border-red-500/20">
              <p className="text-xl font-bold tabular-nums text-red-400">
                <AnimatedCounter value={cost.revenueAtRisk ?? 0} prefix="$" />
              </p>
            </StatBlock>
          </motion.div>
        )}
      </AnimatePresence>

      {(cost.revenueAtRisk ?? 0) > 0 && <div className="relative h-8 w-px bg-white/[0.06]" />}

      <div className="relative">
        <StatBlock icon={DollarSign} label="Total Saved" iconColor="text-emerald-400">
          <p className="text-xl font-bold tabular-nums text-emerald-400">
            <AnimatedCounter value={cost.totalSaved} prefix="$" />
          </p>
        </StatBlock>
      </div>

      <div className="relative h-8 w-px bg-white/[0.06]" />

      <div className="relative">
        <StatBlock icon={ShieldCheck} label="Prevented Abandoned" iconColor="text-blue-400">
          <p className="text-lg font-semibold tabular-nums">
            <AnimatedCounter value={cost.totalPreventedAbandoned} />
          </p>
        </StatBlock>
      </div>

      <div className="relative h-8 w-px bg-white/[0.06]" />

      <div className="relative">
        <StatBlock icon={TrendingUp} label="AI Actions" iconColor="text-purple-400">
          <p className="text-lg font-semibold tabular-nums">
            <AnimatedCounter value={cost.actionsToday} />
          </p>
        </StatBlock>
      </div>
    </motion.div>
  );
}
