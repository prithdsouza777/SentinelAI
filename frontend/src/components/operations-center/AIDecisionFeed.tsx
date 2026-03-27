import { BrainCircuit, Eye, Search, Zap, CheckCircle, ThumbsUp, ThumbsDown, Shield, Clock, ChevronDown, Wrench, AlertTriangle, FileSearch } from "lucide-react";
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

function ExplainPanel({ decision }: { decision: AgentDecision }) {
  const toolName = decision.action?.split(":")[0];
  const toolArgs: Record<string, string> = {};
  if (decision.action) {
    for (const seg of decision.action.split(":").slice(1)) {
      if (seg.includes("=")) {
        const [k, v] = seg.split("=", 2);
        if (k) toolArgs[k] = v ?? "";
      }
    }
  }

  const guardrailLabel =
    decision.guardrailResult === "AUTO_APPROVE" ? "Auto-Approved (confidence >= 90%)" :
    decision.guardrailResult === "PENDING_HUMAN" ? "Pending Human Review (confidence 70-90%)" :
    decision.guardrailResult === "BLOCKED" ? "Blocked (confidence < 70%)" :
    decision.guardrailResult === "NEGOTIATION_OVERRIDDEN" ? "Overridden by Negotiation" :
    "Unknown";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="mt-3 space-y-3 border-t border-[#e2e8f0] pt-3">
        {/* Reasoning Chain */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <BrainCircuit className="h-3 w-3" />
            Reasoning Chain
          </div>
          <div className="space-y-1.5">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/10 text-[9px] font-bold text-[#2563eb]">1</span>
              <span className="text-[12px] text-[#475569]">Observed queue metrics and detected anomaly patterns</span>
            </motion.div>
            {decision.reasoning && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6]/10 text-[9px] font-bold text-[#8b5cf6]">2</span>
                <span className="text-[12px] text-[#475569]">{decision.reasoning}</span>
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-start gap-2 rounded-lg bg-[#f8fafc] px-3 py-2"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#10b981]/10 text-[9px] font-bold text-[#10b981]">{decision.reasoning ? "3" : "2"}</span>
              <span className="text-[12px] text-[#475569]">{decision.summary}</span>
            </motion.div>
          </div>
        </div>

        {/* Tool Call */}
        {toolName && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              <Wrench className="h-3 w-3" />
              Tool Call
            </div>
            <div className="rounded-lg border border-[#e2e8f0] bg-[#fafbfc] px-3 py-2">
              <div className="flex items-center gap-2">
                <code className="rounded bg-[#8b5cf6]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8b5cf6]">{toolName}</code>
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  decision.guardrailResult !== "BLOCKED"
                    ? "bg-[#10b981]/10 text-[#10b981]"
                    : "bg-[#ef4444]/10 text-[#ef4444]"
                )}>
                  {decision.guardrailResult !== "BLOCKED" ? "AUTHORIZED" : "BLOCKED"}
                </span>
              </div>
              {Object.keys(toolArgs).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(toolArgs).map(([k, v]) => (
                    <span key={k} className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] text-[#64748b]">
                      {k}=<strong>{v}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Guardrail Evaluation */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <Shield className="h-3 w-3" />
            Guardrail Evaluation
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#fafbfc] px-3 py-2">
            <span className="text-[11px] text-[#475569]">{guardrailLabel}</span>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              decision.confidence >= 0.9 ? "text-[#10b981]" :
              decision.confidence >= 0.7 ? "text-[#f59e0b]" : "text-[#ef4444]"
            )}>
              {Math.round(decision.confidence * 100)}%
            </span>
          </div>
        </motion.div>

        {/* Policy Violations */}
        {decision.policyViolations?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#ef4444]">
              <AlertTriangle className="h-3 w-3" />
              Policy Violations
            </div>
            <div className="space-y-1">
              {decision.policyViolations.map((v, i) => (
                <div key={i} className="rounded-lg border border-[#ef4444]/15 bg-[#ef4444]/5 px-3 py-1.5 text-[11px] text-[#ef4444]">
                  {v}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* RAIA Trace Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8b5cf6]/5 to-transparent px-3 py-2"
        >
          <BrainCircuit className="h-3.5 w-3.5 text-[#8b5cf6]" />
          <span className="text-[10px] font-medium text-[#8b5cf6]">
            Traced to RAIA for explainability evaluation
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  const approveDecision = useDashboardStore((s) => s.approveDecision);
  const rejectDecision = useDashboardStore((s) => s.rejectDecision);
  const [expanded, setExpanded] = useState(false);
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
        "min-w-0 overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all dark:bg-white/5 dark:border-white/10",
        isPending ? "animate-conflict-pulse border-[#f59e0b]/40" : "border-[#e2e8f0] dark:border-white/10",
        isRejected && "opacity-40"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1", phase.bg)}>
          <PhaseIcon className={cn("h-3.5 w-3.5", phase.color)} />
          <span className={cn("text-[11px] font-semibold", phase.color)}>
            {phase.label}
          </span>
        </div>
        <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
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

      <p className="text-sm font-semibold leading-snug text-[#1e293b] dark:text-white/90">{decision.summary}</p>

      {decision.reasoning && !expanded && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">{decision.reasoning}</p>
      )}

      {decision.confidence != null && !expanded && (
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

      {decision.policyViolations?.length > 0 && !expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {decision.policyViolations.map((v, i) => (
            <span key={i} className="rounded-full border border-[#ef4444]/20 bg-[#ef4444]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#ef4444]">
              {v}
            </span>
          ))}
        </div>
      )}

      {/* Explain This Decision button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-semibold transition-all",
          expanded
            ? "border-[#8b5cf6]/20 bg-[#8b5cf6]/5 text-[#8b5cf6]"
            : "border-[#e2e8f0] text-[#94a3b8] hover:border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/5 hover:text-[#8b5cf6]"
        )}
      >
        <FileSearch className="h-3.5 w-3.5" />
        {expanded ? "Hide Explanation" : "Explain This Decision"}
        <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
      </button>

      <AnimatePresence>
        {expanded && <ExplainPanel decision={decision} />}
      </AnimatePresence>

      {isPending && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e2e8f0] dark:border-white/10 pt-3">
          {decision.autoApproveAt && (
            <AutoApproveCountdown autoApproveAt={decision.autoApproveAt} />
          )}
          <div className="ml-auto flex shrink-0 gap-2">
            <button
              onClick={handleApprove}
              className="flex items-center gap-1.5 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-xs font-semibold text-[#10b981] transition-colors hover:bg-[#10b981]/20"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1.5 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-1.5 text-xs font-semibold text-[#ef4444] transition-colors hover:bg-[#ef4444]/20"
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
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 dark:border-white/10">
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
