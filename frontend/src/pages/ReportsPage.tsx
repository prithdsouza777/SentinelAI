import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Search,
  X,
  Printer,
  Users,
  Mail,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import PrintReportView from "@/components/reports/PrintReportView";
import { getValidSession } from "@/components/auth/authToken";
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
import { useDashboardStore } from "../stores/dashboardStore";
import type { AgentType, AlertSeverity, SessionReport } from "../types";

type QueueRow = {
  queueId: string;
  queueName: string;
  contacts: number;
  agentsOnline: number;
  agentsAvailable: number;
  waitTime: number;
  abandonmentRate: number;
  serviceLevel: number;
};

type RoutingRow = SessionReport["skillRouting"]["recentRoutings"][number] & {
  id: string;
  scorePct: number; // 0-100
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    fontSize: "11px",
    color: "var(--text-primary)",
    boxShadow: "var(--shadow-card)",
  },
  itemStyle: { color: "var(--text-secondary)", fontSize: "11px" },
};

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; color: string; filterValue: AlertSeverity }
> = {
  critical: { label: "Critical", color: "var(--danger)", filterValue: "critical" },
  warning: { label: "Warning", color: "var(--warning)", filterValue: "warning" },
  info: { label: "Info", color: "var(--accent)", filterValue: "info" },
};

const AGENT_META: Record<AgentType, { label: string; color: string }> = {
  queue_balancer: { label: "Queue Balancer", color: "var(--accent)" },
  predictive_prevention: { label: "Predictive Prevention", color: "var(--success)" },
  escalation_handler: { label: "Escalation Handler", color: "var(--danger)" },
  skill_router: { label: "Skill Router", color: "var(--success)" },
  analytics: { label: "Analytics", color: "var(--warning)" },
};

const GUARDRAIL_META: Record<string, { label: string; color: string }> = {
  AUTO_APPROVE: { label: "Auto-Approved", color: "var(--success)" },
  PENDING_HUMAN: { label: "Pending Human", color: "var(--warning)" },
  BLOCKED: { label: "Blocked", color: "var(--danger)" },
};

function escapeCsvCell(value: string | number) {
  const s = String(value ?? "");
  // CSV escaping: wrap in quotes, and double any internal quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

function formatQueueSeverity(q: QueueRow): AlertSeverity {
  // Heuristic because the backend report does not include a direct severity->queue mapping.
  // This is designed so donut click "feels" meaningful using queue health signals.
  if (q.serviceLevel <= 75 || q.abandonmentRate >= 15) return "critical";
  if (q.serviceLevel <= 85 || q.abandonmentRate >= 7.5) return "warning";
  return "info";
}

function sortDirFactor(dir: "asc" | "desc") {
  return dir === "asc" ? 1 : -1;
}

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
        "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-none",
        "print-panel-card",
        span === 2 && "col-span-2",
        span === 3 && "col-span-3"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="h-4 w-1 rounded bg-[var(--accent)]" />
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  );
}

