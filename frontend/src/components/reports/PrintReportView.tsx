import type { SessionReport } from "../../types";

type PrintReportViewProps = {
  report: SessionReport;
  operatorRole: string;
  sessionName: string;
  generatedAt: string;
  durationSeconds: number;
};

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInt(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function barString(percent: number, length = 10) {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * length);
  const empty = length - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function scorePillColor(pct: number) {
  if (pct >= 95) {
    return { bg: "#D1FAE5", fg: "#10B981" };
  }
  if (pct >= 85) {
    return { bg: "#DBEAFE", fg: "#3B82F6" };
  }
  return { bg: "#FFEDD5", fg: "#F59E0B" };
}

function serviceLevelColor(sl: number) {
  if (sl >= 95) return "#10B981";
  if (sl >= 90) return "#3B82F6";
  return "#F59E0B";
}

export default function PrintReportView({
  report,
  operatorRole,
  sessionName,
  generatedAt,
  durationSeconds,
}: PrintReportViewProps) {
  const timestamp = new Date(generatedAt).toLocaleString();

  const alertsBySeverity = report.alerts.bySeverity ?? {};
  const totalAlerts = report.alerts.total ?? 0;
  const warningCount = alertsBySeverity.warning ?? 0;
  const criticalCount = alertsBySeverity.critical ?? 0;
  const warningPct = totalAlerts > 0 ? (warningCount / totalAlerts) * 100 : 0;
  const criticalPct = totalAlerts > 0 ? (criticalCount / totalAlerts) * 100 : 0;

  const gov = report.governance;
  const totalDecisions = gov.totalDecisions ?? 0;
  const autoPct = totalDecisions > 0 ? (gov.autoApproved / totalDecisions) * 100 : 0;
  const humanPct = totalDecisions > 0 ? (gov.humanApproved / totalDecisions) * 100 : 0;
  const blockedPct = totalDecisions > 0 ? (gov.blocked / totalDecisions) * 100 : 0;

  const byAgent = report.decisions.byAgent ?? {};
  const skillRouterCount = byAgent.skill_router ?? 0;
  const escalationHandlerCount = byAgent.escalation_handler ?? 0;
  const queueBalancerCount = byAgent.queue_balancer ?? 0;
  const predictivePreventionCount = byAgent.predictive_prevention ?? 0;

  const queueNames = ["Support", "Billing", "Sales", "General", "VIP"];
  const routingRows = (report.skillRouting.recentRoutings ?? []).slice(0, 10);

  return (
    <div
      style={{
        background: "#FFFFFF",
        color: "#0F172A",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        width: "210mm",
        maxWidth: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* Page-fixed footer (CSS counters) */}
      <style>{`
        #print-report-root .print-footer {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 14mm;
          font-size: 11px;
          color: #475569;
          text-align: center;
        }
        #print-report-root .print-page-num::after { content: counter(page); }
        #print-report-root .print-pages-num::after { content: counter(pages); }
        #print-report-root table { border-collapse: collapse; }
        #print-report-root .print-kpi {
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 12px 14px;
          background: #FFFFFF;
        }
        #print-report-root .print-section-heading {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
          border-left: 2px solid #3B82F6;
          padding-left: 8px;
          margin: 18px 0 10px;
          font-weight: 700;
        }
        #print-report-root .print-table {
          width: 100%;
          border: 1px solid #E2E8F0;
        }
        #print-report-root .print-th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          background: #F8F9FA;
          font-weight: 800;
          padding: 8px 8px;
          border: 1px solid #E2E8F0;
        }
        #print-report-root .print-td {
          font-size: 12px;
          color: #0F172A;
          padding: 8px 8px;
          border: 1px solid #E2E8F0;
          vertical-align: top;
        }
        #print-report-root .print-row-alt {
          background: #F8F9FA;
        }
        #print-report-root .print-reasoning-wrap {
          white-space: normal;
          word-break: break-word;
          line-height: 1.35;
        }
        #print-report-root .print-monosp {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        #print-report-root .print-pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 9999px;
          font-weight: 800;
          font-size: 12px;
          line-height: 1;
        }
        #print-report-root .print-split-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        #print-report-root .print-ovr-bar {
          border-left: 1px solid #E2E8F0;
          padding-left: 12px;
          flex: 1;
          text-align: center;
        }
        #print-report-root .print-bar-lines {
          font-size: 12px;
          color: #0F172A;
        }
        #print-report-root .print-bar-string {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          letter-spacing: 0.02em;
        }
      `}</style>

      <div style={{ paddingBottom: 0 }}>
        {/* [PAGE 1] Branding header */}
        <div
          style={{
            border: "2px solid #3B82F6",
            padding: 14,
            borderRadius: 8,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2l8 4v6c0 5-3.2 9.7-8 10-4.8-.3-8-5-8-10V6l8-4z"
                fill="#3B82F6"
              />
              <path
                d="M12 7.2l4.2 2.1v3.2c0 2.9-1.7 5.6-4.2 5.9-2.5-.3-4.2-3-4.2-5.9V9.3L12 7.2z"
                fill="#1D4ED8"
                opacity="0.35"
              />
            </svg>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, color: "#3B82F6", fontSize: 14 }}>
                SentinelAI — AI Operations Center
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>Session Intelligence Report</div>
              <div style={{ fontSize: 11, marginTop: 6, color: "#475569" }}>
                Generated: {timestamp} &nbsp; | &nbsp; Session: {sessionName}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, color: "#475569" }}>
                Operator: {operatorRole} &nbsp; | &nbsp; Duration: {formatDuration(durationSeconds)}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1 — Executive Summary */}
        <div className="print-section">
        <div className="print-section-heading">Executive Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="print-kpi">
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Total Saved
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#3B82F6", marginTop: 6 }}>
              {formatMoney(report.costImpact.totalSaved)}
            </div>
          </div>
          <div className="print-kpi">
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Revenue at Risk
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#3B82F6", marginTop: 6 }}>
              {formatMoney(report.costImpact.revenueAtRisk)}
            </div>
          </div>
          <div className="print-kpi">
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              Prevented Abandoned
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#3B82F6", marginTop: 6 }}>
              {formatInt(report.costImpact.preventedAbandoned)}
            </div>
          </div>
          <div className="print-kpi">
            <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
              AI Actions
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#3B82F6", marginTop: 6 }}>
              {formatInt(report.costImpact.actionsToday)}
            </div>
          </div>
        </div>
        </div>

        {/* SECTION 2 — Session Overview */}
        <div className="print-section">
        <div className="print-section-heading">Session Overview</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0 }}>
          {[
            ["Scenario", report.simulationScenario || "Idle"],
            ["Tick", report.simulationTick],
            ["Total Alerts", report.alerts.total],
            ["Decisions", report.decisions.total],
            ["Executed", report.decisions.executed],
            ["Contacts Routed", report.skillRouting.totalRouted],
          ].map(([k, v], idx) => (
            <div
              key={k}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "10px 0",
                borderLeft: idx === 0 ? "none" : "1px solid #E2E8F0",
              }}
            >
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#475569", fontWeight: 800 }}>
                {k}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginTop: 3 }}>{String(v)}</div>
            </div>
          ))}
        </div>
        </div>

        {/* SECTION 3 — Performance Metrics (3-column) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {/* Column 1: Alerts by Severity */}
          <div className="print-section">
            <div className="print-section-heading">Alerts by Severity</div>
            <div className="print-bar-lines" style={{ marginTop: 6 }}>
              <div>
                <strong>Warning:</strong> {warningCount}{" "}
                <span className="print-bar-string">
                  {barString(warningPct)}
                </span>{" "}
                {Math.round(warningPct)}%
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Critical:</strong> {criticalCount}{" "}
                <span className="print-bar-string">
                  {barString(criticalPct)}
                </span>{" "}
                {Math.round(criticalPct)}%
              </div>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#475569" }}>
                Total: {totalAlerts}
              </div>
            </div>
          </div>

          {/* Column 2: Guardrail Outcomes */}
          <div className="print-section">
            <div className="print-section-heading">Guardrail Outcomes</div>
            <div style={{ marginTop: 6 }} className="print-bar-lines">
              <div>
                <strong>Auto-Approved:</strong> {gov.autoApproved}{" "}
                <span className="print-bar-string">{barString(autoPct)}</span> {Math.round(autoPct)}%
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Human-Approved:</strong> {gov.humanApproved}{" "}
                <span className="print-bar-string">{barString(humanPct)}</span> {Math.round(humanPct)}%
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Blocked:</strong> {gov.blocked}{" "}
                <span className="print-bar-string">{barString(blockedPct)}</span> {Math.round(blockedPct)}%
              </div>
            </div>
          </div>

          {/* Column 3: Decisions by Agent */}
          <div className="print-section">
            <div className="print-section-heading">Decisions by Agent</div>
            <div style={{ marginTop: 6, fontSize: 12 }} className="print-bar-lines">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>Skill Router</span>
                <span style={{ fontWeight: 900 }}>{skillRouterCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                <span>Escalation Handler</span>
                <span style={{ fontWeight: 900 }}>{escalationHandlerCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                <span>Queue Balancer</span>
                <span style={{ fontWeight: 900 }}>{queueBalancerCount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                <span>Predictive Prevention</span>
                <span style={{ fontWeight: 900 }}>{predictivePreventionCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4 — Queue Performance Table */}
        <div className="print-section">
        <div className="print-section-heading">Queue Performance</div>
        <table className="print-table">
          <thead>
            <tr>
              {["Queue", "Contacts", "Agents Online", "Available", "Avg Wait", "Abandon %", "Service Level"].map((h) => (
                <th key={h} className="print-th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queueNames.map((name, idx) => {
              const q = (report.queues?.[name] as any) ?? {};
              const sl = Number(q.serviceLevel ?? 0);
              const slColor = serviceLevelColor(sl);
              return (
                <tr key={name} className={idx % 2 === 1 ? "print-row-alt" : ""}>
                  <td className="print-td" style={{ fontWeight: 800 }}>{name}</td>
                  <td className="print-td" style={{ textAlign: "right" }}>{Number(q.currentContacts ?? 0)}</td>
                  <td className="print-td" style={{ textAlign: "right" }}>{Number(q.agentsOnline ?? 0)}</td>
                  <td className="print-td" style={{ textAlign: "right" }}>{Number(q.agentsAvailable ?? 0)}</td>
                  <td className="print-td" style={{ textAlign: "right" }}>{Number(q.avgWaitTime ?? 0).toFixed(1)}s</td>
                  <td className="print-td" style={{ textAlign: "right" }}>{Number(q.abandonmentRate ?? 0).toFixed(1)}%</td>
                  <td className="print-td" style={{ textAlign: "right" }}>
                    <span style={{ color: slColor, fontWeight: 900 }}>{sl.toFixed(1)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* SECTION 5 — Recent Skill Routings */}
        <div className="print-section">
        <div className="print-section-heading">Recent Skill Routings</div>
        <table className="print-table">
          <thead>
            <tr>
              {["Contact ID", "Agent", "Match Score", "Reasoning", "Tick"].map((h) => (
                <th key={h} className="print-th">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routingRows.map((r, idx) => {
              const pct = Math.round((r.score ?? 0) * 100);
              const pill = scorePillColor(pct);
              return (
                <tr key={`${r.contactId}-${r.agentId}-${r.tick}-${idx}`} className={idx % 2 === 1 ? "print-row-alt" : ""}>
                  <td className="print-td" style={{ fontWeight: 800 }}>
                    <span className="print-monosp">{r.contactId}</span>
                  </td>
                  <td className="print-td" style={{ fontWeight: 800 }}>{r.agentId}</td>
                  <td className="print-td" style={{ textAlign: "right" }}>
                    <span className="print-pill" style={{ background: pill.bg, color: pill.fg }}>
                      {pct}%
                    </span>
                  </td>
                  <td className="print-td">
                    <div className="print-reasoning-wrap">{r.reasoning}</div>
                  </td>
                  <td className="print-td" style={{ textAlign: "right" }}>{r.tick}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="print-footer">
        SentinelAI — Confidential &nbsp; | &nbsp; {timestamp} &nbsp; | &nbsp; Page <span className="print-page-num" /> of{" "}
        <span className="print-pages-num" />
      </div>
    </div>
  );
}

