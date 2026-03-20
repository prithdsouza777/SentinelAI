import { useState, useEffect } from "react";
import {
  Settings,
  Server,
  Database,
  Brain,
  Wifi,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Shield,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { healthApi } from "../services/api";
import { wsService } from "../services/websocket";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface ServiceStatus {
  status: string;
  detail?: string;
  model?: string;
}

interface HealthResponse {
  status: string;
  version: string;
  simulation_mode: boolean;
  services?: {
    redis?: ServiceStatus;
    bedrock?: ServiceStatus;
  };
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [wsConnected, setWsConnected] = useState(wsService.connected);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = () => {
    setRefreshing(true);
    healthApi
      .check()
      .then((data) => {
        setHealth(data as HealthResponse);
        setHealthError(false);
      })
      .catch(() => setHealthError(true))
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    fetchHealth();
    const unsub = wsService.onConnectionChange((connected) => {
      setWsConnected(connected);
    });
    return unsub;
  }, []);

  const getServiceStatus = (key: string): { status: string; detail: string } => {
    if (!health?.services) return { status: "checking", detail: "..." };
    const svc = (health.services as Record<string, ServiceStatus>)[key];
    if (!svc) return { status: "pending", detail: "Not configured" };
    return { status: svc.status, detail: svc.detail || svc.model || "" };
  };

  const redisInfo = getServiceStatus("redis");
  const llmSvc = (health?.services as Record<string, Record<string, string>> | undefined)?.llm;
  const llmInfo = llmSvc
    ? { status: llmSvc.provider ? "connected" : "pending", detail: `${llmSvc.provider || "none"} - ${llmSvc.model || "unknown"}` }
    : { status: "checking" as string, detail: "..." };

  const statusItems = [
    {
      label: "Backend API",
      icon: Server,
      status: health ? "connected" : healthError ? "error" : "checking",
      detail: health ? `v${health.version}` : healthError ? "Unreachable" : "...",
    },
    {
      label: "WebSocket",
      icon: Wifi,
      status: wsConnected ? "connected" : "error",
      detail: wsConnected ? "Connected" : "Disconnected",
    },
    {
      label: "Redis",
      icon: Database,
      status: redisInfo.status === "unavailable" ? "simulation" : redisInfo.status,
      detail: redisInfo.status === "unavailable" ? "In-memory fallback (OK)" : redisInfo.detail,
    },
    {
      label: "LLM Provider",
      icon: Brain,
      status: llmInfo.status,
      detail: llmInfo.detail,
    },
  ];

  const resolveStatusDisplay = (status: string) => {
    if (status === "connected" || status === "bedrock") {
      return { icon: CheckCircle2, color: "text-[#10b981]", bg: "bg-[#10b981]/10", label: "Connected" };
    }
    if (status === "mock") {
      return { icon: CheckCircle2, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", label: "Mock" };
    }
    if (status === "simulation") {
      return { icon: CheckCircle2, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", label: "Simulation" };
    }
    if (status === "unavailable") {
      return { icon: XCircle, color: "text-[#94a3b8]", bg: "bg-[#f1f5f9]", label: "Unavailable" };
    }
    if (status === "error") {
      return { icon: XCircle, color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", label: "Error" };
    }
    if (status === "checking") {
      return { icon: RefreshCw, color: "text-[#94a3b8] animate-spin", bg: "bg-[#f1f5f9]", label: "Checking..." };
    }
    return { icon: XCircle, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", label: "Pending" };
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto pr-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1e293b]">Settings</h2>
          <p className="text-sm text-[#64748b]">
            System configuration and connection status
          </p>
        </div>
        <Button
          size="sm"
          onClick={fetchHealth}
          disabled={refreshing}
          className="h-8 border border-[#e2e8f0] bg-white text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
        >
          <RefreshCw className={cn("mr-1.5 h-3 w-3", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Connection Status */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#2563eb]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Connection Status
            </span>
          </div>
          <Settings className="h-4 w-4 text-[#94a3b8]" />
        </div>
        <div className="space-y-2 p-3">
          {statusItems.map((item, i) => {
            const Icon = item.icon;
            const display = resolveStatusDisplay(item.status);
            const StatusIcon = display.icon;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-[#e2e8f0]">
                    <Icon className="h-4 w-4 text-[#64748b]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1e293b]">{item.label}</p>
                    <p className="text-[11px] text-[#64748b]">{item.detail}</p>
                  </div>
                </div>
                <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1", display.bg)}>
                  <StatusIcon className={cn("h-3.5 w-3.5", display.color)} />
                  <span className={cn("text-[11px] font-semibold", display.color)}>
                    {display.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Operating Mode */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
          <Gauge className="h-4 w-4 text-[#8b5cf6]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            Operating Mode
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#1e293b]">Simulation Mode</p>
              <p className="text-[11px] text-[#64748b]">
                Uses generated data instead of a live AWS Connect instance
              </p>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              health?.simulation_mode
                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                : "bg-[#10b981]/10 text-[#10b981]"
            )}>
              {health?.simulation_mode ? "Simulation" : "Live"}
            </span>
          </div>
        </div>
      </div>

      {/* Agent Thresholds */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3">
          <Gauge className="h-4 w-4 text-[#06b6d4]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
            Agent Thresholds
          </span>
        </div>
        <div className="space-y-2 p-3">
          {[
            { label: "Queue depth warning", value: "2x baseline" },
            { label: "Queue depth critical", value: "3x baseline" },
            { label: "Abandonment warning", value: "15%" },
            { label: "Abandonment critical", value: "30%" },
            { label: "Agent drop alert", value: "25% in 5min" },
          ].map((threshold, i) => (
            <motion.div
              key={threshold.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="flex items-center justify-between rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3"
            >
              <span className="text-sm text-[#475569]">{threshold.label}</span>
              <span className="font-mono text-sm font-medium tabular-nums text-[#1e293b]">
                {threshold.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
