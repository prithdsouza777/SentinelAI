import { AlertTriangle, DollarSign, TrendingUp, ShieldCheck } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

export default function CostImpactTicker() {
  const cost = useDashboardStore((s) => s.costSummary);

  return (
    <div className="card flex items-center gap-6">
      {(cost.revenueAtRisk ?? 0) > 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 animate-pulse">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400">Revenue at Risk</p>
              <p className="text-xl font-bold text-red-400">
                ${(cost.revenueAtRisk ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-gray-800" />
        </>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-success/15">
          <DollarSign className="h-5 w-5 text-accent-success" />
        </div>
        <div>
          <p className="text-xs text-gray-400">Total Saved</p>
          <p className="text-xl font-bold text-accent-success">
            ${cost.totalSaved.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="h-8 w-px bg-gray-800" />

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-brand-400" />
        <div>
          <p className="text-xs text-gray-400">Prevented Abandoned</p>
          <p className="text-lg font-semibold">{cost.totalPreventedAbandoned}</p>
        </div>
      </div>

      <div className="h-8 w-px bg-gray-800" />

      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-purple-400" />
        <div>
          <p className="text-xs text-gray-400">AI Actions Today</p>
          <p className="text-lg font-semibold">{cost.actionsToday}</p>
        </div>
      </div>
    </div>
  );
}
