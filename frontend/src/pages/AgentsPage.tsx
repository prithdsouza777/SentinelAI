import {
  BrainCircuit,
  Scale,
  ShieldAlert,
  TrendingUp,
  BarChart3,
  Activity,
  CheckCircle2,
  XOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../stores/dashboardStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentType } from "../types";

const agentInfo: Record<
  AgentType,
  { label: string; description: string; icon: typeof BrainCircuit; color: string; gradient: string }
> = {
  queue_balancer: {
    label: "Queue Balancer",
    description:
      "Detects queue imbalances and autonomously reassigns agents between queues. Never leaves any queue below minimum staffing.",
    icon: Scale,
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  predictive_prevention: {
    label: "Predictive Prevention",
    description:
      "Correlates anomaly patterns with historical data to predict problems 5-15 minutes before they manifest.",
    icon: TrendingUp,
    color: "text-purple-400",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  escalation_handler: {
    label: "Escalation Handler",
    description:
      "Escalates critical alerts with cost impact estimates and AI-recommended resolution options ranked by impact.",
    icon: ShieldAlert,
    color: "text-red-400",
    gradient: "from-red-500/20 to-orange-500/20",
  },
  analytics: {
    label: "Analytics Agent",
    description:
      "Answers natural language queries about contact center operations using historical and real-time data.",
    icon: BarChart3,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
};

export default function AgentsPage() {
  const decisions = useDashboardStore((s) => s.decisions);
  const negotiations = useDashboardStore((s) => s.negotiations);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Autonomous AI Agents</h2>
        <p className="text-sm text-muted-foreground">
          Four specialized agents observe, reason, and act on your contact center
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
              >
                <SpotlightCard className="h-full rounded-xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br", info.gradient)}>
                      <Icon className={cn("h-5 w-5", info.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{info.label}</h3>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                          <Activity className="h-2.5 w-2.5" />
                          Active
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {agentDecisions.length} decisions
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">{info.description}</p>

                  {/* Recent decisions */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </p>
                    {agentDecisions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50">No activity yet</p>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {agentDecisions.slice(0, 3).map((d) => (
                          <motion.div
                            key={d.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-[11px] text-muted-foreground"
                          >
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                                d.phase === "acted" ? "bg-emerald-500/10 text-emerald-400" :
                                d.phase === "decided" ? "bg-purple-500/10 text-purple-400" :
                                d.phase === "analyzed" ? "bg-blue-500/10 text-blue-400" :
                                "bg-white/5 text-muted-foreground"
                              )}>
                                {d.phase}
                              </span>
                              {d.confidence != null && (
                                <span className={cn(
                                  "text-[10px] font-medium tabular-nums",
                                  d.confidence >= 0.8 ? "text-emerald-400" :
                                  d.confidence >= 0.5 ? "text-amber-400" : "text-red-400"
                                )}>
                                  {Math.round(d.confidence * 100)}%
                                </span>
                              )}
                              {d.approved === true && (
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              )}
                              {d.approved === false && (
                                <XOctagon className="h-3 w-3 text-red-400" />
                              )}
                            </div>
                            <span className="text-foreground/70">{d.summary}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          }
        )}
      </div>

      {/* Negotiation Log */}
      <div className="rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Negotiation Log
            </span>
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {negotiations.length} negotiations
          </span>
        </div>

        <ScrollArea className="max-h-[300px] p-3">
          {negotiations.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground/60">
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
                        ? "border-purple-500/20 bg-purple-500/5"
                        : "border-white/[0.06] bg-white/[0.02]"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{neg.topic}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {new Date(neg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {neg.proposals.map((p, j) => (
                        <div key={j} className="text-muted-foreground">
                          <span className={cn("font-medium", agentInfo[p.agentType]?.color)}>
                            {agentInfo[p.agentType]?.label}:
                          </span>{" "}
                          {p.proposal}{" "}
                          <span className="tabular-nums text-muted-foreground/60">
                            ({Math.round(p.confidence * 100)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] font-medium text-emerald-400">
                      Resolution: {neg.resolution}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
