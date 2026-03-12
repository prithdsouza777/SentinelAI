import { useState, useEffect } from "react";
import { Settings, Server, Database, Brain, Wifi, CheckCircle, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { healthApi } from "../services/api";

interface HealthStatus {
  status: string;
  version: string;
  simulation_mode: boolean;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    healthApi
      .check()
      .then((data) => {
        setHealth(data as HealthStatus);
        setHealthError(false);
      })
      .catch(() => setHealthError(true));
  }, []);

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
      status: "connected" as const,
      detail: "ws://localhost:8000/ws/dashboard",
    },
    {
      label: "Redis",
      icon: Database,
      status: "pending" as const,
      detail: "localhost:6379",
    },
    {
      label: "Amazon Bedrock",
      icon: Brain,
      status: "pending" as const,
      detail: "Not configured",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-gray-500">
          System configuration and connection status
        </p>
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
                  {item.status === "connected" ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-accent-success" />
                      <span className="text-xs text-accent-success">Connected</span>
                    </>
                  ) : item.status === "error" ? (
                    <>
                      <XCircle className="h-4 w-4 text-accent-danger" />
                      <span className="text-xs text-accent-danger">Error</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-accent-warning" />
                      <span className="text-xs text-accent-warning">Pending</span>
                    </>
                  )}
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