/* ── KPI Stat ── */
function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</p>
      <p className={cn("truncate text-2xl font-extrabold tabular-nums", color || "text-[var(--text-primary)]")} title={String(value)}>
        {value}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const report = useDashboardStore((s) => s.sessionReport);
  const setReport = useDashboardStore((s) => s.setSessionReport);
  const [loading, setLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | null>(null);
  const [agentHighlight, setAgentHighlight] = useState<AgentType | null>(null);

  type QueueSortKey =
    | "queueName"
    | "contacts"
    | "agentsOnline"
    | "agentsAvailable"
    | "waitTime"
    | "abandonmentRate"
    | "serviceLevel";

  const [queueSortKey, setQueueSortKey] = useState<QueueSortKey>("serviceLevel");
  const [queueSortDir, setQueueSortDir] = useState<"asc" | "desc">("desc");

  type RoutingSortKey = "tick" | "matchScore";
  const [routingSortKey, setRoutingSortKey] = useState<RoutingSortKey>("tick");
  const [routingSortDir, setRoutingSortDir] = useState<"asc" | "desc">("desc");

  const [routingSearch, setRoutingSearch] = useState("");
  const [debouncedRoutingSearch, setDebouncedRoutingSearch] = useState("");
  const [minScorePill, setMinScorePill] = useState<0.85 | 0.9 | 0.95 | null>(null);
  const [expandedRoutingId, setExpandedRoutingId] = useState<string | null>(null);

  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printRootEl, setPrintRootEl] = useState<HTMLDivElement | null>(null);
  const operatorRole = getValidSession()?.role ?? "Operator";

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedRoutingSearch(routingSearch), 200);
    return () => window.clearTimeout(t);
  }, [routingSearch]);

  useEffect(() => {
    if (!printPreviewOpen) return;

    let el = document.getElementById("print-report-root") as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "print-report-root";
      document.body.appendChild(el);
    }

    setPrintRootEl(el);

    const onAfterPrint = () => setPrintPreviewOpen(false);
    window.addEventListener("afterprint", onAfterPrint);

    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      if (el?.parentNode) el.parentNode.removeChild(el);
      setPrintRootEl(null);
    };
  }, [printPreviewOpen]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/session");
      setReport(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const sendReportEmail = async () => {
    if (!report) return;
    setEmailSending(true);
    setEmailFeedback(null);
    try {
      // 1. Generate PDF content
      let pdfBase64: string | null = null;
      const pdfElement = document.getElementById("pdf-capture-root");
      
      if (pdfElement) {
        // Wait for charts to settle (recharts animations)
        await new Promise(r => setTimeout(r, 800));
        
        const canvas = await html2canvas(pdfElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });
        
        const imgData = canvas.toDataURL("image/jpeg", 0.9);
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        pdfBase64 = pdf.output("datauristring");
      }

      // 2. Send to backend
      const res = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 })
      });
      
      const data = await res.json();
      if (res.ok) {
        setEmailFeedback({ ok: true, msg: data.message ?? "Report emailed successfully with PDF." });
      } else {
        const detail = data.detail ?? data;
        setEmailFeedback({ ok: false, msg: detail.message ?? "Failed to send email." });
      }
    } catch (err) {
      console.error("PDF/Email error:", err);
      setEmailFeedback({ ok: false, msg: "Error generating report PDF or sending email." });
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailFeedback(null), 5000);
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

  const queueRows: QueueRow[] = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.queues).map(([queueName, q]) => {
      const queue = q as Record<string, number>;
      const queueObj = q as unknown as { queueId?: string };
      const queueId = queueObj.queueId ?? queueName;
      return {
        queueId,
        queueName,
        contacts: queue.currentContacts ?? 0,
        agentsOnline: queue.agentsOnline ?? 0,
        agentsAvailable: queue.agentsAvailable ?? 0,
        waitTime: queue.avgWaitTime ?? 0,
        abandonmentRate: queue.abandonmentRate ?? 0,
        serviceLevel: queue.serviceLevel ?? 0,
      };
    });
  }, [report]);

  const routingRows: RoutingRow[] = useMemo(() => {
    if (!report) return [];
    return report.skillRouting.recentRoutings.map((r, i) => ({
      ...r,
      id: `${r.contactId}-${r.agentId}-${r.tick}-${i}`,
      scorePct: Math.round(r.score * 100),
    }));
  }, [report]);

  const alertsBySeverity = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.alerts.bySeverity).map(([sev, count]) => {
      const s = sev as AlertSeverity;
      const meta = SEVERITY_META[s];
      return {
        key: s,
        name: meta?.label ?? sev,
        value: count,
        color: meta?.color ?? "var(--text-muted)",
      };
    });
  }, [report]);

  const decisionsByAgent = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.decisions.byAgent).map(([agent, count]) => {
      const a = agent as AgentType;
      const meta = AGENT_META[a];
      return {
        key: a,
        name: meta?.label ?? agent,
        value: count,
        color: meta?.color ?? "var(--text-muted)",
      };
    });
  }, [report]);

  const guardrailBreakdown = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.decisions.byGuardrailResult).map(([result, count]) => {
      const meta = GUARDRAIL_META[result];
      return {
        key: result,
        name: meta?.label ?? result.replace(/_/g, " "),
        value: count,
        color: meta?.color ?? "var(--text-muted)",
      };
    });
  }, [report]);

  const queuePerformance = useMemo(() => {
    return queueRows.map((q) => ({
      name: q.queueName,
      contacts: q.contacts,
      agents: q.agentsOnline,
      waitTime: q.waitTime,
      serviceLevel: q.serviceLevel,
      abandonRate: q.abandonmentRate,
    }));
  }, [queueRows]);

  const workforceDeptData = useMemo(() => {
    if (!report?.workforce) return [];
    return Object.entries(report.workforce.byDepartment).map(([dept, count]) => ({
      name: dept,
      agents: count,
    }));
  }, [report]);

  const workforceFitnessData = useMemo(() => {
    if (!report?.workforce) return [];
    return Object.entries(report.workforce.departmentFitness).map(([dept, score]) => ({
      metric: dept,
      value: Math.round(score * 100),
      fullMark: 100,
    }));
  }, [report]);

  const radarData = useMemo(() => {
    if (!report) return [];
    return [
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
    ];
  }, [report]);

  const routingScores = useMemo(() => {
    return routingRows.map((r, i) => ({
      index: i + 1,
      score: r.score,
      tick: r.tick,
    }));
  }, [routingRows]);

  const filteredQueueRows = useMemo(() => {
    if (!severityFilter) return queueRows;
    return queueRows.filter((q) => formatQueueSeverity(q) === severityFilter);
  }, [queueRows, severityFilter]);

  const sortedQueueRows = useMemo(() => {
    const arr = [...filteredQueueRows];
    arr.sort((a, b) => {
      const factor = sortDirFactor(queueSortDir);
      const key = queueSortKey;
      const av =
        key === "queueName"
          ? a.queueName
          : key === "contacts"
            ? a.contacts
            : key === "agentsOnline"
              ? a.agentsOnline
              : key === "agentsAvailable"
                ? a.agentsAvailable
                : key === "waitTime"
                  ? a.waitTime
                  : key === "abandonmentRate"
                    ? a.abandonmentRate
                    : a.serviceLevel;
      const bv =
        key === "queueName"
          ? b.queueName
          : key === "contacts"
            ? b.contacts
            : key === "agentsOnline"
              ? b.agentsOnline
              : key === "agentsAvailable"
                ? b.agentsAvailable
                : key === "waitTime"
                  ? b.waitTime
                  : key === "abandonmentRate"
                    ? b.abandonmentRate
                    : b.serviceLevel;

      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * factor;
      }
      return ((av as number) - (bv as number)) * factor;
    });
    return arr;
  }, [filteredQueueRows, queueSortDir, queueSortKey]);

  const filteredRoutingRows = useMemo(() => {
    const q = debouncedRoutingSearch.trim().toLowerCase();
    let rows = routingRows;

    if (q) {
      rows = rows.filter((r) => {
        return (
          r.contactId.toLowerCase().includes(q) ||
          r.agentId.toLowerCase().includes(q) ||
          r.reasoning.toLowerCase().includes(q)
        );
      });
    }

    if (minScorePill != null) {
      rows = rows.filter((r) => r.score >= minScorePill);
    }

    const factor = sortDirFactor(routingSortDir);
    rows = [...rows].sort((a, b) => {
      const av = routingSortKey === "tick" ? a.tick : a.score;
      const bv = routingSortKey === "tick" ? b.tick : b.score;
      return (av - bv) * factor;
    });

    return rows;
  }, [debouncedRoutingSearch, minScorePill, routingRows, routingSortKey, routingSortDir]);

  const visibleRoutingRows = useMemo(() => filteredRoutingRows.slice(0, 10), [filteredRoutingRows]);

  const totalAlerts = report?.alerts.total ?? 0;
  const totalDecisions = report?.decisions.total ?? 0;

  const queueSeverityChip = severityFilter ? SEVERITY_META[severityFilter] : null;

  /* ════════════════════════════════════════════════════════════════════════ */

  const handleQueueSort = (key: QueueSortKey) => {
    setQueueSortKey((prev) => {
      if (prev === key) {
        setQueueSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setQueueSortDir("desc");
      return key;
    });
  };

  const handleRoutingSort = (key: RoutingSortKey) => {
    setRoutingSortKey((prev) => {
      if (prev === key) {
        setRoutingSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setRoutingSortDir("desc");
      return key;
    });
  };

  const exportSkillRoutingsCsv = () => {
    if (!report) return;
    const rows = visibleRoutingRows;
    const header = ["Contact", "Agent", "Match Score", "Reasoning", "Tick"];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.contactId,
          r.agentId,
          r.scorePct,
          r.reasoning,
          r.tick,
        ]
          .map(escapeCsvCell)
          .join(",")
      );
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:]/g, "-");
    a.href = url;
    a.download = `sentinelai-skill-routings-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {/* Header */}
      <div className="relative flex items-center justify-between pl-4">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded bg-[var(--accent-subtle)]" />
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
            variant="outline"
            className="print-hide border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)]"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {loading ? "Generating..." : "Generate Report"}
          </Button>
          {report && (
            <Button
              onClick={downloadReport}
              variant="secondary"
              className="print-hide gap-2"
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          )}

          {report && (
            <Button
              onClick={exportSkillRoutingsCsv}
              variant="secondary"
              className="print-hide gap-2"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}

          {report && (
            <Button
              onClick={() => {
                setPrintPreviewOpen(true);
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    window.print();
                  }, 300);
                });
              }}
              variant="secondary"
              className="print-hide gap-2"
              disabled={printPreviewOpen}
            >
              <Printer className="mr-2 h-4 w-4" />
              {printPreviewOpen ? "Generating..." : "Print Report"}
            </Button>
          )}

          {report && (
            <Button
              onClick={sendReportEmail}
              variant="secondary"
              className="print-hide gap-2"
              disabled={emailSending}
            >
              <Mail className={cn("mr-2 h-4 w-4", emailSending && "animate-pulse")} />
              {emailSending ? "Sending..." : "Email Report"}
            </Button>
          )}
        </div>
      </div>

      {/* Email feedback banner */}
      <AnimatePresence>
        {emailFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "print-hide flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium",
              emailFeedback.ok
                ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]"
                : "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]"
            )}
          >
            {emailFeedback.ok
              ? <CheckCircle2 className="h-4 w-4 shrink-0" />
              : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{emailFeedback.msg}</span>
            <button
              onClick={() => setEmailFeedback(null)}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!report ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Click &quot;Generate Report&quot; to create a live analytics dashboard
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Start a simulation first for richer data
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-5 pb-4 reports-page-print-grid">
            {/* ─── Row 1: KPI strip ─── */}
            <ChartCard
              title="Session Overview"
              icon={Clock}
              iconColor="text-[var(--accent)]"
              span={3}
              delay={0}
            >
              <div className="grid grid-cols-6 gap-4">
                <Stat label="Scenario" value={report.simulationScenario || "Idle"} />
                <Stat label="Tick" value={report.simulationTick} />
                <Stat label="Total Alerts" value={report.alerts.total} color="text-[var(--warning)]" />
                <Stat label="Decisions" value={report.decisions.total} color="text-[var(--accent)]" />
                <Stat label="Executed" value={report.decisions.executed} color="text-[var(--success)]" />
                <Stat label="Contacts Routed" value={report.skillRouting.totalRouted} color="text-[var(--accent)]" />
              </div>
            </ChartCard>

            {/* ─── Row 2: Cost KPIs ─── */}
            <ChartCard
              title="Cost Impact"
              icon={DollarSign}
              iconColor="text-[var(--success)]"
              span={3}
              delay={0.05}
            >
              <div className="grid grid-cols-4 gap-6">
                <Stat
                  label="Total Saved"
                  value={`$${report.costImpact.totalSaved.toLocaleString()}`}
                  color="text-[var(--success)]"
                />
                <Stat
                  label="Revenue at Risk"
                  value={`$${report.costImpact.revenueAtRisk.toLocaleString()}`}
                  color="text-[var(--danger)]"
                />
                <Stat
                  label="Prevented Abandoned"
                  value={report.costImpact.preventedAbandoned}
                  color="text-[var(--accent)]"
                />
                <Stat label="Actions Executed" value={report.costImpact.actionsToday} />
              </div>
            </ChartCard>

            {/* ─── Row 2.5: Workforce Summary ─── */}
            {report.workforce && report.workforce.totalAgents > 0 && (
              <>
                <ChartCard
                  title="Workforce Overview"
                  icon={Users}
                  iconColor="text-[var(--accent)]"
                  span={3}
                  delay={0.07}
                >
                  <div className="grid grid-cols-6 gap-4">
                    <Stat label="Total Agents" value={report.workforce.totalAgents} />
                    <Stat
                      label="Available"
                      value={report.workforce.byStatus.available ?? 0}
                      color="text-[var(--success)]"
                    />
                    <Stat
                      label="Busy"
                      value={report.workforce.byStatus.busy ?? 0}
                      color="text-[var(--warning)]"
                    />
                    <Stat
                      label="On Break"
                      value={report.workforce.byStatus.on_break ?? 0}
                      color="text-[var(--danger)]"
                    />
                    <Stat
                      label="Relocated"
                      value={report.workforce.relocated}
                      color="text-[var(--warning)]"
                    />
                    <Stat
                      label="Avg Performance"
                      value={`${(report.workforce.avgPerfScore * 100).toFixed(0)}%`}
                      color="text-[var(--accent)]"
                    />
                  </div>
                </ChartCard>

                {/* Dept Distribution + Fitness Radar + Top Performers */}
                <ChartCard
                  title="Agents by Department"
                  icon={Users}
                  iconColor="text-[var(--accent)]"
                  delay={0.08}
                >
                  {workforceDeptData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={workforceDeptData} barSize={30}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={{ stroke: "var(--border)" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                          axisLine={{ stroke: "var(--border)" }}
                          tickLine={{ stroke: "var(--border)" }}
                          allowDecimals={false}
                        />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="agents" name="Agents" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center text-xs text-[var(--text-muted)]">
                      No workforce data
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  title="Avg Dept Fitness"
                  icon={Shield}
                  iconColor="text-[var(--success)]"
                  delay={0.09}
                >
                  {workforceFitnessData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={workforceFitnessData} outerRadius="70%">
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                        <PolarRadiusAxis tick={false} axisLine={{ stroke: "var(--border)" }} domain={[0, 100]} />
                        <Radar
                          dataKey="value"
                          stroke="var(--success)"
                          fill="var(--success)"
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                        <Tooltip {...tooltipStyle} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center text-xs text-[var(--text-muted)]">
                      No fitness data
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  title="Top Performers"
                  icon={TrendingUp}
                  iconColor="text-[var(--success)]"
                  delay={0.1}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                          <th className="py-2 text-left font-semibold">#</th>
                          <th className="py-2 text-left font-semibold">Name</th>
                          <th className="py-2 text-left font-semibold">Role</th>
                          <th className="py-2 text-left font-semibold">Department</th>
                          <th className="py-2 text-right font-semibold">Performance</th>
                          <th className="py-2 text-left font-semibold">Top Skill</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.workforce.topPerformers.map((p, i) => (
                          <tr
                            key={p.name}
                            className={cn(
                              "border-b border-[var(--border-subtle)] transition-colors",
                              i % 2 === 1 ? "bg-[var(--border-subtle)]" : "bg-transparent"
                            )}
                          >
                            <td className="py-1.5 text-[var(--text-muted)]">{i + 1}</td>
                            <td className="py-1.5 font-medium text-[var(--text-primary)]">{p.name}</td>
                            <td className="py-1.5 capitalize text-[var(--text-secondary)]">{p.role}</td>
                            <td className="py-1.5 text-[var(--text-secondary)]">{p.department}</td>
                            <td className={cn(
                              "py-1.5 text-right tabular-nums font-semibold",
                              p.perfScore >= 0.85 ? "text-[var(--success)]" : "text-[var(--text-primary)]"
                            )}>
                              {(p.perfScore * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 capitalize text-[var(--text-secondary)]">{p.topSkill}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              </>
            )}

            {/* ─── Row 3: Three charts side by side ─── */}

            {/* Alerts by Severity — Donut */}
            <ChartCard
              title="Alerts by Severity"
              icon={AlertTriangle}
              iconColor="text-[var(--warning)]"
              delay={0.1}
            >
              {alertsBySeverity.length > 0 ? (
                <div className="relative min-h-[220px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={alertsBySeverity}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={78}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {alertsBySeverity.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              setSeverityFilter((prev) =>
                                prev === entry.key ? null : entry.key
                              )
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
                        {totalAlerts}
                      </div>
                      <div className="text-[10px] font-medium text-[var(--text-secondary)]">Total</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-xs text-[var(--text-muted)]">
                  No alerts
                </div>
              )}
            </ChartCard>

            {/* Decisions by Agent — Bar */}
            <ChartCard
              title="Decisions by Agent"
              icon={BrainCircuit}
              iconColor="text-[var(--accent)]"
              delay={0.15}
            >
              {decisionsByAgent.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={decisionsByAgent} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {decisionsByAgent.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setAgentHighlight((prev) => (prev === entry.key ? null : entry.key))
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-xs text-[var(--text-muted)]">
                  No decisions
                </div>
              )}
            </ChartCard>

            {/* Guardrail Breakdown — Donut */}
            <ChartCard
              title="Guardrail Outcome"
              icon={Shield}
              iconColor="text-[var(--accent)]"
              delay={0.2}
            >
              {guardrailBreakdown.length > 0 ? (
                <div className="relative min-h-[220px]">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={guardrailBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={78}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {guardrailBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{
                          fontSize: "10px",
                          color: "var(--text-secondary)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
                        {totalDecisions}
                      </div>
                      <div className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Decisions
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-xs text-[var(--text-muted)] opacity-50">
                  No data
                </div>
              )}
            </ChartCard>

            {/* ─── Row 4: Queue Performance bar chart (full width) ─── */}
            <ChartCard
              title="Queue Performance"
              icon={TrendingUp}
              iconColor="text-[var(--accent)]"
              span={2}
              delay={0.25}
            >
              {queuePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={queuePerformance} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", color: "var(--text-secondary)" }}
                    />
                    <Bar
                      dataKey="contacts"
                      name="Contacts"
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                      barSize={16}
                    />
                    <Bar
                      dataKey="agents"
                      name="Agents"
                      fill="var(--accent-hover)"
                      radius={[4, 4, 0, 0]}
                      barSize={16}
                    />
                    <Bar
                      dataKey="serviceLevel"
                      name="SL %"
                      fill="var(--success)"
                      radius={[4, 4, 0, 0]}
                      barSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-xs text-[var(--text-muted)]">
                  No queue data
                </div>
              )}
            </ChartCard>

            {/* ─── Governance Radar ─── */}
            <ChartCard
              title="Governance Radar"
              icon={Shield}
              iconColor="text-[var(--accent)]"
              delay={0.3}
            >
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <PolarRadiusAxis tick={false} axisLine={{ stroke: "var(--border)" }} />
                    <Radar
                      dataKey="value"
                      stroke="var(--accent)"
                      fill="var(--accent)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip {...tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-xs text-[var(--text-muted)]">
                  No governance data
                </div>
              )}
            </ChartCard>

            {/* ─── Row 5: Skill Routing Scores over time + Queue table ─── */}
            <ChartCard
              title="Skill Routing Accuracy"
              icon={Route}
              iconColor="text-[var(--success)]"
              span={2}
              delay={0.35}
            >
              {routingScores.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={routingScores}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="index"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                      label={{
                        value: "Routing #",
                        position: "insideBottomRight",
                        offset: -5,
                        fontSize: 9,
                        fill: "var(--text-secondary)",
                      }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--success)"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                      dot={{
                        r: 3,
                        fill: "var(--success)",
                        stroke: "var(--bg-card)",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center text-xs text-[var(--text-muted)]">
                  No routing data — start a simulation
                </div>
              )}
            </ChartCard>

            {/* ─── Queue Wait Time / Abandon Rate ─── */}
            <ChartCard
              title="Wait & Abandon"
              icon={AlertTriangle}
              iconColor="text-[var(--danger)]"
              delay={0.4}
            >
              {queuePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={queuePerformance} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={{ stroke: "var(--border)" }}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "var(--text-secondary)" }} />
                    <Bar dataKey="waitTime" name="Wait (s)" fill="var(--warning)" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="abandonRate" name="Abandon %" fill="var(--danger)" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center text-xs text-muted-foreground/50">No data</div>
              )}
            </ChartCard>

            {/* ─── Queue Performance Table ─── */}
            <ChartCard title="Queue Detail" icon={FileText} iconColor="text-[var(--accent)]" span={3} delay={0.45}>
              {queueSeverityChip && (
                <div className="mb-3 flex items-center justify-between gap-3 print-hide">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent-subtle)] px-3 py-1">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)]">Filter: {queueSeverityChip.label}</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--accent-subtle)]"
                    onClick={() => setSeverityFilter(null)}
                    aria-label="Clear severity filter"
                  >
                    <X className="h-4 w-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <SortableTh
                        label="Queue"
                        align="left"
                        active={queueSortKey === "queueName"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("queueName")}
                      />
                      <SortableTh
                        label="Contacts"
                        align="right"
                        active={queueSortKey === "contacts"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("contacts")}
                      />
                      <SortableTh
                        label="Agents Online"
                        align="right"
                        active={queueSortKey === "agentsOnline"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("agentsOnline")}
                      />
                      <SortableTh
                        label="Available"
                        align="right"
                        active={queueSortKey === "agentsAvailable"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("agentsAvailable")}
                      />
                      <SortableTh
                        label="Avg Wait"
                        align="right"
                        active={queueSortKey === "waitTime"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("waitTime")}
                      />
                      <SortableTh
                        label="Abandon %"
                        align="right"
                        active={queueSortKey === "abandonmentRate"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("abandonmentRate")}
                      />
                      <SortableTh
                        label="Service Level"
                        align="right"
                        active={queueSortKey === "serviceLevel"}
                        dir={queueSortDir}
                        onClick={() => handleQueueSort("serviceLevel")}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueueRows.map((q, idx) => {
                      const sl = q.serviceLevel ?? 0;
                      const abandon = q.abandonmentRate ?? 0;
                      return (
                        <tr
                          key={q.queueId}
                          className={cn(
                            "border-b border-[var(--border-subtle)] transition-colors",
                            idx % 2 === 1 ? "bg-[var(--border-subtle)]" : "bg-transparent",
                            "hover:bg-[var(--accent-subtle)]"
                          )}
                        >
                          <td className="py-2 font-medium text-[var(--text-primary)]">{q.queueName}</td>
                          <td className="py-2 text-right tabular-nums">{q.contacts}</td>
                          <td className="py-2 text-right tabular-nums">{q.agentsOnline}</td>
                          <td className="py-2 text-right tabular-nums">{q.agentsAvailable}</td>
                          <td className="py-2 text-right tabular-nums">{q.waitTime.toFixed(1)}s</td>
                          <td
                            className={cn(
                              "py-2 text-right tabular-nums",
                              abandon > 10 ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
                            )}
                          >
                            {abandon.toFixed(1)}%
                          </td>
                          <td
                            className={cn(
                              "py-2 text-right tabular-nums",
                              sl > 80 ? "text-[var(--success)]" : "text-[var(--warning)]"
                            )}
                          >
                            {sl.toFixed(1)}%
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
              <ChartCard title="Recent Skill Routings" icon={Route} iconColor="text-[var(--success)]" span={3} delay={0.5}>
                <div className="mb-3 grid gap-3 print-hide">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      value={routingSearch}
                      onChange={(e) => setRoutingSearch(e.target.value)}
                      placeholder="Search contact, agent, or reasoning..."
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Match Score
                    </div>
                    {[0.85, 0.9, 0.95].map((t) => {
                      const active = minScorePill === (t as 0.85 | 0.9 | 0.95);
                      const label = `${Math.round(t * 100)}%+`;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setMinScorePill(active ? null : (t as 0.85 | 0.9 | 0.95))}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                            active
                              ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                              : "border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)]"
                          )}
                          aria-pressed={active}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {minScorePill != null && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-input)] hover:bg-[var(--accent-subtle)]"
                        onClick={() => setMinScorePill(null)}
                        aria-label="Clear match score filter"
                      >
                        <X className="h-4 w-4 text-[var(--text-secondary)]" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        <th className="py-2 text-left font-semibold">Contact</th>
                        <th className="py-2 text-left font-semibold">Agent</th>
                        <th
                          className="py-2 text-right font-semibold cursor-pointer select-none"
                          onClick={() => handleRoutingSort("matchScore")}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Match Score{" "}
                            <span className="text-[var(--text-muted)]">
                              {routingSortKey === "matchScore" ? (routingSortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </span>
                        </th>
                        <th className="py-2 text-left font-semibold">Reasoning</th>
                        <th
                          className="py-2 text-right font-semibold cursor-pointer select-none"
                          onClick={() => handleRoutingSort("tick")}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Tick{" "}
                            <span className="text-[var(--text-muted)]">
                              {routingSortKey === "tick" ? (routingSortDir === "asc" ? "▲" : "▼") : "↕"}
                            </span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoutingRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-sm text-[var(--text-secondary)]">
                            No results
                          </td>
                        </tr>
                      ) : (
                        visibleRoutingRows.map((r, idx) => {
                          const isExpanded = expandedRoutingId === r.id;
                          const isHighlighted = agentHighlight != null && r.agentId === agentHighlight;
                          const scoreBadge =
                            r.score < 0.85
                              ? { bg: "var(--warning-subtle)", fg: "var(--warning)" }
                              : r.score < 0.95
                                ? { bg: "var(--accent-subtle)", fg: "var(--accent)" }
                                : { bg: "var(--success-subtle)", fg: "var(--success)" };
                          return (
                            <FragmentRoutingRow
                              key={r.id}
                              row={r}
                              idx={idx}
                              isExpanded={isExpanded}
                              isHighlighted={isHighlighted}
                              scoreBadge={scoreBadge}
                              onToggleExpand={() =>
                                setExpandedRoutingId((prev) => (prev === r.id ? null : r.id))
                              }
                            />
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {/* Hidden PDF Capture Area */}
      {report && (
        <div 
          id="pdf-capture-root" 
          className="fixed -left-[9999px] top-0 w-[800px] bg-white text-black p-8"
          style={{ zIndex: -100 }}
        >
          <PrintReportView 
            report={report} 
            operatorRole={operatorRole}
            sessionName={report.simulationScenario || "Idle"}
            generatedAt={report.generatedAt}
            durationSeconds={report.simulationTick * 2}
          />
        </div>
      )}

      {printPreviewOpen && report && printRootEl
        ? createPortal(
            <div
              style={{
                background: "#FFFFFF",
                minHeight: "100vh",
              }}
            >
              <PrintReportView
                report={report}
                operatorRole={operatorRole}
                sessionName={report.simulationScenario || "Idle"}
                generatedAt={report.generatedAt}
                durationSeconds={report.simulationTick * 2}
              />
            </div>,
            printRootEl
          )
        : null}
    </div>
  );
}

function SortableTh({
  label,
  align,
  active,
  dir,
  onClick,
}: {
  label: string;
  align: "left" | "right";
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      className={cn(
        "py-2 font-semibold",
        align === "left" ? "text-left" : "text-right",
        "cursor-pointer select-none"
      )}
      onClick={onClick}
    >
      <span className={cn("inline-flex items-center gap-2", align === "right" ? "justify-end" : "")}>
        <span className="whitespace-nowrap">{label}</span>
        <span className="text-[var(--text-muted)]">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </span>
    </th>
  );
}

function FragmentRoutingRow({
  row,
  idx,
  isExpanded,
  isHighlighted,
  scoreBadge,
  onToggleExpand,
}: {
  row: RoutingRow;
  idx: number;
  isExpanded: boolean;
  isHighlighted: boolean;
  scoreBadge: { bg: string; fg: string };
  onToggleExpand: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-[var(--border-subtle)] transition-colors",
          idx % 2 === 1 ? "bg-[var(--border-subtle)]" : "bg-transparent",
          "hover:bg-[var(--accent-subtle)]",
          isHighlighted && "bg-[var(--accent-subtle)]"
        )}
      >
        <td
          className="py-1.5 font-mono text-[10px] text-[var(--accent)] cursor-pointer"
          onClick={onToggleExpand}
        >
          {row.contactId}
        </td>
        <td
          className="py-1.5 font-medium text-[var(--text-primary)] cursor-pointer"
          onClick={onToggleExpand}
        >
          {row.agentId}
        </td>
        <td className="py-1.5 text-right tabular-nums">
          <span
            style={{ backgroundColor: scoreBadge.bg, color: scoreBadge.fg }}
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
          >
            {row.scorePct}%
          </span>
        </td>
        <td
          className={cn(
            "max-w-[300px] py-1.5 text-[var(--text-secondary)] cursor-pointer",
            !isExpanded && "truncate"
          )}
          onClick={onToggleExpand}
        >
          {row.reasoning}
        </td>
        <td
          className="py-1.5 text-right tabular-nums text-[var(--text-muted)] cursor-pointer"
          onClick={onToggleExpand}
        >
          {row.tick}
        </td>
      </tr>

      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={5} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="px-3 py-2">
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Reasoning (full)
                  </div>
                  <div className="whitespace-pre-wrap text-[12px] text-[var(--text-primary)] leading-relaxed">
                    {row.reasoning}
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
