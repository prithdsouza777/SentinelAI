import { useState, useEffect } from "react";
import { Settings, Server, Database, Brain, Wifi, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { healthApi } from "../services/api";
import { wsService } from "../services/websocket";

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
  const bedrockInfo = getServiceStatus("bedrock");

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
      detail: wsConnected ? "ws://localhost:8000/ws/dashboard" : "Disconnected",
    },
    {
      label: "Redis",
      icon: Database,
      status: redisInfo.status,
      detail: redisInfo.detail,
    },
    {
      label: "Amazon Bedrock",
      icon: Brain,
      status: bedrockInfo.status,
      detail: bedrockInfo.detail,
    },
  ];

  const resolveStatusDisplay = (status: string) => {
    if (status === "connected" || status === "bedrock") {
      return { icon: CheckCircle, color: "text-accent-success", label: "Connected" };
    }
    if (status === "mock") {
      return { icon: CheckCircle, color: "text-accent-warning", label: "Mock" };
    }
    if (status === "simulation") {
      return { icon: CheckCircle, color: "text-brand-400", label: "Simulation" };
    }
    if (status === "unavailable") {
      return { icon: XCircle, color: "text-gray-500", label: "Unavailable" };
    }
    if (status === "error") {
      return { icon: XCircle, color: "text-accent-danger", label: "Error" };
    }
    if (status === "checking") {
      return { icon: RefreshCw, color: "text-gray-400 animate-spin", label: "Checking..." };
    }
    return { icon: XCircle, color: "text-accent-warning", label: "Pending" };
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-gray-500">
            System configuration and connection status
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Connection Status */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Connection Status</span>
          <Settings className="h-4 w-4 text-gray-500" />
        </div>
        <div className="space-y-3">
          {statusItems.map((item) => {
            const Icon = item.icon;
            const display = resolveStatusDisplay(item.status);
            const StatusIcon = display.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={clsx("h-4 w-4", display.color)} />
                  <span className={clsx("text-xs", display.color)}>
                    {display.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Operating Mode</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-200">Simulation Mode</p>
            <p className="text-xs text-gray-500">
              Uses generated data instead of a live AWS Connect instance
            </p>
          </div>
          <span
            className={clsx(
              "badge",
              health?.simulation_mode ? "badge-warning" : "badge-success"
            )}
          >
            {health?.simulation_mode ? "Simulation" : "Live"}
          </span>
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Agent Thresholds</span>
        </div>
        <div className="space-y-3">
          {[
            { label: "Queue depth warning", value: "2x baseline", key: "queue_depth_warn" },
            { label: "Queue depth critical", value: "3x baseline", key: "queue_depth_crit" },
            { label: "Abandonment warning", value: "15%", key: "abandon_warn" },
            { label: "Abandonment critical", value: "30%", key: "abandon_crit" },
            { label: "Agent drop alert", value: "25% in 5min", key: "agent_drop" },
          ].map((threshold) => (
            <div
              key={threshold.key}
              className="flex items-center justify-between rounded-lg bg-surface px-4 py-3"
            >
              <span className="text-sm text-gray-300">{threshold.label}</span>
              <span className="font-mono text-sm text-gray-400">
                {threshold.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
