import { Activity, Wifi } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

export default function Header() {
  const simulationActive = useDashboardStore((s) => s.simulationActive);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-surface-raised px-6">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-brand-500" />
        <h1 className="text-lg font-semibold tracking-tight">
          Connect<span className="text-brand-500">IQ</span>
        </h1>
        <span className="text-xs text-gray-500">AI Operations Center</span>
      </div>

      <div className="flex items-center gap-4">
        {simulationActive && (
          <span className="badge badge-warning">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-warning" />
            Simulation Mode
          </span>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Wifi className="h-3.5 w-3.5 text-accent-success" />
          Connected
        </div>
      </div>
    </header>
  );
}
