import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Star,
  Shield,
  Zap,
  X,
  LayoutGrid,
  List,
  Scale,
  TrendingUp,
  ShieldAlert,
  MessageCircle,
  Activity,
  BrainCircuit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkforceStore } from "@/stores/workforceStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import AgentChatDrawer from "@/components/workforce/AgentChatDrawer";
import type { HumanAgentProfile, DepartmentFitness } from "@/types";

const DEPARTMENTS = [
  { id: "", label: "All Departments" },
  { id: "q-support", label: "Support", color: "#3b82f6" },
  { id: "q-billing", label: "Billing", color: "#f59e0b" },
  { id: "q-sales", label: "Sales", color: "#22c55e" },
  { id: "q-general", label: "General", color: "#8b5cf6" },
  { id: "q-vip", label: "VIP", color: "#ef4444" },
];

const DEPT_COLORS: Record<string, string> = {
  "q-support": "#3b82f6",
  "q-billing": "#f59e0b",
  "q-sales": "#22c55e",
  "q-general": "#8b5cf6",
  "q-vip": "#ef4444",
};

interface StatusInfo { color: string; bg: string; label: string; dot: string }
interface RoleInfo { color: string; icon: typeof Star }

const DEFAULT_STATUS: StatusInfo = { color: "text-[#10b981]", bg: "bg-[#10b981]/10", label: "Available", dot: "bg-[#10b981]" };
const DEFAULT_ROLE: RoleInfo = { color: "text-[#3b82f6]", icon: Shield };

