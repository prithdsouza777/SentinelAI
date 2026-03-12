import { GitMerge } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

const agentColors: Record<string, string> = {
  queue_balancer: "text-blue-400",
  predictive_prevention: "text-purple-400",
  escalation_handler: "text-red-400",
  analytics: "text-green-400",
};

export default function AgentCollaborationPanel() {
  const negotiations = useDashboardStore((s) => s.negotiations);

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="card-header">
        <span className="card-title">Agent Collaboration</span>
        <GitMerge className="h-4 w-4 text-gray-500" />
      </div>

      <div className="flex-1 space-y-3 overflow-auto">
        {negotiations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <GitMerge className="h-8 w-8 text-gray-700" />
            <p className="text-sm text-gray-500">No negotiations yet</p>
            <p className="text-xs text-gray-600">Conflicts between agents will appear here</p>
          </div>
        ) : (
          negotiations.map((neg) => (
            <div
              key={neg.id}
              className="animate-fade-in rounded-lg border border-gray-800 bg-surface p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">
                  {neg.topic}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(neg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="space-y-1">
                {neg.proposals.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`font-medium ${agentColors[p.agentType] ?? "text-gray-400"}`}
                    >
                      {p.agentType.replace("_", " ")}:
                    </span>
                    <span className="text-gray-400">{p.proposal}</span>
                    <span className="ml-auto text-gray-600">
                      {Math.round(p.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-gray-800 pt-2 text-xs text-accent-success">
                Resolution: {neg.resolution}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
