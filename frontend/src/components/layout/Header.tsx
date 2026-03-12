import { Activity, Play, Square, Wifi, WifiOff } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { simulationApi } from "../../services/api";
import { wsService } from "../../services/websocket";
import { useState, useEffect } from "react";

export default function Header() {
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const setSimulationActive = useDashboardStore((s) => s.setSimulationActive);
  const resetForNewDemo = useDashboardStore((s) => s.resetForNewDemo);
  const [demoLoading, setDemoLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(true);

  useEffect(() => {
    const unsub = wsService.onConnectionChange((connected) => {
      setWsConnected(connected);
    });
    return unsub;
  }, []);

  const handleStartDemo = async () => {
    setDemoLoading(true);
    try {
      resetForNewDemo();
      await simulationApi.start("sentinelai_demo");
      setSimulationActive(true);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleStopDemo = async () => {
    await simulationApi.stop();
    setSimulationActive(false);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-surface-raised px-6">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-brand-500" />
        <h1 className="text-lg font-semibold tracking-tight">
          Sentinel<span className="text-brand-500">AI</span>
        </h1>
        <span className="text-xs text-gray-500">AI Operations Center</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Demo button — always visible */}
        {simulationActive ? (
          <button
            onClick={handleStopDemo}
            className="flex items-center gap-2 rounded-lg bg-accent-danger/15 px-4 py-1.5 text-sm font-medium text-accent-danger transition-colors hover:bg-accent-danger/25"
          >
            <Square className="h-3.5 w-3.5" />
            Stop Demo
          </button>
        ) : (
          <button
            onClick={handleStartDemo}
            disabled={demoLoading}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-brand-700/30 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {demoLoading ? "Starting..." : "Start Demo"}
          </button>
        )}

        {simulationActive && (
          <span className="badge badge-warning">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-warning" />
            Live
          </span>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-xs">
          {wsConnected ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-accent-success" />
              <span className="text-gray-400">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 animate-pulse text-accent-danger" />
              <span className="text-accent-danger">Reconnecting...</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
