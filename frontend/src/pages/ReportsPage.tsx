import { useState } from "react";
import {
  FileText,
  Download,
  RefreshCw,
  Clock,
  Shield,
  DollarSign,
  AlertTriangle,
  BrainCircuit,
  Route,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import type { SessionReport } from "../types";

/* ── Chart color palettes (CirrusLabs) ── */
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};
const AGENT_COLORS: Record<string, string> = {
  queue_balancer: "#2563eb",
  predictive_prevention: "#10b981",
  escalation_handler: "#ef4444",
  skill_router: "#22c55e",
  analytics: "#f59e0b",
};
const GUARDRAIL_COLORS: Record<string, string> = {
  AUTO_APPROVE: "#10b981",
  PENDING_HUMAN: "#f59e0b",
  BLOCKED: "#ef4444",
};
const PIE_COLORS = ["#2563eb", "#10b981", "#ef4444", "#22c55e", "#f59e0b"];

/* ── Shared Tooltip styling (light) ── */
const tooltipStyle = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#1e293b",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  itemStyle: { color: "#475569", fontSize: "11px" },
};

/* ── Card wrapper ── */
function ChartCard({
  title,
  icon: Icon,
  iconColor,
  delay = 0,
  span = 1,
  children,
}: {
  title: string;
  icon: typeof FileText;
  iconColor: string;
  delay?: number;
  span?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn(
        "rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm",
        span === 2 && "col-span-2",
        span === 3 && "col-span-3"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  );
}

/* ── KPI Stat ── */
function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-[#64748b]">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", color || "text-[#1e293b]")}>{value}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/session");
      setReport(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinelai-report-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Derived chart data ── */
  const alertsBySeverity = report
    ? Object.entries(report.alerts.bySeverity).map(([sev, count]) => ({
        name: sev.charAt(0).toUpperCase() + sev.slice(1),
        value: count,
        fill: SEVERITY_COLORS[sev] || "#64748b",
      }))
    : [];

  const decisionsByAgent = report
    ? Object.entries(report.decisions.byAgent).map(([agent, count]) => ({
        name: agent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count,
        fill: AGENT_COLORS[agent] || "#64748b",
      }))
    : [];

  const guardrailBreakdown = report
    ? Object.entries(report.decisions.byGuardrailResult).map(([result, count]) => ({
        name: result.replace(/_/g, " "),
        value: count,
        fill: GUARDRAIL_COLORS[result] || "#64748b",
      }))
    : [];

  const queuePerformance = report
    ? Object.entries(report.queues).map(([name, q]) => {
        const queue = q as Record<string, number>;
        return {
          name,
          contacts: queue.currentContacts ?? 0,
          agents: queue.agentsOnline ?? 0,
          waitTime: queue.avgWaitTime ?? 0,
          serviceLevel: queue.serviceLevel ?? 0,
          abandonRate: queue.abandonmentRate ?? 0,
        };
      })
    : [];

  const radarData = report
    ? [
        {
          metric: "Auto Approve",
          value: report.governance.autoApproved,
          fullMark: Math.max(report.governance.totalDecisions, 1),
        },
        {
          metric: "Human Approved",
          value: report.governance.humanApproved,
          fullMark: Math.max(report.governance.totalDecisions, 1),
        },
        {
          metric: "Blocked",
          value: report.governance.blocked,
          fullMark: Math.max(report.governance.totalDecisions, 1),
        },
        {
          metric: "Avg Confidence",
          value: Math.round(report.governance.avgConfidence * 100),
          fullMark: 100,
        },
        {
          metric: "Decisions",
          value: report.governance.totalDecisions,
          fullMark: Math.max(report.governance.totalDecisions, 1),
        },
      ]
    : [];

  const routingScores = report
    ? report.skillRouting.recentRoutings.map((r, i) => ({
        index: i + 1,
        score: r.score,
        tick: r.tick,
      }))
    : [];

  /* ════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Session Reports</h2>
          <p className="text-sm text-muted-foreground">
            Real-time analytics dashboard with automated session reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={generateReport}
            disabled={loading}
            className="bg-[#2563eb]/10 text-[#2563eb] hover:bg-[#2563eb]/20"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {loading ? "Generating..." : "Generate Report"}
          </Button>
          {report && (
            <Button
              onClick={downloadReport}
              className="bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!report ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-[#94a3b8]" />
            <p className="text-sm text-[#64748b]">
              Click &quot;Generate Report&quot; to create a live analytics dashboard
            </p>
            <p className="mt-1 text-[11px] text-[#94a3b8]">
              Start a simulation first for richer data
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-3 gap-3 pb-4">
            {/* ─── Row 1: KPI strip ─── */}
            <ChartCard title="Session Overview" icon={Clock} iconColor="text-[#2563eb]" span={3} delay={0}>
              <div className="grid grid-cols-6 gap-4">
                <Stat label="Scenario" value={report.simulationScenario || "Idle"} />
                <Stat label="Tick" value={report.simulationTick} />
                <Stat label="Total Alerts" value={report.alerts.total} color="text-[#f59e0b]" />
                <Stat label="Decisions" value={report.decisions.total} color="text-[#2563eb]" />
                <Stat label="Executed" value={report.decisions.executed} color="text-[#10b981]" />
                <Stat label="Contacts Routed" value={report.skillRouting.totalRouted} color="text-[#3b82f6]" />
              </div>
            </ChartCard>

            {/* ─── Row 2: Cost KPIs ─── */}
            <ChartCard title="Cost Impact" icon={DollarSign} iconColor="text-[#10b981]" span={3} delay={0.05}>
              <div className="grid grid-cols-4 gap-6">
                <Stat label="Total Saved" value={`$${report.costImpact.totalSaved.toLocaleString()}`} color="text-[#10b981]" />
                <Stat label="Revenue at Risk" value={`$${report.costImpact.revenueAtRisk.toLocaleString()}`} color="text-[#ef4444]" />
                <Stat label="Prevented Abandoned" value={report.costImpact.preventedAbandoned} color="text-[#2563eb]" />
                <Stat label="Actions Executed" value={report.costImpact.actionsToday} />
              </div>
            </ChartCard>

            {/* ─── Row 3: Three charts side by side ─── */}

            {/* Alerts by Severity — Donut */}
            <ChartCard title="Alerts by Severity" icon={AlertTriangle} iconColor="text-[#f59e0b]" delay={0.1}>
              {alertsBySeverity.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={alertsBySeverity}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {alertsBySeverity.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-xs text-[#94a3b8]">No alerts</div>
              )}
            </ChartCard>

            {/* Decisions by Agent — Bar */}
            <ChartCard title="Decisions by Agent" icon={BrainCircuit} iconColor="text-[#2563eb]" delay={0.15}>
              {decisionsByAgent.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={decisionsByAgent} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "#475569" }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {decisionsByAgent.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-xs text-[#94a3b8]">No decisions</div>
              )}
            </ChartCard>

            {/* Guardrail Breakdown — Donut */}
            <ChartCard title="Guardrail Outcome" icon={Shield} iconColor="text-[#3b82f6]" delay={0.2}>
              {guardrailBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={guardrailBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {guardrailBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground/50">No data</div>
              )}
            </ChartCard>

            {/* ─── Row 4: Queue Performance bar chart (full width) ─── */}
            <ChartCard title="Queue Performance" icon={TrendingUp} iconColor="text-[#3b82f6]" span={2} delay={0.25}>
              {queuePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={queuePerformance} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "#475569" }} />
                    <Bar dataKey="contacts" name="Contacts" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="agents" name="Agents" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="serviceLevel" name="SL %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[230px] items-center justify-center text-xs text-[#94a3b8]">No queue data</div>
              )}
            </ChartCard>

            {/* ─── Governance Radar ─── */}
            <ChartCard title="Governance Radar" icon={Shield} iconColor="text-[#2563eb]" delay={0.3}>
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "#475569" }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    <Radar
                      dataKey="value"
                      stroke="#2563eb"
                      fill="#2563eb"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip {...tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[230px] items-center justify-center text-xs text-[#94a3b8]">No governance data</div>
              )}
            </ChartCard>

            {/* ─── Row 5: Skill Routing Scores over time + Queue table ─── */}
            <ChartCard title="Skill Routing Accuracy" icon={Route} iconColor="text-[#10b981]" span={2} delay={0.35}>
              {routingScores.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={routingScores}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="index" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} label={{ value: "Routing #", position: "insideBottomRight", offset: -5, fontSize: 9, fill: "#475569" }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                      dot={{ r: 3, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-xs text-[#94a3b8]">
                  No routing data — start a simulation
                </div>
              )}
            </ChartCard>

            {/* ─── Queue Wait Time / Abandon Rate ─── */}
            <ChartCard title="Wait & Abandon" icon={AlertTriangle} iconColor="text-[#ef4444]" delay={0.4}>
              {queuePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={queuePerformance} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "#475569" }} />
                    <Bar dataKey="waitTime" name="Wait (s)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="abandonRate" name="Abandon %" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground/50">No data</div>
              )}
            </ChartCard>

            {/* ─── Queue Performance Table ─── */}
            <ChartCard title="Queue Detail" icon={FileText} iconColor="text-[#2563eb]" span={3} delay={0.45}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-muted-foreground">
                      <th className="py-2 text-left font-medium">Queue</th>
                      <th className="py-2 text-right font-medium">Contacts</th>
                      <th className="py-2 text-right font-medium">Agents Online</th>
                      <th className="py-2 text-right font-medium">Available</th>
                      <th className="py-2 text-right font-medium">Avg Wait</th>
                      <th className="py-2 text-right font-medium">Abandon %</th>
                      <th className="py-2 text-right font-medium">Service Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.queues).map(([name, q]) => {
                      const queue = q as Record<string, number>;
                      return (
                        <tr key={name} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                          <td className="py-2 font-medium text-[#1e293b]">{name}</td>
                          <td className="py-2 text-right tabular-nums">{queue.currentContacts ?? 0}</td>
                          <td className="py-2 text-right tabular-nums">{queue.agentsOnline ?? 0}</td>
                          <td className="py-2 text-right tabular-nums">{queue.agentsAvailable ?? 0}</td>
                          <td className="py-2 text-right tabular-nums">{(queue.avgWaitTime ?? 0).toFixed(1)}s</td>
                          <td className={cn("py-2 text-right tabular-nums", (queue.abandonmentRate ?? 0) > 10 ? "text-[#ef4444]" : "")}>
                            {(queue.abandonmentRate ?? 0).toFixed(1)}%
                          </td>
                          <td className={cn("py-2 text-right tabular-nums", (queue.serviceLevel ?? 0) > 80 ? "text-[#10b981]" : "text-[#f59e0b]")}>
                            {(queue.serviceLevel ?? 0).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            {/* ─── Recent Routings ─── */}
            {report.skillRouting.recentRoutings.length > 0 && (
              <ChartCard title="Recent Skill Routings" icon={Route} iconColor="text-[#10b981]" span={3} delay={0.5}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] text-[#64748b]">
                        <th className="py-2 text-left font-medium">Contact</th>
                        <th className="py-2 text-left font-medium">Agent</th>
                        <th className="py-2 text-right font-medium">Match Score</th>
                        <th className="py-2 text-left font-medium">Reasoning</th>
                        <th className="py-2 text-right font-medium">Tick</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.skillRouting.recentRoutings.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                          <td className="py-1.5 font-mono text-[10px] text-[#3b82f6]">{r.contactId}</td>
                          <td className="py-1.5 font-medium text-[#1e293b]">{r.agentId}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            <span className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              r.score >= 0.7 ? "bg-[#10b981]/10 text-[#10b981]"
                                : r.score >= 0.5 ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                                  : "bg-[#ef4444]/10 text-[#ef4444]"
                            )}>
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="max-w-[300px] truncate py-1.5 text-[#64748b]">{r.reasoning}</td>
                          <td className="py-1.5 text-right tabular-nums text-[#94a3b8]">{r.tick}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
