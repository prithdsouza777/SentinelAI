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
  BrainCircuit,
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { simulationApi } from "../services/api";
import { useDashboardStore } from "../stores/dashboardStore";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
  iconBg: string;
  borderColor: string;
  defaultParams: Record<string, unknown>;
}[] = [
  {
    type: "spike_queue",
    label: "Spike Queue",
    icon: Zap,
    description: "4x contact flood on Support",
    color: "text-[#f59e0b]",
    iconBg: "bg-[#f59e0b]/10",
    borderColor: "hover:border-[#f59e0b]/40",
    defaultParams: { queue_id: "q-support", multiplier: 4.0 },
  },
  {
    type: "kill_agents",
    label: "Kill Agents",
    icon: Skull,
    description: "5 agents offline from Support",
    color: "text-[#ef4444]",
    iconBg: "bg-[#ef4444]/10",
    borderColor: "hover:border-[#ef4444]/40",
    defaultParams: { queue_id: "q-support", agents_count: 5 },
  },
  {
    type: "cascade_failure",
    label: "Cascade",
    icon: Flame,
    description: "Cascade from Support",
    color: "text-[#f97316]",
    iconBg: "bg-[#f97316]/10",
    borderColor: "hover:border-[#f97316]/40",
    defaultParams: { source_queue: "q-support" },
  },
  {
    type: "network_delay",
    label: "Network Delay",
    icon: Globe,
    description: "5s latency all queues",
    color: "text-[#3b82f6]",
    iconBg: "bg-[#3b82f6]/10",
    borderColor: "hover:border-[#3b82f6]/40",
    defaultParams: { delay_ms: 5000 },
  },
];

