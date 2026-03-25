import { Shield, CheckCircle2, UserCheck, XOctagon, BrainCircuit, Lock, Activity } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { governanceApi } from "../../services/api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

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
  const simActive = useDashboardStore((s) => s.simulationActive);

  const [raiaTraces, setRaiaTraces] = useState(0);
  const [raiaActive, setRaiaActive] = useState(false);
  const [raiaEnabled, setRaiaEnabled] = useState(false);
  const prevTraces = useRef(0);

  // Poll RAIA trace count while simulation is running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const res = await governanceApi.getStatus();
        setRaiaEnabled(res.raia.enabled);
        setRaiaActive(res.raia.active ?? false);
        const count = res.raia.interactions ?? 0;
        prevTraces.current = raiaTraces;
        setRaiaTraces(count);
      } catch {
        // ignore
      }
    };

    fetchStatus();
    if (simActive) {
      interval = setInterval(fetchStatus, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [simActive]);

  const justIncremented = raiaTraces > prevTraces.current;

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

      {/* RAIA + LockThreat Live Status */}
      <div className="mt-4 space-y-2 border-t border-[#e2e8f0] pt-4">
        {/* RAIA trace counter */}
        <div className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-300",
          raiaActive
            ? "bg-gradient-to-r from-[#8b5cf6]/6 to-transparent"
            : "bg-[#f8fafc]"
        )}>
          <div className={cn(
            "relative flex h-7 w-7 items-center justify-center rounded-lg",
            raiaActive ? "bg-[#8b5cf6]/10" : "bg-[#e2e8f0]/60"
          )}>
            <BrainCircuit className={cn(
              "h-3.5 w-3.5",
              raiaActive ? "text-[#8b5cf6]" : "text-[#94a3b8]"
            )} />
            {raiaActive && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-[#10b981]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-[#475569] flex items-center gap-1.5">
              RAIA
              {raiaActive && (
                <span className="flex items-center gap-0.5 text-[9px] font-medium text-[#10b981]">
                  <Activity className="h-2.5 w-2.5" />
                  Live
                </span>
              )}
            </div>
            <div className="text-[9px] text-[#94a3b8]">
              {raiaActive
                ? "Tracing decisions to RAIA"
                : raiaEnabled
                ? "SDK ready"
                : "Not configured"}
            </div>
          </div>
          <motion.span
            key={raiaTraces}
            initial={justIncremented ? { scale: 1.3, color: "#8b5cf6" } : false}
            animate={{ scale: 1, color: raiaActive ? "#8b5cf6" : "#94a3b8" }}
            transition={{ duration: 0.3 }}
            className="text-sm font-bold tabular-nums"
          >
            {raiaTraces}
          </motion.span>
        </div>

        {/* LockThreat compliance */}
        <div className="flex items-center gap-2.5 rounded-xl bg-[#f8fafc] px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb]/10">
            <Lock className="h-3.5 w-3.5 text-[#2563eb]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-[#475569]">LockThreat</div>
            <div className="text-[9px] text-[#94a3b8]">
              {g.totalDecisions > 0 ? "GRC monitoring active" : "Awaiting decisions"}
            </div>
          </div>
          {g.totalDecisions > 0 ? (
            <span className="rounded-full bg-[#10b981]/10 px-2 py-0.5 text-[9px] font-bold text-[#10b981]">
              3/3
            </span>
          ) : (
            <span className="text-[10px] text-[#94a3b8]">--</span>
          )}
        </div>
      </div>
    </div>
  );
}
