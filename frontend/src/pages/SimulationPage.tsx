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
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { simulationApi } from "../services/api";
import { useDashboardStore } from "../stores/dashboardStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
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
  gradient: string;
  defaultParams: Record<string, unknown>;
}[] = [
  {
    type: "kill_agents",
    label: "Kill Agents",
    icon: Skull,
    description: "Take 5 agents offline from Support",
    color: "text-red-400",
    gradient: "from-red-500/20 to-rose-500/20",
    defaultParams: { queue_id: "q-support", agents_count: 5 },
  },
  {
    type: "spike_queue",
    label: "Spike Queue",
    icon: Zap,
    description: "4x contact flood on Support queue",
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-yellow-500/20",
    defaultParams: { queue_id: "q-support", multiplier: 4.0 },
  },
  {
    type: "network_delay",
    label: "Network Delay",
    icon: Globe,
    description: "Add 5s latency to all queues",
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-cyan-500/20",
    defaultParams: { delay_ms: 5000 },
  },
  {
    type: "cascade_failure",
    label: "Cascade Failure",
    icon: Flame,
    description: "Trigger cascade from Support queue",
    color: "text-orange-400",
    gradient: "from-orange-500/20 to-red-500/20",
    defaultParams: { source_queue: "q-support" },
  },
];

export default function SimulationPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [chaosLoading, setChaosLoading] = useState<string | null>(null);
  const [chaosInjected, setChaosInjected] = useState<string | null>(null);
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
      // Auto-start simulation if not running (chaos needs active simulation)
      if (!simulationActive) {
        await simulationApi.start("normal");
        setActiveScenario("normal");
        setSimulationActive(true);
      }
      const action = chaosActions.find((a) => a.type === type);
      await simulationApi.injectChaos({ type, params: action?.defaultParams ?? {} });
      setChaosInjected(type);
      setTimeout(() => setChaosInjected(null), 2000);
    } finally {
      setChaosLoading(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Simulation Engine</h2>
        <p className="text-sm text-muted-foreground">
          Run scenarios and inject chaos events to test AI agent responses in real time
        </p>
      </div>

      {/* Active simulation banner */}
      <AnimatePresence>
        {simulationActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-sm">
              <Radio className="h-4 w-4 animate-pulse text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Simulation Active</span>
              <span className="text-sm text-muted-foreground">
                {scenarios.find((s) => s.id === activeScenario)?.name}
              </span>
              <Button
                size="sm"
                onClick={stopScenario}
                className="ml-auto h-7 bg-red-500/15 text-[11px] text-red-400 hover:bg-red-500/25"
              >
                <Square className="mr-1 h-3 w-3" />
                Stop
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4">
        {/* Scenarios */}
        <div className="rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Scenarios
              </span>
            </div>
          </div>
          <div className="space-y-2 p-3">
            {scenarios.map((scenario) => (
              <motion.div
                key={scenario.id}
                whileHover={{ scale: 1.01 }}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 transition-all",
                  activeScenario === scenario.id
                    ? "border-blue-500/30 bg-blue-500/5"
                    : scenario.featured
                      ? "border-purple-500/20 bg-purple-500/5"
                      : "border-white/[0.06] bg-white/[0.02]"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{scenario.name}</p>
                    {scenario.featured && (
                      <span className="flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-purple-400">
                        <Sparkles className="h-2.5 w-2.5" />
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{scenario.description}</p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/50">
                    Duration: {scenario.duration}s
                  </p>
                </div>
                <Button
                  size="icon"
                  onClick={() =>
                    activeScenario === scenario.id ? stopScenario() : startScenario(scenario.id)
                  }
                  className={cn(
                    "ml-3 h-8 w-8 shrink-0",
                    activeScenario === scenario.id
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                  )}
                >
                  {activeScenario === scenario.id ? (
                    <Square className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Chaos Engine */}
        <div className="rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chaos Engine
              </span>
            </div>
          </div>
          <p className="px-3 pt-3 text-[11px] text-muted-foreground/70">
            Inject live disruptions. AI agents will respond in real time.
          </p>
          <div className="grid grid-cols-2 gap-3 p-3">
            {chaosActions.map((action) => {
              const Icon = action.icon;
              return (
                <SpotlightCard key={action.type} className="rounded-xl border border-white/[0.06] p-0">
                  <button
                    onClick={() => injectChaos(action.type)}
                    disabled={chaosLoading === action.type}
                    className="flex w-full flex-col items-center gap-2 rounded-xl p-4 text-center transition-all hover:bg-white/[0.02] disabled:opacity-50"
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br", action.gradient)}>
                      <Icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <span className="text-xs font-medium text-foreground">{action.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">{action.description}</span>
                    {chaosInjected === action.type && (
                      <span className="text-[10px] font-semibold text-emerald-400 animate-fade-in">Injected!</span>
                    )}
                  </button>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm" style={{ maxHeight: "300px" }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Simulation Event Log
            </span>
          </div>
          {simulationActive && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Live
            </span>
          )}
        </div>
        <ScrollArea className="flex-1 p-3" style={{ maxHeight: "240px" }}>
          {!simulationActive && decisions.length === 0 && alerts.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground/50">
              Start a scenario to see events in real time.
            </div>
          ) : (
            <div className="space-y-1">
              {[
                ...decisions.slice(0, 15).map((d) => ({
                  type: "decision" as const,
                  time: d.timestamp,
                  label: `[${d.agentType.replace("_", " ")}] ${d.summary}`,
                  color:
                    d.phase === "decided"
                      ? "text-purple-400"
                      : d.phase === "acted"
                        ? "text-emerald-400"
                        : "text-amber-400",
                })),
                ...alerts.slice(0, 10).map((a) => ({
                  type: "alert" as const,
                  time: a.timestamp,
                  label: `[${a.severity.toUpperCase()}] ${a.title}`,
                  color:
                    a.severity === "critical"
                      ? "text-red-400"
                      : a.severity === "warning"
                        ? "text-amber-400"
                        : "text-blue-400",
                })),
              ]
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                .slice(0, 20)
                .map((event, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-start gap-2 text-[11px]"
                  >
                    <span className="shrink-0 tabular-nums text-muted-foreground/50">
                      {new Date(event.time).toLocaleTimeString()}
                    </span>
                    <span className={event.color}>{event.label}</span>
                  </motion.div>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
