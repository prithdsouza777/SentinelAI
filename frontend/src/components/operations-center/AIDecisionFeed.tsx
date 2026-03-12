import { BrainCircuit, Eye, Search, Zap, CheckCircle, ThumbsUp, ThumbsDown, Shield, Clock } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardStore } from "../../stores/dashboardStore";
import { wsService } from "../../services/websocket";
import type { AgentDecision, DecisionPhase } from "../../types";
import { useState, useEffect } from "react";

const phaseConfig: Record<DecisionPhase, { icon: typeof Eye; color: string; label: string }> = {
  observed: { icon: Eye, color: "text-blue-400", label: "Observed" },
  analyzed: { icon: Search, color: "text-yellow-400", label: "Analyzed" },
  decided: { icon: BrainCircuit, color: "text-purple-400", label: "Decided" },
  acted: { icon: Zap, color: "text-green-400", label: "Acted" },
  negotiating: { icon: CheckCircle, color: "text-orange-400", label: "Negotiating" },
};

function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-green-500";
  if (c >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

function confidenceTextColor(c: number): string {
  if (c >= 0.8) return "text-green-400";
  if (c >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

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
    <span className="flex items-center gap-1 text-xs text-yellow-500">
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
    wsService.send("action:approve", { decision_id: decision.id });
    approveDecision(decision.id);
  };

  const handleReject = () => {
    wsService.send("action:reject", { decision_id: decision.id });
    rejectDecision(decision.id);
  };

  const isPending = decision.requiresApproval && decision.approved == null && decision.phase === "decided";
  const isApproved = decision.approved === true;
  const isRejected = decision.approved === false;

  return (
    <div
      className={clsx(
        "animate-slide-in-right rounded-lg border bg-surface p-3 transition-all",
        isPending ? "border-yellow-600/50 shadow-sm shadow-yellow-600/10" : "border-gray-800",
        isRejected && "opacity-50"
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <PhaseIcon className={clsx("h-4 w-4", phase.color)} />
        <span className={clsx("text-xs font-medium", phase.color)}>
          {phase.label}
        </span>
        <span className="text-xs text-gray-500">
          {decision.agentType.replace("_", " ")}
        </span>

        {/* Guardrail status badge */}
        {decision.guardrailResult && (
          <span className={clsx(
            "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
            decision.guardrailResult === "AUTO_APPROVE" && "bg-green-900/30 text-green-400",
            decision.guardrailResult === "PENDING_HUMAN" && "bg-yellow-900/30 text-yellow-400",
            decision.guardrailResult === "BLOCKED" && "bg-red-900/30 text-red-400",
          )}>
            <Shield className="h-2.5 w-2.5" />
            {decision.guardrailResult === "AUTO_APPROVE" ? "Auto" :
             decision.guardrailResult === "PENDING_HUMAN" ? "Pending" : "Blocked"}
          </span>
        )}

        <span className="ml-auto text-xs text-gray-600">
          {new Date(decision.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-sm text-gray-300">{decision.summary}</p>

      {decision.reasoning && (
        <p className="mt-1 text-xs text-gray-500">{decision.reasoning}</p>
      )}

      {/* Confidence bar */}
      {decision.confidence != null && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Confidence</span>
          <div className="h-1.5 flex-1 rounded-full bg-gray-800">
            <div
              className={clsx("h-full rounded-full transition-all", confidenceColor(decision.confidence))}
              style={{ width: `${Math.round(decision.confidence * 100)}%` }}
            />
          </div>
          <span className={clsx("text-[10px] font-medium", confidenceTextColor(decision.confidence))}>
            {Math.round(decision.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Policy violations */}
      {decision.policyViolations?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {decision.policyViolations.map((v, i) => (
            <span key={i} className="rounded bg-red-900/20 px-1.5 py-0.5 text-[10px] text-red-400">
              {v}
            </span>
          ))}
        </div>
      )}

      {/* Approve/Reject controls for pending decisions */}
      {isPending && (
        <div className="mt-2 flex items-center gap-2 border-t border-gray-800 pt-2">
          {decision.autoApproveAt && (
            <AutoApproveCountdown autoApproveAt={decision.autoApproveAt} />
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleApprove}
              className="flex items-center gap-1 rounded-lg bg-green-600/15 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-600/25"
            >
              <ThumbsUp className="h-3 w-3" />
              Approve
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-1 rounded-lg bg-red-600/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/25"
            >
              <ThumbsDown className="h-3 w-3" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Approval status */}
      {isApproved && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-400">
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
    </div>
  );
}

export default function AIDecisionFeed() {
  const decisions = useDashboardStore((s) => s.decisions);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="card-header">
        <span className="card-title">AI Decision Feed</span>
        <span className="badge badge-info">Live</span>
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {decisions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <BrainCircuit className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">Agents are standing by</p>
            <p className="text-xs text-gray-600">Start a simulation to activate AI agents</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))
        )}
      </div>
    </div>
  );
}
