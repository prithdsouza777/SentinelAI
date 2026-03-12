import {
  BrainCircuit,
  Scale,
  ShieldAlert,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { clsx } from "clsx";
import { useDashboardStore } from "../stores/dashboardStore";
import type { AgentType } from "../types";

const agentInfo: Record<
  AgentType,
  { label: string; description: string; icon: typeof BrainCircuit; color: string }
> = {
  queue_balancer: {
    label: "Queue Balancer",
    description:
      "Detects queue imbalances and autonomously reassigns agents between queues. Never leaves any queue below minimum staffing.",
    icon: Scale,
    color: "text-blue-400",
  },
  predictive_prevention: {
    label: "Predictive Prevention",
    description:
      "Correlates anomaly patterns with historical data to predict problems 5-15 minutes before they manifest. Acts preemptively.",
    icon: TrendingUp,
    color: "text-purple-400",
  },
  escalation_handler: {
    label: "Escalation Handler",
    description:
      "Escalates critical alerts with cost impact estimates and AI-recommended resolution options ranked by impact.",
    icon: ShieldAlert,
    color: "text-red-400",
  },
  analytics: {
    label: "Analytics Agent",
    description:
      "Answers natural language queries about contact center operations using historical and real-time data.",
    icon: BarChart3,
    color: "text-green-400",
  },
};

export default function AgentsPage() {
  const decisions = useDashboardStore((s) => s.decisions);
  const negotiations = useDashboardStore((s) => s.negotiations);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold">Autonomous AI Agents</h2>
        <p className="text-sm text-gray-500">
          Four specialized agents observe, reason, and act on your contact center
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-4">
        {(Object.entries(agentInfo) as [AgentType, (typeof agentInfo)[AgentType]][]).map(
          ([type, info]) => {
            const agentDecisions = decisions.filter((d) => d.agentType === type);
            const Icon = info.icon;
            return (
              <div key={type} className="card">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      info.color.replace("text-", "bg-").replace("400", "400/15")
                    )}
                  >
                    <Icon className={clsx("h-5 w-5", info.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-200">{info.label}</h3>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">Active</span>
                      <span className="text-xs text-gray-500">
                        {agentDecisions.length} decisions
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mb-3 text-sm text-gray-400">{info.description}</p>

                {/* Recent decisions */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Recent Activity
                  </p>
                  {agentDecisions.length === 0 ? (
                    <p className="text-xs text-gray-600">No activity yet</p>
                  ) : (
                    agentDecisions.slice(0, 3).map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg bg-surface px-3 py-2 text-xs text-gray-400"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-300">{d.phase}</span>
                          {d.confidence != null && (
                            <span className={clsx(
                              "text-[10px] font-medium",
                              d.confidence >= 0.8 ? "text-green-400" :
                              d.confidence >= 0.5 ? "text-yellow-400" : "text-red-400"
                            )}>
                              {Math.round(d.confidence * 100)}%
                            </span>
                          )}
                          {d.approved === true && <span className="text-[10px] text-green-400">Approved</span>}
                          {d.approved === false && <span className="text-[10px] text-red-400">Rejected</span>}
                        </div>
                        {d.summary}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Negotiation Log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Negotiation Log</span>
          <span className="text-xs text-gray-500">
            {negotiations.length} negotiations
          </span>
        </div>
        {negotiations.length === 0 ? (
          <p className="text-sm text-gray-500">
            No inter-agent negotiations yet. Conflicts between agents will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {negotiations.map((neg) => (
              <div
                key={neg.id}
                className="rounded-lg border border-gray-800 bg-surface p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200">
                    {neg.topic}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(neg.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  {neg.proposals.map((p, i) => (
                    <div key={i}>
                      <span className="font-medium text-gray-300">
                        {agentInfo[p.agentType]?.label}:
                      </span>{" "}
                      {p.proposal} ({Math.round(p.confidence * 100)}% confidence)
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-gray-800 pt-2 text-xs text-accent-success">
                  Resolution: {neg.resolution}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