export default function SimulationPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [chaosLoading, setChaosLoading] = useState<string | null>(null);
  const [chaosInjected, setChaosInjected] = useState<string | null>(null);
  const [showAllScenarios, setShowAllScenarios] = useState(false);
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const setSimulationActive = useDashboardStore((s) => s.setSimulationActive);
  const decisions = useDashboardStore((s) => s.decisions);
  const alerts = useDashboardStore((s) => s.alerts);
  const queues = useDashboardStore((s) => s.queues);

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

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");
  const totalContacts = queues.reduce((sum, q) => sum + q.contactsInQueue, 0);
  const actedDecisions = decisions.filter((d) => d.phase === "acted").length;
  const blockedDecisions = decisions.filter((d) => d.guardrailResult === "BLOCKED").length;

  // Build event log entries — prioritize decisions, deduplicate alerts by title
  const seenIds = new Set<string>();
  const seenAlertTitles = new Set<string>();
  const decisionEvents = decisions.slice(0, 25).map((d) => ({
    id: d.id,
    type: "decision" as const,
    time: d.timestamp,
    icon: BrainCircuit,
    label: d.agentType.replace(/_/g, " "),
    detail: d.summary,
    phase: d.phase,
    color:
      d.phase === "acted"
        ? "text-[#10b981]"
        : d.phase === "decided"
          ? "text-[#8b5cf6]"
          : "text-[#f59e0b]",
    bg:
      d.phase === "acted"
        ? "bg-[#10b981]/5"
        : d.phase === "decided"
          ? "bg-[#8b5cf6]/5"
          : "bg-transparent",
  }));
  // Deduplicate alerts by title (keep only the latest per title)
  const alertEvents = alerts.slice(0, 30)
    .filter((a) => {
      if (seenAlertTitles.has(a.title)) return false;
      seenAlertTitles.add(a.title);
      return true;
    })
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      type: "alert" as const,
      time: a.timestamp,
      icon: AlertTriangle,
      label: a.severity.toUpperCase(),
      detail: a.title,
      phase: a.severity,
      color:
        a.severity === "critical"
          ? "text-[#ef4444]"
          : a.severity === "warning"
            ? "text-[#f59e0b]"
            : "text-[#3b82f6]",
      bg: a.severity === "critical" ? "bg-[#ef4444]/5" : "bg-transparent",
    }));
  const eventLog = [...decisionEvents, ...alertEvents]
    .filter((e) => {
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 30);

  const otherScenarios = scenarios.filter((s) => !s.featured);


  // ─── IDLE MODE ───────────────────────────────────────────────────────────
  if (!simulationActive) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#1e293b]">Simulation Engine</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Run scenarios and inject chaos events to test AI agent responses in real time
          </p>
        </div>

        {/* Hero: Start Demo CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-[#8b5cf6]/20 bg-gradient-to-br from-[#8b5cf6]/5 via-white to-[#2563eb]/5 p-8"
        >
          <div className="relative z-10 flex items-center justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-[#8b5cf6]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#8b5cf6]">
                  Recommended
                </span>
              </div>
              <h3 className="text-2xl font-bold text-[#1e293b]">SentinelAI Demo</h3>
              <p className="mt-2 text-sm text-[#64748b] leading-relaxed">
                Scripted 3-minute showcase: calm operations → crisis storm → AI negotiation → autonomous resolution → intelligence debrief
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#94a3b8]">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> 3 minutes
                </span>
                <span className="flex items-center gap-1">
                  <BrainCircuit className="h-3.5 w-3.5" /> 5 AI agents
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> Guardrails active
                </span>
              </div>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => startScenario("sentinelai_demo")}
                className="h-16 gap-3 rounded-2xl bg-[#8b5cf6] px-10 text-lg font-bold text-white shadow-lg shadow-[#8b5cf6]/25 hover:bg-[#7c3aed]"
              >
                <Play className="h-6 w-6" />
                Start Demo
              </Button>
            </motion.div>
          </div>
          {/* Background decoration */}
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#8b5cf6]/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#2563eb]/5 blur-3xl" />
        </motion.div>

        <div className="grid grid-cols-2 gap-5">
          {/* Other Scenarios */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-[#2563eb]" />
                <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">
                  Other Scenarios
                </span>
              </div>
            </div>
            <div className="space-y-2 p-4">
              {otherScenarios.slice(0, showAllScenarios ? undefined : 3).map((scenario) => (
                <div
                  key={scenario.id}
                  className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 transition-all hover:bg-white hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1e293b]">{scenario.name}</p>
                    <p className="text-xs text-[#94a3b8]">{scenario.description} — {scenario.duration}s</p>
                  </div>
                  <Button
                    size="icon"
                    onClick={() => startScenario(scenario.id)}
                    className="ml-3 h-9 w-9 shrink-0 rounded-lg bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {otherScenarios.length > 3 && (
                <button
                  onClick={() => setShowAllScenarios(!showAllScenarios)}
                  className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-[#2563eb] hover:bg-[#2563eb]/5"
                >
                  {showAllScenarios ? (
                    <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                  ) : (
                    <>{otherScenarios.length - 3} more scenarios <ChevronDown className="h-3.5 w-3.5" /></>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Chaos Engine */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Flame className="h-5 w-5 text-[#ef4444]" />
                <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">
                  Chaos Engine
                </span>
              </div>
            </div>
            <p className="px-5 pt-3 text-xs text-[#64748b]">
              Inject live disruptions — auto-starts simulation if idle.
            </p>
            <div className="grid grid-cols-2 gap-3 p-4">
              {chaosActions.map((action) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.type}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => injectChaos(action.type)}
                    disabled={chaosLoading === action.type}
                    className={cn(
                      "flex w-full flex-col items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-center transition-all hover:bg-white hover:shadow-sm disabled:opacity-50",
                      action.borderColor
                    )}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", action.iconBg)}>
                      <Icon className={cn("h-5 w-5", action.color)} />
                    </div>
                    <span className="text-xs font-bold text-[#1e293b]">{action.label}</span>
                    <span className="text-[10px] leading-tight text-[#94a3b8]">{action.description}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Empty Event Log hint */}
        <div className="rounded-2xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] py-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-[#d1d5db]" />
          <p className="mt-3 text-sm font-medium text-[#94a3b8]">No simulation running</p>
          <p className="mt-1 text-xs text-[#cbd5e1]">Start a scenario above to see live AI decisions and alerts</p>
        </div>
      </div>
    );
  }

  // ─── ACTIVE MODE ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {/* Active Control Bar */}
      <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-[#10b981]/30 bg-gradient-to-r from-[#10b981]/5 via-white to-[#2563eb]/5 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10b981]/10">
          <Radio className="h-5 w-5 animate-pulse text-[#10b981]" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-bold text-[#10b981]">Simulation Active</span>
          <p className="text-xs text-[#64748b]">
            {scenarios.find((s) => s.id === activeScenario)?.name ?? "Custom Simulation"}
          </p>
        </div>

        {/* Live stats bar */}
        <div className="flex items-center gap-5">
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-[#1e293b]">{totalContacts}</p>
            <p className="text-[10px] font-medium text-[#94a3b8]">In Queue</p>
          </div>
          <div className="h-8 w-px bg-[#e2e8f0]" />
          <div className="text-center">
            <p className={cn("text-xl font-bold tabular-nums", criticalAlerts.length > 0 ? "text-[#ef4444]" : "text-[#1e293b]")}>
              {criticalAlerts.length}
            </p>
            <p className="text-[10px] font-medium text-[#94a3b8]">Critical</p>
          </div>
          <div className="h-8 w-px bg-[#e2e8f0]" />
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-[#1e293b]">{decisions.length}</p>
            <p className="text-[10px] font-medium text-[#94a3b8]">Decisions</p>
          </div>
          <div className="h-8 w-px bg-[#e2e8f0]" />
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-[#10b981]">{actedDecisions}</p>
            <p className="text-[10px] font-medium text-[#94a3b8]">Executed</p>
          </div>
          <div className="h-8 w-px bg-[#e2e8f0]" />
          <div className="text-center">
            <p className="text-xl font-bold tabular-nums text-[#ef4444]">{blockedDecisions}</p>
            <p className="text-[10px] font-medium text-[#94a3b8]">Blocked</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={stopScenario}
          className="ml-2 gap-2 rounded-xl bg-[#ef4444] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#dc2626]"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </Button>
      </div>

      {/* Main content: Event Log (big) + Chaos sidebar (compact) */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4 overflow-hidden">
        {/* Event Log — takes center stage */}
        <div className="col-span-9 flex min-h-0 flex-col rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-[#06b6d4]" />
              <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">
                Live Event Feed
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-[#10b981]/20 bg-[#10b981]/10 px-3 py-1 text-[11px] font-semibold text-[#10b981]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]" />
              {eventLog.length} events
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {eventLog.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Radio className="h-8 w-8 animate-pulse text-[#d1d5db]" />
                <p className="text-sm font-medium text-[#94a3b8]">Waiting for events...</p>
                <p className="text-xs text-[#cbd5e1]">AI agents are analyzing queue metrics</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {eventLog.map((event, i) => {
                  const Icon = event.icon;
                  return (
                    <motion.div
                      key={`${event.time}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[#f8fafc]",
                        event.bg
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        event.type === "decision" ? "bg-[#8b5cf6]/10" : "bg-[#ef4444]/10"
                      )}>
                        <Icon className={cn("h-4 w-4", event.color)} />
                      </div>
                      <span className="shrink-0 w-20 tabular-nums text-xs text-[#94a3b8]">
                        {new Date(event.time).toLocaleTimeString()}
                      </span>
                      <span className={cn("shrink-0 w-28 text-xs font-bold uppercase tracking-wide", event.color)}>
                        {event.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#475569]">{event.detail}</span>
                      {event.type === "decision" && (
                        <span className={cn(
                          "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                          event.phase === "acted"
                            ? "bg-[#10b981]/10 text-[#10b981]"
                            : event.phase === "decided"
                              ? "bg-[#8b5cf6]/10 text-[#8b5cf6]"
                              : "bg-[#f59e0b]/10 text-[#f59e0b]"
                        )}>
                          {event.phase}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chaos sidebar — compact when active */}
        <div className="col-span-3 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {/* Compact chaos buttons */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
              <Flame className="h-4 w-4 text-[#ef4444]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Chaos Engine
              </span>
            </div>
            <div className="space-y-2 p-3">
              {chaosActions.map((action) => {
                const Icon = action.icon;
                const isInjected = chaosInjected === action.type;
                return (
                  <motion.button
                    key={action.type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => injectChaos(action.type)}
                    disabled={chaosLoading === action.type}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-left transition-all hover:bg-white hover:shadow-sm disabled:opacity-50",
                      action.borderColor,
                      isInjected && "border-[#10b981]/40 bg-[#10b981]/5"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", action.iconBg)}>
                      <Icon className={cn("h-4 w-4", isInjected ? "text-[#10b981]" : action.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1e293b]">{action.label}</p>
                      <p className="text-[10px] text-[#94a3b8]">{action.description}</p>
                    </div>
                    {isInjected && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] font-bold text-[#10b981]"
                      >
                        Sent!
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Queue snapshot */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
              <Activity className="h-4 w-4 text-[#2563eb]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Queue Status
              </span>
            </div>
            <div className="divide-y divide-[#f1f5f9] px-3">
              {queues.map((q) => {
                const pressure = q.contactsInQueue / Math.max(q.agentsAvailable, 1);
                const isCritical = pressure > 3;
                const isWarning = pressure > 1.5;
                return (
                  <div key={q.queueId} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-[#1e293b]">{q.queueName}</p>
                      <p className="text-[10px] text-[#94a3b8]">
                        {q.agentsOnline} agents / {q.contactsInQueue} contacts
                      </p>
                    </div>
                    <span className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums",
                      isCritical
                        ? "bg-[#ef4444]/10 text-[#ef4444]"
                        : isWarning
                          ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                          : "bg-[#10b981]/10 text-[#10b981]"
                    )}>
                      {pressure.toFixed(1)}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
