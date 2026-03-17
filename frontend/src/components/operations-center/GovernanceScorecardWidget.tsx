import { Shield, CheckCircle2, UserCheck, XOctagon } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function PercentBar({ value, total, colorClass }: { value: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", colorClass)}
        />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

export default function GovernanceScorecardWidget() {
  const g = useDashboardStore((s) => s.governance);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Governance</span>
        </div>
        {g.totalDecisions > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {g.totalDecisions} decisions
          </span>
        )}
      </div>

      {g.totalDecisions === 0 ? (
        <p className="text-xs text-muted-foreground/60">No decisions yet — start the simulation.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              Auto-approved ({g.autoApproved})
            </div>
            <PercentBar value={g.autoApproved} total={g.totalDecisions} colorClass="bg-emerald-500" />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <UserCheck className="h-3 w-3 text-amber-400" />
              Human-approved ({g.humanApproved})
            </div>
            <PercentBar value={g.humanApproved} total={g.totalDecisions} colorClass="bg-amber-500" />
          </div>

          <div>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <XOctagon className="h-3 w-3 text-red-400" />
              Blocked ({g.blocked})
            </div>
            <PercentBar value={g.blocked} total={g.totalDecisions} colorClass="bg-red-500" />
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
            <span className="text-[11px] text-muted-foreground">Avg confidence</span>
            <span className={cn(
              "text-[11px] font-semibold tabular-nums",
              g.avgConfidence >= 0.9 ? "text-emerald-400" :
              g.avgConfidence >= 0.7 ? "text-amber-400" : "text-red-400"
            )}>
              {(g.avgConfidence * 100).toFixed(0)}%
              <span className={cn(
                "ml-1.5 inline-block h-2 w-2 rounded-full",
                g.avgConfidence >= 0.9 ? "bg-emerald-400" :
                g.avgConfidence >= 0.7 ? "bg-amber-400" : "bg-red-400"
              )} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
