import {
  BrainCircuit,
  Scale,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Activity,
  CheckCircle2,
  XOctagon,
  Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../stores/dashboardStore";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentType } from "../types";

const agentInfo: Record<
  AgentType,
  { label: string; description: string; icon: typeof BrainCircuit; color: string; iconBg: string }
> = {
  queue_balancer: {
    label: "Queue Balancer",
    description:
      "Detects queue imbalances and autonomously reassigns agents between queues. Never leaves any queue below minimum staffing.",
    icon: Scale,
    color: "text-[#2563eb]",
    iconBg: "bg-[#2563eb]/10",
  },
  predictive_prevention: {
    label: "Predictive Prevention",
    description:
      "Correlates anomaly patterns with historical data to predict problems 5-15 minutes before they manifest.",
    icon: TrendingUp,
    color: "text-[#8b5cf6]",
    iconBg: "bg-[#8b5cf6]/10",
  },
  escalation_handler: {
    label: "Escalation Handler",
    description:
      "Escalates critical alerts with cost impact estimates and AI-recommended resolution options ranked by impact.",
    icon: ShieldAlert,
    color: "text-[#ef4444]",
    iconBg: "bg-[#ef4444]/10",
  },
  skill_router: {
    label: "Skill Router",
    description:
      "Routes incoming contacts to the best-match agent based on skill overlap, performance, experience, and current load.",
    icon: Route,
    color: "text-[#22c55e]",
    iconBg: "bg-[#22c55e]/10",
  },
  analytics: {
    label: "Analytics Agent",
    description:
      "Answers natural language queries about contact center operations using historical and real-time data.",
    icon: BarChart3,
    color: "text-[#10b981]",
    iconBg: "bg-[#10b981]/10",
  },
};

export default function AgentsPage() {
  const decisions = useDashboardStore((s) => s.decisions);
  const negotiations = useDashboardStore((s) => s.negotiations);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      <div>
        <h2 className="text-xl font-bold text-[#1e293b]">Autonomous AI Agents</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Five specialized agents observe, reason, and act on your contact center in real time
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-4">
        {(Object.entries(agentInfo) as [AgentType, (typeof agentInfo)[AgentType]][]).map(
          ([type, info], index) => {
            const agentDecisions = decisions.filter((d) => d.agentType === type);
            const Icon = info.icon;
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", info.iconBg)}>
                    <Icon className={cn("h-5 w-5", info.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1e293b]">{info.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-[#10b981]">
                        <Activity className="h-2.5 w-2.5" />
                        Active
                      </span>
                      <span className="text-[11px] tabular-nums text-[#94a3b8]">
                        {agentDecisions.length} decisions
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mb-4 text-[12px] leading-relaxed text-[#64748b]">{info.description}</p>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                    Recent Activity
                  </p>
                  {agentDecisions.length === 0 ? (
                    <p className="text-[12px] text-[#94a3b8]">No activity yet</p>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {agentDecisions.slice(0, 3).map((d) => (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475569]"
                        >
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                              d.phase === "acted" ? "bg-[#10b981]/10 text-[#10b981]" :
                              d.phase === "decided" ? "bg-[#8b5cf6]/10 text-[#8b5cf6]" :
                              d.phase === "analyzed" ? "bg-[#2563eb]/10 text-[#2563eb]" :
                              "bg-[#f1f5f9] text-[#64748b]"
                            )}>
                              {d.phase}
                            </span>
                            {d.confidence != null && (
                              <span className={cn(
                                "text-[10px] font-semibold tabular-nums",
                                d.confidence >= 0.8 ? "text-[#10b981]" :
                                d.confidence >= 0.5 ? "text-[#f59e0b]" : "text-[#ef4444]"
                              )}>
                                {Math.round(d.confidence * 100)}%
                              </span>
                            )}
                            {d.approved === true && (
                              <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
                            )}
                            {d.approved === false && (
                              <XOctagon className="h-3 w-3 text-[#ef4444]" />
                            )}
                          </div>
                          <span className="text-[#475569]">{d.summary}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            );
          }
        )}
      </div>

      {/* Negotiation Log */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <BrainCircuit className="h-5 w-5 text-[#8b5cf6]" />
            <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">
              Negotiation Log
            </span>
          </div>
          <span className="text-xs font-medium tabular-nums text-[#94a3b8]">
            {negotiations.length} negotiations
          </span>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-3">
          {negotiations.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#94a3b8]">
              No inter-agent negotiations yet. Conflicts between agents will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {negotiations.map((neg, i) => (
                  <motion.div
                    key={neg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "rounded-lg border p-3",
                      i === 0
                        ? "border-[#8b5cf6]/20 bg-[#8b5cf6]/5"
                        : "border-[#e2e8f0] bg-[#f8fafc]"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1e293b]">{neg.topic}</span>
                      <span className="text-[10px] tabular-nums text-[#94a3b8]">
                        {new Date(neg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-[12px]">
                      {neg.proposals.map((p, j) => (
                        <div key={j} className="text-[#475569]">
                          <span className={cn("font-semibold", agentInfo[p.agentType]?.color)}>
                            {agentInfo[p.agentType]?.label}:
                          </span>{" "}
                          {p.proposal}{" "}
                          <span className="tabular-nums text-[#94a3b8]">
                            ({Math.round(p.confidence * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-[#e2e8f0] pt-2 text-[12px] font-semibold text-[#10b981]">
                      Resolution: {neg.resolution}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
