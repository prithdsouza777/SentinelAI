import { Shield, CheckCircle2, UserCheck, XOctagon } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function PercentBar({ value, total, colorClass }: { value: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
      <span className="w-8 text-right text-[10px] font-medium tabular-nums text-[#64748b]">
        {pct}%
      </span>
    </div>
  );
}

export default function GovernanceScorecardWidget() {
  const g = useDashboardStore((s) => s.governance);

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#2563eb]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">AI Governance</span>
        </div>
        {g.totalDecisions > 0 && (
          <span className="text-[10px] font-medium tabular-nums text-[#94a3b8]">
            {g.totalDecisions} decisions
          </span>
        )}
      </div>

      {g.totalDecisions === 0 ? (
        <p className="text-xs text-[#94a3b8]">No decisions yet - start the simulation.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
              <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
              Auto-approved ({g.autoApproved})
            </div>
            <PercentBar value={g.autoApproved} total={g.totalDecisions} colorClass="bg-[#10b981]" />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
              <UserCheck className="h-3 w-3 text-[#f59e0b]" />
              Human-approved ({g.humanApproved})
            </div>
            <PercentBar value={g.humanApproved} total={g.totalDecisions} colorClass="bg-[#f59e0b]" />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
              <XOctagon className="h-3 w-3 text-[#ef4444]" />
              Blocked ({g.blocked})
            </div>
            <PercentBar value={g.blocked} total={g.totalDecisions} colorClass="bg-[#ef4444]" />
          </div>

          <div className="flex items-center justify-between border-t border-[#e2e8f0] pt-2">
            <span className="text-[11px] font-medium text-[#64748b]">Avg confidence</span>
            <span className={cn(
              "text-[12px] font-bold tabular-nums",
              g.avgConfidence >= 0.9 ? "text-[#10b981]" :
              g.avgConfidence >= 0.7 ? "text-[#f59e0b]" : "text-[#ef4444]"
            )}>
              {(g.avgConfidence * 100).toFixed(0)}%
              <span className={cn(
                "ml-1.5 inline-block h-2 w-2 rounded-full",
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
