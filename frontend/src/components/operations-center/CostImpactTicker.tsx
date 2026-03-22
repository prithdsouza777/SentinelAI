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
  iconBg,
}: {
  icon: typeof DollarSign;
  label: string;
  children: React.ReactNode;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconBg)}>
        <Icon className={cn("h-6 w-6", iconColor)} />
      </div>
      <div>
        <p className="text-xs font-medium text-[#64748b]">{label}</p>
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
      <div className="flex items-center gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <DollarSign className="h-6 w-6 text-[#94a3b8]" />
        <span className="text-sm text-[#64748b]">Cost impact will appear when simulation is active</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex items-center justify-between overflow-hidden rounded-2xl border bg-white px-6 py-5 shadow-sm",
        hasSavings ? "border-[#10b981]/30 glow-green" : "border-[#e2e8f0]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#10b981]/[0.03] via-transparent to-[#2563eb]/[0.03]" />

      <AnimatePresence>
        {(cost.revenueAtRisk ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <StatBlock icon={AlertTriangle} label="Revenue at Risk" iconColor="text-[#ef4444]" iconBg="bg-[#ef4444]/10">
              <p className="text-2xl font-bold tabular-nums text-[#ef4444]">
                <AnimatedCounter value={cost.revenueAtRisk ?? 0} prefix="$" />
              </p>
            </StatBlock>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <StatBlock icon={DollarSign} label="Total Saved" iconColor="text-[#10b981]" iconBg="bg-[#10b981]/10">
          <p className="text-2xl font-bold tabular-nums text-[#10b981]">
            <AnimatedCounter value={cost.totalSaved} prefix="$" />
          </p>
        </StatBlock>
      </div>

      <div className="relative h-10 w-px bg-[#e2e8f0]" />

      <div className="relative">
        <StatBlock icon={ShieldCheck} label="Prevented Abandoned" iconColor="text-[#2563eb]" iconBg="bg-[#2563eb]/10">
          <p className="text-2xl font-bold tabular-nums text-[#1e293b]">
            <AnimatedCounter value={cost.totalPreventedAbandoned} />
          </p>
        </StatBlock>
      </div>

      <div className="relative h-10 w-px bg-[#e2e8f0]" />

      <div className="relative">
        <StatBlock icon={TrendingUp} label="AI Actions" iconColor="text-[#8b5cf6]" iconBg="bg-[#8b5cf6]/10">
          <p className="text-2xl font-bold tabular-nums text-[#1e293b]">
            <AnimatedCounter value={cost.actionsToday} />
          </p>
        </StatBlock>
      </div>
    </motion.div>
  );
}
