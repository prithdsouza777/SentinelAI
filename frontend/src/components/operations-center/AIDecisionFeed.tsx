import { BrainCircuit, Eye, Search, Zap, CheckCircle, ThumbsUp, ThumbsDown, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { wsService } from "../../services/websocket";
import type { AgentDecision, DecisionPhase } from "../../types";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const phaseConfig: Record<DecisionPhase, { icon: typeof Eye; color: string; bg: string; label: string }> = {
  observed: { icon: Eye, color: "text-[#2563eb]", bg: "bg-[#2563eb]/10 border-[#2563eb]/20", label: "Observed" },
  analyzed: { icon: Search, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10 border-[#f59e0b]/20", label: "Analyzed" },
  decided: { icon: BrainCircuit, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10 border-[#8b5cf6]/20", label: "Decided" },
  acted: { icon: Zap, color: "text-[#10b981]", bg: "bg-[#10b981]/10 border-[#10b981]/20", label: "Acted" },
  negotiating: { icon: CheckCircle, color: "text-[#f97316]", bg: "bg-[#f97316]/10 border-[#f97316]/20", label: "Negotiating" },
};

function AutoApproveCountdown({ autoApproveAt }: { autoApproveAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = (new Date(autoApproveAt).getTime() - Date.now()) / 1000;
    return Math.max(0, Math.ceil(diff));
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      const diff = (new Date(autoApproveAt).getTime() - Date.now()) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(diff)));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoApproveAt, secondsLeft]);

  if (secondsLeft <= 0) return null;

  return (
    <span className="flex items-center gap-1 text-xs font-medium text-[#f59e0b]">
      <Clock className="h-3.5 w-3.5" />
      Auto-approve in {secondsLeft}s
    </span>
  );
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  const approveDecision = useDashboardStore((s) => s.approveDecision);
  const rejectDecision = useDashboardStore((s) => s.rejectDecision);
  const phase = phaseConfig[decision.phase];
  const PhaseIcon = phase.icon;

  const handleApprove = () => {
    wsService.send("action:approve", { decisionId: decision.id });
    approveDecision(decision.id);
  };

  const handleReject = () => {
    wsService.send("action:reject", { decisionId: decision.id });
    rejectDecision(decision.id);
  };

  const isPending = decision.requiresApproval && decision.approved == null && decision.phase !== "acted";
  const isApproved = decision.approved === true;
  const isRejected = decision.approved === false;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition-all",
        isPending ? "animate-conflict-pulse border-[#f59e0b]/40" : "border-[#e2e8f0]",
        isRejected && "opacity-40"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1", phase.bg)}>
          <PhaseIcon className={cn("h-3.5 w-3.5", phase.color)} />
          <span className={cn("text-[11px] font-semibold", phase.color)}>
            {phase.label}
          </span>
        </div>
        <span className="text-xs font-medium text-[#64748b]">
          {decision.agentType.replace("_", " ")}
        </span>

        {decision.guardrailResult && (
          <span className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            decision.guardrailResult === "AUTO_APPROVE" && "border-[#10b981]/20 bg-[#10b981]/10 text-[#10b981]",
            decision.guardrailResult === "PENDING_HUMAN" && "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]",
            decision.guardrailResult === "BLOCKED" && "border-[#ef4444]/20 bg-[#ef4444]/10 text-[#ef4444]",
            decision.guardrailResult === "NEGOTIATION_OVERRIDDEN" && "border-[#f97316]/20 bg-[#f97316]/10 text-[#f97316]",
          )}>
            <Shield className="h-3 w-3" />
            {decision.guardrailResult === "AUTO_APPROVE" ? "Auto" :
             decision.guardrailResult === "PENDING_HUMAN" ? "Pending" :
             decision.guardrailResult === "NEGOTIATION_OVERRIDDEN" ? "Overridden" : "Blocked"}
          </span>
        )}

        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#94a3b8]">
          {new Date(decision.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-sm font-semibold leading-snug text-[#1e293b]">{decision.summary}</p>

      {decision.reasoning && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">{decision.reasoning}</p>
      )}

      {decision.confidence != null && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94a3b8]">Confidence</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(decision.confidence * 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                decision.confidence >= 0.8 ? "bg-[#10b981]" :
                decision.confidence >= 0.5 ? "bg-[#f59e0b]" : "bg-[#ef4444]"
              )}
            />
          </div>
          <span className={cn(
            "text-xs font-bold tabular-nums",
            decision.confidence >= 0.8 ? "text-[#10b981]" :
            decision.confidence >= 0.5 ? "text-[#f59e0b]" : "text-[#ef4444]"
          )}>
            {Math.round(decision.confidence * 100)}%
          </span>
        </div>
      )}

      {decision.policyViolations?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {decision.policyViolations.map((v, i) => (
            <span key={i} className="rounded-full border border-[#ef4444]/20 bg-[#ef4444]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#ef4444]">
              {v}
            </span>
          ))}
        </div>
      )}

      {isPending && (
        <div className="mt-3 flex items-center gap-2 border-t border-[#e2e8f0] pt-3">
          {decision.autoApproveAt && (
            <AutoApproveCountdown autoApproveAt={decision.autoApproveAt} />
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-4 py-2 text-xs font-semibold text-[#10b981] transition-colors hover:bg-[#10b981]/20"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-2 text-xs font-semibold text-[#ef4444] transition-colors hover:bg-[#ef4444]/20"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#10b981]">
          <CheckCircle className="h-3.5 w-3.5" />
          Approved & Executed
        </div>
      )}
      {isRejected && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#ef4444]">
          <ThumbsDown className="h-3.5 w-3.5" />
          Rejected
        </div>
      )}
    </motion.div>
  );
}

export default function AIDecisionFeed() {
  const decisions = useDashboardStore((s) => s.decisions);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <BrainCircuit className="h-5 w-5 text-[#8b5cf6]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">AI Decision Feed</span>
        </div>
        {decisions.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full border border-[#10b981]/20 bg-[#10b981]/10 px-3 py-1 text-[11px] font-semibold text-[#10b981]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]" />
            Live
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {decisions.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                <BrainCircuit className="h-10 w-10 text-[#e2e8f0]" />
                <p className="text-base font-medium text-[#64748b]">Agents are standing by</p>
                <p className="text-sm text-[#94a3b8]">Start a simulation to activate AI agents</p>
              </div>
            ) : (
              decisions.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