const STATUS_CONFIG: Record<string, StatusInfo> = {
  available: { color: "text-[#10b981]", bg: "bg-[#10b981]/10", label: "Available", dot: "bg-[#10b981]" },
  busy: { color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", label: "Busy", dot: "bg-[#f59e0b]" },
  on_break: { color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", label: "On Break", dot: "bg-[#ef4444]" },
};

const ROLE_BADGE: Record<string, RoleInfo> = {
  senior: { color: "text-[#f59e0b]", icon: Star },
  mid: { color: "text-[#3b82f6]", icon: Shield },
  junior: { color: "text-[#94a3b8]", icon: Zap },
};

function ProficiencyBar({ value, label, compact }: { value: number; label: string; compact?: boolean }) {
  const color =
    value >= 0.7 ? "bg-[#10b981]" : value >= 0.4 ? "bg-[#f59e0b]" : value >= 0.15 ? "bg-[#ef4444]/70" : "bg-[#e2e8f0]";
  const width = Math.max(value * 100, 2);

  return (
    <div className={cn("flex items-center gap-2", compact ? "gap-1.5" : "gap-2")}>
      <span
        className={cn(
          "shrink-0 text-right text-[#64748b]",
          compact ? "w-[90px] text-[10px]" : "w-[120px] text-xs"
        )}
      >
        {label.replace(/_/g, " ")}
      </span>
      <div className={cn("flex-1 rounded-full bg-[#e2e8f0]", compact ? "h-1.5" : "h-2")}>
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className={cn("shrink-0 font-mono", compact ? "w-8 text-[10px] text-[#94a3b8]" : "w-10 text-xs text-[#64748b]")}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function DeptScoreBadge({ dept }: { dept: DepartmentFitness }) {
  const color = DEPT_COLORS[dept.departmentId] || "#6b7280";
  const score = dept.fitnessScore;
  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-2 py-1"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}
    >
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-medium text-[#475569]">{dept.departmentName}</span>
      <span className="ml-auto text-[11px] font-bold" style={{ color }}>
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function AgentCard({
  agent,
  isSelected,
  onClick,
}: {
  agent: HumanAgentProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status: StatusInfo = STATUS_CONFIG[agent.status] ?? DEFAULT_STATUS;
  const role: RoleInfo = ROLE_BADGE[agent.role] ?? DEFAULT_ROLE;
  const RoleIcon = role.icon;
  const isRelocated = agent.currentQueueId !== agent.homeQueueId;
  const currentDept = agent.currentQueueId.replace("q-", "");
  const homeDept = agent.homeQueueId.replace("q-", "");
  const deptColor = DEPT_COLORS[agent.currentQueueId] || "#6b7280";

  // Top 3 skills
  const topSkills = [...agent.skillProficiencies]
    .sort((a, b) => b.proficiency - a.proficiency)
    .slice(0, 3);

  // Best dept fitness
  const bestDept = [...agent.departmentScores].sort((a, b) => b.fitnessScore - a.fitnessScore)[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-sm",
        isSelected
          ? "border-[#2563eb]/30 bg-[#2563eb]/5 shadow-md"
          : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:shadow-md"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: `${deptColor}30`, color: deptColor, border: `2px solid ${deptColor}` }}
          >
            {agent.name[0]}
            {/* Status dot */}
            <div
              className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white", status.dot)}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1e293b]">{agent.name}</span>
              <RoleIcon className={cn("h-3.5 w-3.5", role.color)} />
              <span className="text-[10px] font-medium uppercase text-[#94a3b8]">{agent.role}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[11px] font-medium capitalize"
                style={{ color: deptColor }}
              >
                {currentDept}
              </span>
              {isRelocated && (
                <span className="flex items-center gap-0.5 text-[10px] text-[#f59e0b]">
                  <ArrowRightLeft className="h-2.5 w-2.5" />
                  from {homeDept}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.bg, status.color)}>
          {status.label}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="mt-3 flex items-center gap-3">
        {/* Performance */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#94a3b8]">Perf</span>
          <span className="text-xs font-bold text-[#475569]">{(agent.perfScore * 100).toFixed(0)}%</span>
        </div>
        <div className="h-3 w-px bg-[#e2e8f0]" />
        {/* Best fit */}
        {bestDept && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#94a3b8]">Best fit</span>
            <span className="text-xs font-bold" style={{ color: DEPT_COLORS[bestDept.departmentId] || "#475569" }}>
              {bestDept.departmentName} {(bestDept.fitnessScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
        <div className="h-3 w-px bg-[#e2e8f0]" />
        {/* Top skills mini */}
        <div className="flex items-center gap-1 overflow-hidden">
          {topSkills.map((s) => (
            <span
              key={s.skillName}
              className="whitespace-nowrap rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] text-[#64748b]"
            >
              {s.skillName.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      </div>

      {/* Expand indicator */}
      <div className="mt-2 flex justify-center">
        {isSelected ? (
          <ChevronDown className="h-3.5 w-3.5 text-[#2563eb]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[#cbd5e1] group-hover:text-[#94a3b8] transition-colors" />
        )}
      </div>
    </motion.div>
  );
}

function AgentDetail({ agent }: { agent: HumanAgentProfile }) {
  const sortedSkills = [...agent.skillProficiencies].sort((a, b) => b.proficiency - a.proficiency);
  const sortedDepts = [...agent.departmentScores].sort((a, b) => b.fitnessScore - a.fitnessScore);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-5 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-3">
              Skill Proficiencies
            </h4>
            <div className="space-y-1.5">
              {sortedSkills.map((s) => (
                <ProficiencyBar key={s.skillName} value={s.proficiency} label={s.skillName} compact />
              ))}
            </div>
          </div>

          {/* Department Fitness */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-3">
              Department Fitness Scores
            </h4>
            <div className="space-y-2">
              {sortedDepts.map((d) => (
                <div key={d.departmentId}>
                  <ProficiencyBar
                    value={d.fitnessScore}
                    label={d.departmentName}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {sortedDepts.map((d) => (
                <DeptScoreBadge key={d.departmentId} dept={d} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Department Map View ─────────────────────────────────────────────── */

const DEPT_ORDER = ["q-support", "q-billing", "q-sales", "q-general", "q-vip"] as const;

const DEPT_META: Record<string, { label: string; color: string; gradient: string }> = {
  "q-support": { label: "Support", color: "#3b82f6", gradient: "from-[#3b82f6]/8 to-[#3b82f6]/2" },
  "q-billing": { label: "Billing", color: "#f59e0b", gradient: "from-[#f59e0b]/8 to-[#f59e0b]/2" },
  "q-sales":   { label: "Sales",   color: "#22c55e", gradient: "from-[#22c55e]/8 to-[#22c55e]/2" },
  "q-general": { label: "General", color: "#8b5cf6", gradient: "from-[#8b5cf6]/8 to-[#8b5cf6]/2" },
  "q-vip":     { label: "VIP",     color: "#ef4444", gradient: "from-[#ef4444]/8 to-[#ef4444]/2" },
};

function DeptAgentBubble({
  agent,
  color,
  index,
  onClick,
  isSelected,
  onChat,
}: {
  agent: HumanAgentProfile;
  color: string;
  index: number;
  onClick: () => void;
  isSelected: boolean;
  onChat?: (agent: HumanAgentProfile) => void;
}) {
  const status: StatusInfo = STATUS_CONFIG[agent.status] ?? DEFAULT_STATUS;
  const role: RoleInfo = ROLE_BADGE[agent.role] ?? DEFAULT_ROLE;
  const RoleIcon = role.icon;
  const isRelocated = agent.currentQueueId !== agent.homeQueueId;

  // Deterministic "idle drift" per agent using index as seed
  const floatDelay = (index * 0.7) % 3;
  const floatDuration = 3 + (index % 3);

  return (
    <motion.div
      layoutId={`dept-agent-${agent.id}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -4, 0, 3, 0],
      }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{
        layout: { type: "spring", stiffness: 200, damping: 25 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
        y: {
          duration: floatDuration,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay,
        },
      }}
      onClick={onClick}
      className={cn(
        "group/bubble relative flex cursor-pointer flex-col items-center gap-1 rounded-xl p-2 transition-all",
        isSelected
          ? "bg-white/80 shadow-md ring-2"
          : "hover:bg-white/60 hover:shadow-sm"
      )}
      style={isSelected ? { outlineColor: color, outlineWidth: 2, outlineStyle: "solid" } as React.CSSProperties : undefined}
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-transform group-hover/bubble:scale-110"
          style={{
            backgroundColor: `${color}20`,
            color: color,
            border: `2px solid ${color}`,
          }}
        >
          {agent.name[0]}
        </div>
        {/* Status indicator */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
            status.dot
          )}
        />
        {/* Relocated badge */}
        {isRelocated && (
          <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b] shadow-sm">
            <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Name + role */}
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-semibold text-[#1e293b] leading-tight">
          {agent.name}
        </span>
        <div className="flex items-center gap-0.5">
          <RoleIcon className={cn("h-2.5 w-2.5", role.color)} />
          <span className="text-[9px] uppercase text-[#94a3b8]">{agent.role}</span>
        </div>
      </div>

      {/* Chat button on hover */}
      {onChat && (
        <div
          className="absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 opacity-0 transition-all group-hover/bubble:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onChat(agent);
          }}
        >
          <div
            className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: color }}
          >
            <MessageCircle className="h-2.5 w-2.5" />
            Chat
          </div>
        </div>
      )}

      {/* Hover tooltip: perf + top skill */}
      <div className="pointer-events-none absolute -top-16 left-1/2 z-20 -translate-x-1/2 opacity-0 transition-opacity group-hover/bubble:opacity-100">
        <div className="whitespace-nowrap rounded-lg bg-[#1e293b] px-3 py-2 text-[10px] text-white shadow-lg">
          <div className="font-semibold">{agent.name}</div>
          <div className="text-[#94a3b8]">
            Perf: {(agent.perfScore * 100).toFixed(0)}% &middot;{" "}
            {agent.skillProficiencies
              .slice()
              .sort((a, b) => b.proficiency - a.proficiency)[0]
              ?.skillName?.replace(/_/g, " ")}
          </div>
          {isRelocated && (
            <div className="text-[#f59e0b]">
              Home: {agent.homeQueueId.replace("q-", "")}
            </div>
          )}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1e293b]" />
        </div>
      </div>
    </motion.div>
  );
}

function DeptAgentDetail({
  agent,
  onChat,
}: {
  agent: HumanAgentProfile;
  onChat?: (agent: HumanAgentProfile) => void;
}) {
  const sortedSkills = [...agent.skillProficiencies].sort((a, b) => b.proficiency - a.proficiency);
  const sortedDepts = [...agent.departmentScores].sort((a, b) => b.fitnessScore - a.fitnessScore);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-[#1e293b]">{agent.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#94a3b8]">
              Perf {(agent.perfScore * 100).toFixed(0)}%
            </span>
            {onChat && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChat(agent);
                }}
                className="flex items-center gap-1 rounded-lg border border-[#2563eb]/20 bg-[#2563eb]/5 px-2.5 py-1 text-[10px] font-semibold text-[#2563eb] transition-all hover:bg-[#2563eb]/10"
              >
                <MessageCircle className="h-3 w-3" />
                Talk to {agent.name}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-1.5">
              Top Skills
            </h4>
            <div className="space-y-1">
              {sortedSkills.slice(0, 5).map((s) => (
                <ProficiencyBar key={s.skillName} value={s.proficiency} label={s.skillName} compact />
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-1.5">
              Dept Fitness
            </h4>
            <div className="space-y-1">
              {sortedDepts.map((d) => (
                <ProficiencyBar key={d.departmentId} value={d.fitnessScore} label={d.departmentName} compact />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DepartmentMapView({
  agents,
  onChatWithAgent,
}: {
  agents: HumanAgentProfile[];
  onChatWithAgent?: (agent: HumanAgentProfile) => void;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const queues = useDashboardStore((s) => s.queues);

  // Group agents by current department
  const grouped = useMemo(() => {
    const map: Record<string, HumanAgentProfile[]> = {};
    for (const dept of DEPT_ORDER) map[dept] = [];
    for (const agent of agents) {
      const q = agent.currentQueueId;
      if (map[q]) map[q].push(agent);
      else map[q] = [agent];
    }
    // Sort each group by role priority then name
    const rolePriority: Record<string, number> = { senior: 0, mid: 1, junior: 2 };
    for (const q of Object.keys(map)) {
      map[q]?.sort((a, b) => (rolePriority[a.role] ?? 3) - (rolePriority[b.role] ?? 3) || a.name.localeCompare(b.name));
    }
    return map;
  }, [agents]);

  const selectedAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {DEPT_ORDER.map((deptId) => {
        const meta = DEPT_META[deptId]!;
        const deptAgents = grouped[deptId] || [];
        const relocatedIn = deptAgents.filter((a) => a.homeQueueId !== deptId).length;

            const queueMetrics = queues.find((q) => q.queueId === deptId);

        return (
          <motion.div
            key={deptId}
            layout
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-4 transition-all",
              meta.gradient
            )}
            style={{
              borderColor: `${meta.color}30`,
            }}
          >
            {/* Department header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shadow-sm"
                  style={{ backgroundColor: meta.color }}
                />
                <h3 className="text-sm font-bold text-[#1e293b]">{meta.label}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${meta.color}15`,
                    color: meta.color,
                  }}
                >
                  {deptAgents.length} agents
                </span>
                {relocatedIn > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-[#f59e0b]/10 px-2 py-0.5 text-[10px] font-medium text-[#f59e0b]">
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    {relocatedIn} temp
                  </span>
                )}
              </div>
            </div>

            {/* Queue metrics row */}
            {queueMetrics && (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#e2e8f0]/60 bg-white/60 px-3 py-2">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-medium uppercase text-[#94a3b8]">In Queue</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    queueMetrics.contactsInQueue > 10 ? "text-[#ef4444]" :
                    queueMetrics.contactsInQueue > 5 ? "text-[#f59e0b]" : "text-[#1e293b]"
                  )}>
                    {queueMetrics.contactsInQueue}
                  </span>
                </div>
                <div className="h-6 w-px bg-[#e2e8f0]" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-medium uppercase text-[#94a3b8]">Wait</span>
                  <span className="text-sm font-bold tabular-nums text-[#1e293b]">
                    {queueMetrics.avgWaitTime.toFixed(0)}s
                  </span>
                </div>
                <div className="h-6 w-px bg-[#e2e8f0]" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-medium uppercase text-[#94a3b8]">SLA</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    queueMetrics.serviceLevel >= 80 ? "text-[#10b981]" :
                    queueMetrics.serviceLevel >= 60 ? "text-[#f59e0b]" : "text-[#ef4444]"
                  )}>
                    {queueMetrics.serviceLevel.toFixed(0)}%
                  </span>
                </div>
                <div className="h-6 w-px bg-[#e2e8f0]" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-medium uppercase text-[#94a3b8]">Abandon</span>
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    queueMetrics.abandonmentRate > 15 ? "text-[#ef4444]" :
                    queueMetrics.abandonmentRate > 8 ? "text-[#f59e0b]" : "text-[#10b981]"
                  )}>
                    {queueMetrics.abandonmentRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Capacity bar */}
            <div className="mb-3 h-1 w-full rounded-full bg-[#e2e8f0]">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: meta.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((deptAgents.length / 8) * 100, 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            {/* Agent bubbles grid */}
            <div className="flex min-h-[80px] flex-wrap gap-x-1 gap-y-6 justify-center pb-4">
              <AnimatePresence mode="popLayout">
                {deptAgents.map((agent, i) => (
                  <DeptAgentBubble
                    key={agent.id}
                    agent={agent}
                    color={meta.color}
                    index={i}
                    isSelected={selectedAgentId === agent.id}
                    onClick={() =>
                      setSelectedAgentId(
                        selectedAgentId === agent.id ? null : agent.id
                      )
                    }
                    onChat={onChatWithAgent}
                  />
                ))}
              </AnimatePresence>
              {deptAgents.length === 0 && (
                <div className="flex h-20 w-full items-center justify-center text-[11px] text-[#94a3b8]">
                  No agents assigned
                </div>
              )}
            </div>

            {/* Selected agent detail panel (inline) */}
            <AnimatePresence>
              {selectedAgent && selectedAgent.currentQueueId === deptId && (
                <DeptAgentDetail agent={selectedAgent} onChat={onChatWithAgent} />
              )}
            </AnimatePresence>

            {/* Subtle background decoration */}
            <div
              className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full opacity-[0.04]"
              style={{ backgroundColor: meta.color }}
            />
          </motion.div>
        );
      })}

      {/* Legend card */}
      <motion.div
        layout
        className="flex flex-col justify-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white/50 p-4"
      >
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          Legend
        </h4>
        <div className="space-y-2 text-[11px] text-[#64748b]">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
            <span>On Break</span>
          </div>
          <div className="my-1 h-px bg-[#e2e8f0]" />
          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f59e0b]">
              <ArrowRightLeft className="h-2.5 w-2.5 text-white" />
            </div>
            <span>Relocated from home dept</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-3 w-3 text-[#f59e0b]" />
            <span>Senior</span>
            <Shield className="ml-2 h-3 w-3 text-[#3b82f6]" />
            <span>Mid</span>
            <Zap className="ml-2 h-3 w-3 text-[#94a3b8]" />
            <span>Junior</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function WorkforcePage() {
  const {
    agents,
    loading,
    error,
    selectedAgent,
    searchQuery,
    departmentFilter,
    fetchAgents,
    setSelectedAgent,
    setSearchQuery,
    setDepartmentFilter,
    setStatusFilter,
    statusFilter,
    getFilteredAgents,
  } = useWorkforceStore();

  const [sortBy, setSortBy] = useState<"name" | "perf" | "fitness">("name");
  const [viewMode, setViewMode] = useState<"list" | "department">("department");
  const [chatAgent, setChatAgent] = useState<{
    id: string;
    name: string;
    type: "ai" | "human";
    color: string;
  } | null>(null);

  const decisions = useDashboardStore((s) => s.decisions);

  useEffect(() => {
    fetchAgents();
    // Refresh every 10s to pick up moves
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const filtered = getFilteredAgents();

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "perf") return b.perfScore - a.perfScore;
    // fitness: sort by best dept score
    const aMax = Math.max(...a.departmentScores.map((d) => d.fitnessScore));
    const bMax = Math.max(...b.departmentScores.map((d) => d.fitnessScore));
    return bMax - aMax;
  });

  // Stats
  const totalAgents = agents.length;
  const availableCount = agents.filter((a) => a.status === "available").length;
  const relocatedCount = agents.filter((a) => a.currentQueueId !== a.homeQueueId).length;
  const deptCounts: Record<string, number> = {};
  agents.forEach((a) => {
    const dept = a.currentQueueId;
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1e293b]">Workforce</h2>
          <p className="mt-1 text-sm text-[#64748b]">
            Agent proficiencies & department fitness scores
          </p>
        </div>
        {/* Summary pills + view toggle */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs shadow-sm">
            <span className="text-[#94a3b8]">Total</span>{" "}
            <span className="font-bold text-[#1e293b]">{totalAgents}</span>
          </div>
          <div className="rounded-lg border border-[#10b981]/20 bg-[#10b981]/5 px-3 py-1.5 text-xs">
            <span className="text-[#10b981]/70">Available</span>{" "}
            <span className="font-bold text-[#10b981]">{availableCount}</span>
          </div>
          {relocatedCount > 0 && (
            <div className="rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-3 py-1.5 text-xs">
              <span className="text-[#f59e0b]/70">Relocated</span>{" "}
              <span className="font-bold text-[#f59e0b]">{relocatedCount}</span>
            </div>
          )}
          {/* View toggle */}
          <div className="ml-2 flex items-center gap-0.5 rounded-lg border border-[#e2e8f0] bg-white p-0.5">
            <button
              onClick={() => setViewMode("department")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                viewMode === "department"
                  ? "bg-[#2563eb] text-white shadow-sm"
                  : "text-[#94a3b8] hover:text-[#64748b]"
              )}
            >
              <LayoutGrid className="h-3 w-3" />
              Departments
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                viewMode === "list"
                  ? "bg-[#2563eb] text-white shadow-sm"
                  : "text-[#94a3b8] hover:text-[#64748b]"
              )}
            >
              <List className="h-3 w-3" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Department Map View */}
      {viewMode === "department" && (
        loading && agents.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#ef4444]">{error}</div>
        ) : (
          <DepartmentMapView
            agents={agents}
            onChatWithAgent={(agent) =>
              setChatAgent({
                id: agent.id,
                name: agent.name,
                type: "human",
                color: DEPT_COLORS[agent.currentQueueId] || "#6b7280",
              })
            }
          />
        )
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Department quick-filter bar */}
          <div className="flex items-center gap-2">
            {DEPARTMENTS.map((dept) => {
              const isActive = departmentFilter === dept.id;
              const count = dept.id ? deptCounts[dept.id] || 0 : totalAgents;
              return (
                <button
                  key={dept.id}
                  onClick={() => setDepartmentFilter(isActive ? "" : dept.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "bg-[#2563eb] text-white shadow-sm"
                      : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]"
                  )}
                >
                  {dept.color && (
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: dept.color }}
                    />
                  )}
                  {dept.label}
                  <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search agents by name or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] bg-white py-2 pl-9 pr-8 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#94a3b8] hover:text-[#64748b]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white p-0.5">
              {["", "available", "busy", "on_break"].map((s) => {
                const label = s ? (STATUS_CONFIG[s]?.label || s) : "All";
                const isActive = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                      isActive
                        ? "bg-[#f1f5f9] text-[#1e293b]"
                        : "text-[#94a3b8] hover:text-[#64748b]"
                    )}
                  >
                    {s && <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", STATUS_CONFIG[s]?.dot)} />}
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white p-0.5">
              <Filter className="mx-1.5 h-3.5 w-3.5 text-[#94a3b8]" />
              {(["name", "perf", "fitness"] as const).map((s) => {
                const labels = { name: "Name", perf: "Performance", fitness: "Fitness" };
                return (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                      sortBy === s ? "bg-[#f1f5f9] text-[#1e293b]" : "text-[#94a3b8] hover:text-[#64748b]"
                    )}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results count */}
          <div className="text-[11px] text-[#94a3b8]">
            Showing {sorted.length} of {totalAgents} agents
          </div>

          {/* Agent grid */}
          {loading && agents.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#ef4444]">{error}</div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {sorted.map((agent) => (
                  <div key={agent.id}>
                    <AgentCard
                      agent={agent}
                      isSelected={selectedAgent?.id === agent.id}
                      onClick={() =>
                        setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
                      }
                    />
                    <AnimatePresence>
                      {selectedAgent?.id === agent.id && <AgentDetail agent={agent} />}
                    </AnimatePresence>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ── AI Workforce Section ───────────────────────────────────── */}
      <div className="mt-2">
        <div className="mb-4 flex items-center gap-2.5">
          <BrainCircuit className="h-5 w-5 text-[#8b5cf6]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#475569]">
            AI Workforce
          </h3>
          <span className="text-[11px] text-[#94a3b8]">
            Click to interact with autonomous agents
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {([
            {
              id: "queue_balancer",
              name: "Queue Balancer",
              description: "Detects pressure imbalances and autonomously moves agents between queues",
              icon: Scale,
              color: "#2563eb",
              gradient: "from-[#2563eb]/8 to-[#2563eb]/2",
            },
            {
              id: "predictive_prevention",
              name: "Predictive Prevention",
              description: "Predicts overload 60s ahead using velocity tracking and cascade correlation",
              icon: TrendingUp,
              color: "#8b5cf6",
              gradient: "from-[#8b5cf6]/8 to-[#8b5cf6]/2",
            },
            {
              id: "escalation_handler",
              name: "Escalation Handler",
              description: "Activates on CRITICAL alerts, pulls emergency agents, pages supervisors",
              icon: ShieldAlert,
              color: "#ef4444",
              gradient: "from-[#ef4444]/8 to-[#ef4444]/2",
            },
          ] as const).map((agent) => {
            const Icon = agent.icon;
            const agentDecisions = decisions.filter(
              (d) => d.agentType === agent.id
            );
            const actedCount = agentDecisions.filter(
              (d) => d.phase === "acted"
            ).length;

            return (
              <motion.div
                key={agent.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setChatAgent({
                    id: agent.id,
                    name: agent.name,
                    type: "ai",
                    color: agent.color,
                  })
                }
                className={cn(
                  "group cursor-pointer overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-5 transition-all hover:shadow-lg",
                  agent.gradient
                )}
                style={{ borderColor: `${agent.color}25` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${agent.color}15`,
                        border: `2px solid ${agent.color}40`,
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: agent.color }}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1e293b]">
                        {agent.name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[#10b981]">
                          <Activity className="h-2.5 w-2.5" />
                          Active
                        </span>
                        {actedCount > 0 && (
                          <span
                            className="text-[10px] font-semibold tabular-nums"
                            style={{ color: agent.color }}
                          >
                            {actedCount} actions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      backgroundColor: `${agent.color}15`,
                      color: agent.color,
                    }}
                  >
                    <MessageCircle className="h-3 w-3" />
                    Chat
                  </div>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-[#64748b]">
                  {agent.description}
                </p>

                {agentDecisions.length > 0 && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: `${agent.color}15` }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                      Latest
                    </p>
                    <p className="mt-1 text-[11px] text-[#475569] line-clamp-2">
                      {agentDecisions[0]?.summary}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Chat Drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {chatAgent && (
          <AgentChatDrawer
            agentId={chatAgent.id}
            agentName={chatAgent.name}
            agentType={chatAgent.type}
            color={chatAgent.color}
            onClose={() => setChatAgent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
