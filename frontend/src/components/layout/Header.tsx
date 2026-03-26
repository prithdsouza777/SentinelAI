import { LogOut, Play, Square, Wifi, WifiOff, Zap, BrainCircuit } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { simulationApi, governanceApi } from "../../services/api";
import { wsService } from "../../services/websocket";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { clearSessionToken } from "@/components/auth/authToken";
import { cn } from "@/lib/utils";

export default function Header() {
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const setSimulationActive = useDashboardStore((s) => s.setSimulationActive);
  const resetForNewDemo = useDashboardStore((s) => s.resetForNewDemo);
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(wsService.connected);
  const [initialLoading, setInitialLoading] = useState(true);
  const [raiaTraces, setRaiaTraces] = useState(0);
  const prevTraces = useRef(0);

  useEffect(() => {
    const unsub = wsService.onConnectionChange((connected) => {
      setWsConnected(connected);
      setInitialLoading(false);
    });
    // Fallback to stop initial loading if no change after 3s
    const timer = setTimeout(() => setInitialLoading(false), 3000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // Poll RAIA trace count when simulation is active
  useEffect(() => {
    if (!simulationActive) return;
    const poll = async () => {
      try {
        const res = await governanceApi.getStatus();
        prevTraces.current = raiaTraces;
        setRaiaTraces(res.raia.interactions ?? 0);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [simulationActive]);

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

  const handleLogout = () => {
    clearSessionToken();
    navigate("/login", { replace: true });
  };

  return (
    <header className="relative flex h-16 items-center justify-between border-b border-[#e2e8f0] bg-white px-6">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#05a6f0]" />

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-[#1e293b]">
          AI Operations Center
        </h1>
        <Badge variant="outline" className="border-[#e2e8f0] bg-[#f1f5f9] text-xs font-medium text-[#64748b]">
          AWS Connect
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
                size="sm"
                className="gap-2 rounded-full bg-[#ef4444] text-white shadow-md hover:bg-[#dc2626]"
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
                className="gap-2 rounded-full bg-[#2563eb] text-white shadow-md hover:bg-[#1d4ed8]"
              >
                <Play className="h-3.5 w-3.5" />
                {demoLoading ? "Starting..." : "Start Demo"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {simulationActive && (
          <>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-2.5 py-1"
            >
              <Zap className="h-3 w-3 text-[#10b981]" />
              <span className="text-xs font-semibold text-[#10b981]">Live</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
            </motion.div>

            {raiaTraces > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 px-2.5 py-1"
              >
                <BrainCircuit className="h-3 w-3 text-[#8b5cf6]" />
                <span className="text-[11px] font-medium text-[#64748b]">RAIA</span>
                <motion.span
                  key={raiaTraces}
                  initial={raiaTraces > prevTraces.current ? { scale: 1.4, color: "#8b5cf6" } : false}
                  animate={{ scale: 1, color: "#8b5cf6" }}
                  transition={{ duration: 0.3 }}
                  className="text-xs font-bold tabular-nums"
                >
                  {raiaTraces}
                </motion.span>
              </motion.div>
            )}
          </>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1">
          {wsConnected ? (
            <>
              <Wifi className="h-3 w-3 text-[#10b981]" />
              <span className="text-[11px] font-medium text-[#64748b]">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className={cn("h-3 w-3 text-[#ef4444]", !initialLoading && "animate-pulse")} />
              <span className="text-[11px] font-medium text-[#ef4444]">
                {initialLoading ? "Connecting..." : "Reconnecting..."}
              </span>
            </>
          )}
        </div>

        <ThemeToggle />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-2 text-[#64748b] hover:text-[#1e293b]"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
