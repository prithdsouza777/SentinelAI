import { Activity, Play, Square, Wifi, WifiOff, Zap } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { simulationApi } from "../../services/api";
import { wsService } from "../../services/websocket";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <header className="relative flex h-14 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#05a6f0]" />

      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#172554] shadow-md">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-[#1e293b]">
            Sentinel<span className="text-gradient">AI</span>
          </h1>
        </div>
        <Badge variant="outline" className="ml-2 border-[#e2e8f0] bg-[#f1f5f9] text-[10px] text-[#64748b]">
          AI Operations Center
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          {simulationActive ? (
            <motion.div
              key="stop"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Button
                onClick={handleStopDemo}
                variant="destructive"
                size="sm"
                className="gap-2 bg-[#ef4444] text-white shadow-md hover:bg-[#dc2626]"
              >
                <Square className="h-3.5 w-3.5" />
                Stop Demo
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="start"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <Button
                onClick={handleStartDemo}
                disabled={demoLoading}
                size="sm"
                className="gap-2 bg-[#2563eb] text-white shadow-md hover:bg-[#1d4ed8]"
              >
                <Play className="h-3.5 w-3.5" />
                {demoLoading ? "Starting..." : "Start Demo"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {simulationActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2.5 py-1"
          >
            <Zap className="h-3 w-3 text-[#10b981]" />
            <span className="text-xs font-medium text-[#10b981]">Live</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
          </motion.div>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-1">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-[#10b981]" />
              <span className="text-[11px] text-[#64748b]">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 animate-pulse text-[#ef4444]" />
              <span className="text-[11px] text-[#ef4444]">Reconnecting...</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
