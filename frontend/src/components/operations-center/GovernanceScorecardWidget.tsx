import { Shield, CheckCircle2, UserCheck, XOctagon } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function PercentBar({ value, total, colorClass }: { value: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums text-[#64748b]">
        {pct}%
      </span>
    </div>
  );
}

export default function GovernanceScorecardWidget() {
  const g = useDashboardStore((s) => s.governance);

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#2563eb]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">AI Governance</span>
        </div>
        {g.totalDecisions > 0 && (
          <span className="text-xs font-semibold tabular-nums text-[#94a3b8]">
            {g.totalDecisions} decisions
          </span>
        )}
      </div>

      {g.totalDecisions === 0 ? (
        <p className="text-sm text-[#94a3b8]">No decisions yet — start the simulation.</p>
      ) : (
        <div className="space-y-3.5">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#475569]">
              <CheckCircle2 className="h-4 w-4 text-[#10b981]" />
              Auto-approved ({g.autoApproved})
            </div>
            <PercentBar value={g.autoApproved} total={g.totalDecisions} colorClass="bg-[#10b981]" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#475569]">
              <UserCheck className="h-4 w-4 text-[#f59e0b]" />
              Human-approved ({g.humanApproved})
            </div>
            <PercentBar value={g.humanApproved} total={g.totalDecisions} colorClass="bg-[#f59e0b]" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#475569]">
              <XOctagon className="h-4 w-4 text-[#ef4444]" />
              Blocked ({g.blocked})
            </div>
            <PercentBar value={g.blocked} total={g.totalDecisions} colorClass="bg-[#ef4444]" />
          </div>

          <div className="flex items-center justify-between border-t border-[#e2e8f0] pt-3">
            <span className="text-xs font-semibold text-[#64748b]">Avg confidence</span>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              g.avgConfidence >= 0.9 ? "text-[#10b981]" :
              g.avgConfidence >= 0.7 ? "text-[#f59e0b]" : "text-[#ef4444]"
            )}>
              {(g.avgConfidence * 100).toFixed(0)}%
              <span className={cn(
                "ml-2 inline-block h-2.5 w-2.5 rounded-full",
                g.avgConfidence >= 0.9 ? "bg-[#10b981]" :
                g.avgConfidence >= 0.7 ? "bg-[#f59e0b]" : "bg-[#ef4444]"
              )} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
