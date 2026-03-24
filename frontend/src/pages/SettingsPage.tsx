import { useState, useEffect, useCallback } from "react";
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
  MessageSquare,
  Mail,
  Send,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { healthApi, notificationsApi } from "../services/api";
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

  // Notification config state
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsNotifyOn, setTeamsNotifyOn] = useState("critical");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [emailNotifyOn, setEmailNotifyOn] = useState("critical");
  const [notifCooldown, setNotifCooldown] = useState(60);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [testingTeams, setTestingTeams] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ channel: string; status: string; message: string } | null>(null);

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

  const fetchNotifConfig = useCallback(() => {
    notificationsApi.getConfig().then((raw: unknown) => {
      const data = raw as Record<string, unknown>;
      setTeamsWebhookUrl((data.teamsWebhookUrl as string) || "");
      setTeamsNotifyOn((data.teamsNotifyOn as string) || "critical");
      setSmtpHost((data.smtpHost as string) || "");
      setSmtpPort((data.smtpPort as number) || 587);
      setSmtpUser((data.smtpUser as string) || "");
      setSmtpPassword((data.smtpPassword as string) || "");
      setSmtpFrom((data.smtpFrom as string) || "");
      setSmtpTo((data.smtpTo as string) || "");
      setEmailNotifyOn((data.emailNotifyOn as string) || "critical");
      setNotifCooldown((data.notificationCooldown as number) || 60);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchNotifConfig();
    const unsub = wsService.onConnectionChange((connected) => {
      setWsConnected(connected);
    });
    return unsub;
  }, [fetchNotifConfig]);

  const saveNotifConfig = async () => {
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      await notificationsApi.updateConfig({
        teams_webhook_url: teamsWebhookUrl,
        teams_notify_on: teamsNotifyOn,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        smtp_from: smtpFrom,
        smtp_to: smtpTo,
        email_notify_on: emailNotifyOn,
        notification_cooldown: notifCooldown,
      });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } catch {
      setTestResult({ channel: "config", status: "error", message: "Failed to save configuration" });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleTestTeams = async () => {
    setTestingTeams(true);
    setTestResult(null);
    try {
      const res = await notificationsApi.testTeams() as { status: string; message: string };
      setTestResult({ channel: "teams", ...res });
    } catch {
      setTestResult({ channel: "teams", status: "error", message: "Request failed" });
    } finally {
      setTestingTeams(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestResult(null);
    try {
      const res = await notificationsApi.testEmail() as { status: string; message: string };
      setTestResult({ channel: "email", ...res });
    } catch {
      setTestResult({ channel: "email", status: "error", message: "Request failed" });
    } finally {
      setTestingEmail(false);
    }
  };

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
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
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

      {/* Microsoft Teams Notifications */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Microsoft Teams Notifications
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleTestTeams}
            disabled={testingTeams || !teamsWebhookUrl}
            className="h-7 border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            <Send className={cn("mr-1 h-3 w-3", testingTeams && "animate-spin")} />
            Test
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">Webhook URL</label>
            <input
              type="url"
              value={teamsWebhookUrl}
              onChange={(e) => setTeamsWebhookUrl(e.target.value)}
              placeholder="https://outlook.office.com/webhook/..."
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            />
            <p className="mt-1 text-[10px] text-[#94a3b8]">Create an Incoming Webhook connector in your Teams channel</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">Notify on</label>
            <select
              value={teamsNotifyOn}
              onChange={(e) => setTeamsNotifyOn(e.target.value)}
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            >
              <option value="critical">Critical alerts only</option>
              <option value="warning">Warning + Critical</option>
              <option value="all">All alerts</option>
              <option value="none">Disabled</option>
            </select>
          </div>
          {testResult?.channel === "teams" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium",
                testResult.status === "ok"
                  ? "bg-[#10b981]/10 text-[#10b981]"
                  : "bg-[#ef4444]/10 text-[#ef4444]"
              )}
            >
              {testResult.message}
            </motion.div>
          )}
        </div>
      </div>

      {/* Outlook / Email Notifications */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#2563eb]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Outlook / Email Notifications
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleTestEmail}
            disabled={testingEmail || !smtpHost || !smtpTo}
            className="h-7 border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9]"
          >
            <Send className={cn("mr-1 h-3 w-3", testingEmail && "animate-spin")} />
            Test
          </Button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">SMTP Host</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.office365.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">SMTP Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">Username</label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="alerts@company.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">Password</label>
              <div className="relative">
                <input
                  type={showSmtpPassword ? "text" : "password"}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="App password"
                  className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 pr-9 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569]"
                >
                  {showSmtpPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">From address</label>
            <input
              type="email"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="sentinelai-alerts@company.com"
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">Recipients (comma-separated)</label>
            <input
              type="text"
              value={smtpTo}
              onChange={(e) => setSmtpTo(e.target.value)}
              placeholder="ops-team@company.com, manager@company.com"
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">Notify on</label>
              <select
                value={emailNotifyOn}
                onChange={(e) => setEmailNotifyOn(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              >
                <option value="critical">Critical alerts only</option>
                <option value="warning">Warning + Critical</option>
                <option value="all">All alerts</option>
                <option value="none">Disabled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">Cooldown (seconds)</label>
              <input
                type="number"
                value={notifCooldown}
                onChange={(e) => setNotifCooldown(Number(e.target.value))}
                min={10}
                max={600}
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
              <p className="mt-1 text-[10px] text-[#94a3b8]">Minimum seconds between notifications per channel</p>
            </div>
          </div>
          {testResult?.channel === "email" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium",
                testResult.status === "ok"
                  ? "bg-[#10b981]/10 text-[#10b981]"
                  : "bg-[#ef4444]/10 text-[#ef4444]"
              )}
            >
              {testResult.message}
            </motion.div>
          )}
        </div>
      </div>

      {/* Save Notification Settings */}
      <div className="flex items-center gap-3">
        <Button
          onClick={saveNotifConfig}
          disabled={notifSaving}
          className="h-9 bg-[#2563eb] px-4 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <Save className={cn("mr-1.5 h-3.5 w-3.5", notifSaving && "animate-spin")} />
          {notifSaving ? "Saving..." : "Save Notification Settings"}
        </Button>
        {notifSaved && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-xs font-medium text-[#10b981]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Saved
          </motion.span>
        )}
        {testResult?.channel === "config" && (
          <span className="text-xs font-medium text-[#ef4444]">{testResult.message}</span>
        )}
      </div>
    </div>
  );
}
