import { Shield, CheckCircle2, UserCheck, XOctagon } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

function ConfidenceDot({ value }: { value: number }) {
  const color =
    value >= 0.9
      ? "bg-accent-success"
      : value >= 0.7
        ? "bg-accent-warning"
        : "bg-accent-danger";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function PercentBar({
  value,
  total,
  colorClass,
}: {
  value: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-gray-400">
        {pct}%
      </span>
    </div>
  );
}

export default function GovernanceScorecardWidget() {
  const g = useDashboardStore((s) => s.governance);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-accent-info" />
          AI Governance
        </span>
        {g.totalDecisions > 0 && (
          <span className="text-xs text-gray-500">
            {g.totalDecisions} decisions
          </span>
        )}
      </div>

      {g.totalDecisions === 0 ? (
        <p className="text-xs text-gray-500">
          No decisions yet — start the simulation.
        </p>
      ) : (
        <div className="space-y-2.5">
          {/* Auto-approved */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
              <CheckCircle2 className="h-3 w-3 text-accent-success" />
              Auto-approved ({g.autoApproved})
            </div>
            <PercentBar
              value={g.autoApproved}
              total={g.totalDecisions}
              colorClass="bg-accent-success"
            />
          </div>

          {/* Human-approved */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
              <UserCheck className="h-3 w-3 text-accent-warning" />
              Human-approved ({g.humanApproved})
            </div>
            <PercentBar
              value={g.humanApproved}
              total={g.totalDecisions}
              colorClass="bg-accent-warning"
            />
          </div>

          {/* Blocked */}
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
              <XOctagon className="h-3 w-3 text-accent-danger" />
              Blocked ({g.blocked})
            </div>
            <PercentBar
              value={g.blocked}
              total={g.totalDecisions}
              colorClass="bg-accent-danger"
            />
          </div>

          {/* Avg confidence */}
          <div className="flex items-center justify-between border-t border-gray-800 pt-2">
            <span className="text-xs text-gray-500">Avg confidence</span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-300">
              {(g.avgConfidence * 100).toFixed(0)}%
              <ConfidenceDot value={g.avgConfidence} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
