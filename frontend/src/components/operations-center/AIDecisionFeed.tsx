import { BrainCircuit, Eye, Search, Zap, CheckCircle, ThumbsUp, ThumbsDown, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { wsService } from "../../services/websocket";
import type { AgentDecision, DecisionPhase } from "../../types";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

const phaseConfig: Record<DecisionPhase, { icon: typeof Eye; color: string; bg: string; label: string }> = {
  observed: { icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Observed" },
  analyzed: { icon: Search, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Analyzed" },
  decided: { icon: BrainCircuit, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "Decided" },
  acted: { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Acted" },
  negotiating: { icon: CheckCircle, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "Negotiating" },
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
    <span className="flex items-center gap-1 text-[11px] text-amber-400">
      <Clock className="h-3 w-3" />
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

  const isPending = decision.requiresApproval && decision.approved == null && decision.phase === "decided";
  const isApproved = decision.approved === true;
  const isRejected = decision.approved === false;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded-xl border bg-card/50 p-3 backdrop-blur-sm transition-all",
        isPending ? "animate-conflict-pulse border-amber-500/30" : "border-white/[0.06]",
        isRejected && "opacity-40"
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <div className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5", phase.bg)}>
          <PhaseIcon className={cn("h-3 w-3", phase.color)} />
          <span className={cn("text-[10px] font-semibold", phase.color)}>
            {phase.label}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {decision.agentType.replace("_", " ")}
        </span>

        {decision.guardrailResult && (
          <span className={cn(
            "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
            decision.guardrailResult === "AUTO_APPROVE" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
            decision.guardrailResult === "PENDING_HUMAN" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
            decision.guardrailResult === "BLOCKED" && "border-red-500/20 bg-red-500/10 text-red-400",
          )}>
            <Shield className="h-2.5 w-2.5" />
            {decision.guardrailResult === "AUTO_APPROVE" ? "Auto" :
             decision.guardrailResult === "PENDING_HUMAN" ? "Pending" : "Blocked"}
          </span>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground">
          {new Date(decision.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-[13px] font-medium text-foreground">{decision.summary}</p>

      {decision.reasoning && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{decision.reasoning}</p>
      )}

      {decision.confidence != null && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Confidence</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(decision.confidence * 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                decision.confidence >= 0.8 ? "bg-emerald-500" :
                decision.confidence >= 0.5 ? "bg-amber-500" : "bg-red-500"
              )}
            />
          </div>
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            decision.confidence >= 0.8 ? "text-emerald-400" :
            decision.confidence >= 0.5 ? "text-amber-400" : "text-red-400"
          )}>
            {Math.round(decision.confidence * 100)}%
          </span>
        </div>
      )}

      {decision.policyViolations?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {decision.policyViolations.map((v, i) => (
            <span key={i} className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">
              {v}
            </span>
          ))}
        </div>
      )}

      {isPending && (
        <div className="mt-2 flex items-center gap-2 border-t border-white/[0.06] pt-2">
          {decision.autoApproveAt && (
            <AutoApproveCountdown autoApproveAt={decision.autoApproveAt} />
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleApprove}
              className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <ThumbsUp className="h-3 w-3" />
              Approve
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              <ThumbsDown className="h-3 w-3" />
              Reject
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
          <CheckCircle className="h-3 w-3" />
          Approved & Executed
        </div>
      )}
      {isRejected && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
          <ThumbsDown className="h-3 w-3" />
          Rejected
        </div>
      )}
    </motion.div>
  );
}

export default function AIDecisionFeed() {
  const decisions = useDashboardStore((s) => s.decisions);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Decision Feed</span>
        </div>
        {decisions.length > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {decisions.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <BrainCircuit className="h-8 w-8 text-white/10" />
                <p className="text-sm text-muted-foreground">Agents are standing by</p>
                <p className="text-xs text-muted-foreground/60">Start a simulation to activate AI agents</p>
              </div>
            ) : (
              decisions.map((decision) => (
                <DecisionCard key={decision.id} decision={decision} />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
