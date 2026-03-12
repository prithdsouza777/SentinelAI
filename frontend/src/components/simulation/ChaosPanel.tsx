import { useState } from "react";
import { Flame, Skull, Zap, Globe } from "lucide-react";
import { simulationApi } from "../../services/api";
import type { ChaosEventType } from "../../types";

const chaosActions: {
  type: ChaosEventType;
  label: string;
  icon: typeof Flame;
  description: string;
}[] = [
  {
    type: "kill_agents",
    label: "Kill Agents",
    icon: Skull,
    description: "Remove N agents from a queue",
  },
  {
    type: "spike_queue",
    label: "Spike Queue",
    icon: Zap,
    description: "Inject N contacts into a queue",
  },
  {
    type: "network_delay",
    label: "Network Delay",
    icon: Globe,
    description: "Add latency to a queue",
  },
  {
    type: "cascade_failure",
    label: "Cascade Failure",
    icon: Flame,
    description: "Trigger a multi-queue cascade",
  },
];

export default function ChaosPanel() {
  const [sending, setSending] = useState<string | null>(null);

  const inject = async (type: ChaosEventType) => {
    setSending(type);
    try {
      await simulationApi.injectChaos({ type, params: {} });
    } catch (err) {
      console.error("Chaos injection failed:", err);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Chaos Engine</span>
        <Flame className="h-4 w-4 text-accent-danger" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {chaosActions.map((action) => (
          <button
            key={action.type}
            onClick={() => inject(action.type)}
            disabled={sending === action.type}
            className="flex flex-col items-center gap-1 rounded-lg border border-gray-800 bg-surface p-3 text-center transition-colors hover:border-accent-danger/50 hover:bg-accent-danger/5 disabled:opacity-50"
          >
            <action.icon className="h-5 w-5 text-accent-danger" />
            <span className="text-xs font-medium text-gray-300">
              {action.label}
            </span>
            <span className="text-xs text-gray-600">{action.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
