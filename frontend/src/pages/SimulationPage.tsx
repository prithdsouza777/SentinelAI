import { useState, useEffect } from "react";
import {
  Play,
  Square,
  Flame,
  Skull,
  Zap,
  Globe,
  Radio,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { simulationApi } from "../services/api";
import { useDashboardStore } from "../stores/dashboardStore";
import type { ChaosEventType } from "../types";

interface Scenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  featured?: boolean;
}

const chaosActions: {
  type: ChaosEventType;
  label: string;
  icon: typeof Flame;
  description: string;
  color: string;
  defaultParams: Record<string, unknown>;
}[] = [
  {
    type: "kill_agents",
    label: "Kill Agents",
    icon: Skull,
    description: "Take 5 agents offline from Support",
    color: "text-red-400",
    defaultParams: { queue_id: "q-support", agents_count: 5 },
  },
  {
    type: "spike_queue",
    label: "Spike Queue",
    icon: Zap,
    description: "4x contact flood on Support queue",
    color: "text-yellow-400",
    defaultParams: { queue_id: "q-support", multiplier: 4.0 },
  },
  {
    type: "network_delay",
    label: "Network Delay",
    icon: Globe,
    description: "Add 5s latency to all queues",
    color: "text-blue-400",
    defaultParams: { delay_ms: 5000 },
  },
  {
    type: "cascade_failure",
    label: "Cascade Failure",
    icon: Flame,
    description: "Trigger cascade from Support queue",
    color: "text-orange-400",
    defaultParams: { source_queue: "q-support" },
  },
];

export default function SimulationPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [chaosLoading, setChaosLoading] = useState<string | null>(null);
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const setSimulationActive = useDashboardStore((s) => s.setSimulationActive);
  const decisions = useDashboardStore((s) => s.decisions);
  const alerts = useDashboardStore((s) => s.alerts);

  useEffect(() => {
    simulationApi.listScenarios().then((data) => {
      setScenarios((data as { scenarios: Scenario[] }).scenarios);
    });
  }, []);

  const startScenario = async (id: string) => {
    await simulationApi.start(id);
    setActiveScenario(id);
    setSimulationActive(true);
  };

  const stopScenario = async () => {
    await simulationApi.stop();
    setActiveScenario(null);
    setSimulationActive(false);
  };

  const injectChaos = async (type: ChaosEventType) => {
    setChaosLoading(type);
    try {
      const action = chaosActions.find((a) => a.type === type);
      await simulationApi.injectChaos({ type, params: action?.defaultParams ?? {} });
    } finally {
      setChaosLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold">Simulation Engine</h2>
        <p className="text-sm text-gray-500">
          Run scenarios and inject chaos events to test AI agent responses in
          real time
        </p>
      </div>

      {/* Status bar */}
      {simulationActive && (
        <div className="flex items-center gap-3 rounded-xl border border-accent-warning/30 bg-accent-warning/5 px-4 py-3">
          <Radio className="h-4 w-4 animate-pulse text-accent-warning" />
          <span className="text-sm font-medium text-accent-warning">
            Simulation Active
          </span>
          <span className="text-sm text-gray-400">
            Scenario: {scenarios.find((s) => s.id === activeScenario)?.name}
          </span>
          <button
            onClick={stopScenario}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent-danger/15 px-3 py-1.5 text-xs font-medium text-accent-danger transition-colors hover:bg-accent-danger/25"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Scenarios */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Scenarios</span>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="space-y-2">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={clsx(
                  "flex items-center justify-between rounded-lg border bg-surface p-3 transition-colors",
                  activeScenario === scenario.id
                    ? "border-brand-500/50"
                    : scenario.featured
                      ? "border-brand-600/30 bg-brand-600/5"
                      : "border-gray-800"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-200">
                      {scenario.name}
                    </p>
                    {scenario.featured && (
                      <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-400">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {scenario.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Duration: {scenario.duration}s
                  </p>
                </div>
                <button
                  onClick={() =>
                    activeScenario === scenario.id
                      ? stopScenario()
                      : startScenario(scenario.id)
                  }
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    activeScenario === scenario.id
                      ? "bg-accent-danger/15 text-accent-danger hover:bg-accent-danger/25"
                      : "bg-brand-600/15 text-brand-400 hover:bg-brand-600/25"
                  )}
                >
                  {activeScenario === scenario.id ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chaos Engine */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Chaos Engine</span>
            <Flame className="h-4 w-4 text-accent-danger" />
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Inject live disruptions. AI agents will respond in real time.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {chaosActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.type}
                  onClick={() => injectChaos(action.type)}
                  disabled={chaosLoading === action.type}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-surface p-4 text-center transition-all hover:border-accent-danger/40 hover:bg-accent-danger/5 disabled:opacity-50"
                >
                  <Icon className={clsx("h-6 w-6", action.color)} />
                  <span className="text-sm font-medium text-gray-300">
                    {action.label}
                  </span>
                  <span className="text-xs text-gray-600">
                    {action.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="card flex flex-col" style={{ maxHeight: "300px" }}>
        <div className="card-header">
          <span className="card-title">Simulation Event Log</span>
          {simulationActive && (
            <span className="flex items-center gap-1.5 text-xs text-accent-warning">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex-1 space-y-1 overflow-auto">
          {!simulationActive && decisions.length === 0 && alerts.length === 0 ? (
            <div className="text-sm text-gray-500">
              Start a scenario to see events in real time.
            </div>
          ) : (
            [...decisions.slice(0, 15).map((d) => ({
              type: "decision" as const,
              time: d.timestamp,
              label: `[${d.agentType.replace("_", " ")}] ${d.summary}`,
              color: d.phase === "decided" ? "text-purple-400" : d.phase === "acted" ? "text-green-400" : "text-yellow-400",
            })),
            ...alerts.slice(0, 10).map((a) => ({
              type: "alert" as const,
              time: a.timestamp,
              label: `[${a.severity.toUpperCase()}] ${a.title}`,
              color: a.severity === "critical" ? "text-red-400" : a.severity === "warning" ? "text-yellow-400" : "text-blue-400",
            }))]
              .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
              .slice(0, 20)
              .map((event, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 text-gray-600">
                    {new Date(event.time).toLocaleTimeString()}
                  </span>
                  <span className={event.color}>{event.label}</span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
