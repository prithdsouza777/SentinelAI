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
    <header className="relative flex h-14 items-center justify-between border-b border-white/[0.06] bg-surface-raised/80 px-6 backdrop-blur-xl">
      {/* Subtle top glow line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">
            Sentinel<span className="text-gradient">AI</span>
          </h1>
        </div>
        <Badge variant="outline" className="ml-2 border-white/10 text-[10px] text-muted-foreground">
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
                className="gap-2 shadow-lg shadow-red-500/20"
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
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500"
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
            className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1"
          >
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Live</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          </motion.div>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] px-2.5 py-1">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-[11px] text-muted-foreground">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 animate-pulse text-red-400" />
              <span className="text-[11px] text-red-400">Reconnecting...</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
