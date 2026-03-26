import { useState, useEffect, useCallback, useRef } from "react";
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
  Send,
  Save,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { healthApi, notificationsApi, agentsApi } from "../services/api";
import { wsService } from "../services/websocket";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
  const [initialLoading, setInitialLoading] = useState(true);
  const initialMount = useRef(true);

  // Notification config state
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsNotifyOn, setTeamsNotifyOn] = useState("critical");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [emailNotifyOn, setEmailNotifyOn] = useState("human_approval");
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);
  const [testingTeams, setTestingTeams] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ channel: string; status: string; message: string } | null>(null);

  // Guardrail threshold state
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(0.8);
  const [savedThreshold, setSavedThreshold] = useState(0.8);
  const [thresholdDirty, setThresholdDirty] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const fetchHealth = (isManual = false) => {
    if (isManual) setRefreshing(true);
    healthApi
      .check()
      .then((data) => {
        setHealth(data as HealthResponse);
        setHealthError(false);
      })
      .catch(() => setHealthError(true))
      .finally(() => {
        if (isManual) setRefreshing(false);
        setInitialLoading(false);
      });
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
      setEmailNotifyOn((data.emailNotifyOn as string) || "human_approval");
    }).catch(() => {});
  }, []);

  const fetchThreshold = useCallback(() => {
    agentsApi.getGuardrailThresholds().then((data) => {
      setAutoApproveThreshold(data.autoApproveThreshold);
      setSavedThreshold(data.autoApproveThreshold);
      setThresholdDirty(false);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      // Slight delay to give backend time to start
      const timer = setTimeout(() => fetchHealth(false), 1000);
      return () => clearTimeout(timer);
    }
    fetchNotifConfig();
    fetchThreshold();
    const unsub = wsService.onConnectionChange((connected) => {
      setWsConnected(connected);
    });
    return unsub;
  }, [fetchNotifConfig, fetchThreshold]);

  const saveNotifConfig = async () => {
    setNotifSaving(true);
    setNotifSaved(false);
    try {
      const payload: Record<string, unknown> = {
        teams_webhook_url: teamsWebhookUrl,
        teams_notify_on: teamsNotifyOn,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_from: smtpFrom,
        smtp_to: smtpTo,
        email_notify_on: emailNotifyOn,
      };
      // Only send password if user changed it from the masked placeholder
      if (smtpPassword && smtpPassword !== "********") {
        payload.smtp_password = smtpPassword;
      }
      await notificationsApi.updateConfig(payload);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 3000);
    } catch {
      setTestResult({ channel: "config", status: "error", message: "Failed to save configuration" });
    } finally {
      setNotifSaving(false);
    }
  };

  const handleThresholdChange = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    setAutoApproveThreshold(rounded);
    setThresholdDirty(rounded !== savedThreshold);
    setThresholdSaved(false);
  };

  const handleThresholdSave = () => {
    setShowConfirmDialog(true);
  };

  const confirmThresholdSave = async () => {
    setShowConfirmDialog(false);
    setThresholdSaving(true);
    try {
      const res = await agentsApi.updateGuardrailThresholds(autoApproveThreshold);
      setSavedThreshold(res.autoApproveThreshold);
      setThresholdDirty(false);
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 3000);
    } catch {
      setTestResult({ channel: "threshold", status: "error", message: "Failed to update threshold" });
    } finally {
      setThresholdSaving(false);
    }
  };

  const cancelThresholdSave = () => {
    setShowConfirmDialog(false);
  };

  const resetThreshold = () => {
    setAutoApproveThreshold(savedThreshold);
    setThresholdDirty(false);
  };

  // Derive zone label from threshold
  const getZoneInfo = (value: number) => {
    if (value >= 0.9) return { label: "Strict", desc: "Almost all decisions require human review", color: "#ef4444" };
    if (value >= 0.8) return { label: "Default", desc: "Standard autonomous operation", color: "#3b82f6" };
    if (value >= 0.7) return { label: "Relaxed", desc: "AI handles more decisions autonomously", color: "#f59e0b" };
    return { label: "Permissive", desc: "Minimal human oversight required", color: "#10b981" };
  };

  const zoneInfo = getZoneInfo(autoApproveThreshold);

  const handleTestTeams = async () => {
    setTestingTeams(true);
    setTestResult(null);
    try {
      // Auto-save webhook URL before testing
      await notificationsApi.updateConfig({
        teams_webhook_url: teamsWebhookUrl,
        teams_notify_on: teamsNotifyOn,
      });
      const res = await notificationsApi.testTeams() as { status: string; message: string };
      setTestResult({ channel: "teams", ...res });
    } catch {
      setTestResult({ channel: "teams", status: "error", message: "Request failed — is the backend running?" });
    } finally {
      setTestingTeams(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestResult(null);
    try {
      // Auto-save current settings before testing so the backend uses latest values
      const payload: Record<string, unknown> = {
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_from: smtpFrom,
        smtp_to: smtpTo,
        email_notify_on: emailNotifyOn,
      };
      if (smtpPassword && smtpPassword !== "********") {
        payload.smtp_password = smtpPassword;
      }
      await notificationsApi.updateConfig(payload);
      const res = await notificationsApi.testEmail() as { status: string; message: string };
      setTestResult({ channel: "email", ...res });
    } catch {
      setTestResult({ channel: "email", status: "error", message: "Request failed — is the backend running?" });
    } finally {
      setTestingEmail(false);
    }
  };

  const getServiceStatus = (key: string): { status: string; detail: string } => {
    if (!health?.services) {
      if (healthError) return { status: "pending", detail: "Backend unreachable" };
      return { status: "checking", detail: "..." };
    }
    const svc = (health.services as Record<string, ServiceStatus>)[key];
    if (!svc) return { status: "pending", detail: "Not configured" };
    return { status: svc.status, detail: svc.detail || svc.model || "" };
  };

  const redisInfo = getServiceStatus("redis");
  const llmSvc = (health?.services as Record<string, Record<string, string>> | undefined)?.llm;
  const llmInfo = llmSvc
    ? { status: llmSvc.provider ? "connected" : "pending", detail: `${llmSvc.provider || "none"} - ${llmSvc.model || "unknown"}` }
    : { 
        status: healthError ? "pending" : "checking" as string, 
        detail: healthError ? "Backend unreachable" : "..." 
      };

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
      return { 
        icon: RefreshCw, 
        color: cn("text-[#94a3b8]", !initialLoading && "animate-spin"), 
        bg: "bg-[#f1f5f9]", 
        label: initialLoading ? "Connecting..." : "Checking..." 
      };
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
          onClick={() => fetchHealth(true)}
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

      {/* AI Auto-Approve Threshold */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#f59e0b]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              AI Decision Autonomy
            </span>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ backgroundColor: zoneInfo.color + "18", color: zoneInfo.color }}
          >
            {zoneInfo.label}
          </span>
        </div>
        <div className="space-y-5 p-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-[#475569]">Auto-Approve Confidence Threshold</label>
              <span
                className="rounded-md px-2 py-0.5 font-mono text-sm font-bold tabular-nums"
                style={{ backgroundColor: zoneInfo.color + "18", color: zoneInfo.color }}
              >
                {(autoApproveThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mb-3 text-[11px] text-[#94a3b8]">
              AI decisions with confidence above this threshold are auto-approved. Below it, they require human review.
            </p>

            {/* Custom animated slider */}
            <div className="relative" ref={sliderRef}>
              {/* Track background with gradient zones */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                {/* Animated gradient fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, #10b981 0%, #3b82f6 40%, #f59e0b 70%, #ef4444 100%)`,
                  }}
                  animate={{ width: `${((autoApproveThreshold - 0.5) / 0.5) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
                {/* Animated shimmer overlay */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                {/* Subtle particle dots */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute top-1/2 h-1.5 w-1.5 rounded-full bg-white/40"
                    style={{ left: `${15 + i * 14}%` }}
                    animate={{
                      y: [-1, 1, -1],
                      opacity: [0.2, 0.6, 0.2],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                  />
                ))}
              </div>

              {/* Thumb */}
              <motion.div
                className="pointer-events-none absolute top-1/2"
                style={{ left: `${((autoApproveThreshold - 0.5) / 0.5) * 100}%` }}
                animate={{
                  left: `${((autoApproveThreshold - 0.5) / 0.5) * 100}%`,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div
                  className="relative -ml-3 -mt-3 h-6 w-6 rounded-full border-[3px] border-white shadow-lg"
                  style={{ backgroundColor: zoneInfo.color }}
                >
                  {/* Pulsing ring */}
                  <motion.div
                    className="absolute -inset-1.5 rounded-full border-2"
                    style={{ borderColor: zoneInfo.color }}
                    animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              {/* Invisible native range for interaction */}
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={autoApproveThreshold * 100}
                onChange={(e) => handleThresholdChange(Number(e.target.value) / 100)}
                className="absolute inset-0 h-3 w-full cursor-pointer opacity-0"
              />
            </div>

            {/* Scale labels */}
            <div className="mt-2 flex justify-between text-[10px] font-medium text-[#94a3b8]">
              <span>50% (Permissive)</span>
              <span>75%</span>
              <span>100% (Strict)</span>
            </div>
          </div>

          {/* Zone description */}
          <motion.div
            key={zoneInfo.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
            style={{ borderColor: zoneInfo.color + "40", backgroundColor: zoneInfo.color + "08" }}
          >
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: zoneInfo.color }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: zoneInfo.color }}>{zoneInfo.label} Mode</p>
              <p className="text-[11px] text-[#64748b]">{zoneInfo.desc}</p>
            </div>
          </motion.div>

          {/* Save / Reset buttons */}
          {thresholdDirty && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <Button
                onClick={handleThresholdSave}
                disabled={thresholdSaving}
                className="h-8 bg-[#2563eb] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
              >
                <Save className={cn("mr-1.5 h-3 w-3", thresholdSaving && "animate-spin")} />
                Apply Threshold
              </Button>
              <Button
                onClick={resetThreshold}
                variant="outline"
                className="h-8 border-[#e2e8f0] px-3 text-xs font-medium text-[#64748b] hover:bg-[#f1f5f9]"
              >
                Reset
              </Button>
              <span className="text-[11px] text-[#94a3b8]">
                {savedThreshold !== autoApproveThreshold && `Changed from ${(savedThreshold * 100).toFixed(0)}% to ${(autoApproveThreshold * 100).toFixed(0)}%`}
              </span>
            </motion.div>
          )}
          {thresholdSaved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1 text-xs font-medium text-[#10b981]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Threshold updated successfully
            </motion.span>
          )}
          {testResult?.channel === "threshold" && (
            <span className="text-xs font-medium text-[#ef4444]">{testResult.message}</span>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={cancelThresholdSave}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fef3c7]">
                  <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1e293b]">Confirm Threshold Change</h3>
                  <p className="text-[11px] text-[#64748b]">This affects AI decision autonomy</p>
                </div>
              </div>

              <div className="mb-5 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#64748b]">Current:</span>
                  <span className="font-mono font-bold text-[#1e293b]">{(savedThreshold * 100).toFixed(0)}%</span>
                </div>
                <div className="my-1.5 flex items-center justify-center">
                  <motion.span
                    animate={{ y: [0, 2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-[#94a3b8]"
                  >
                    ↓
                  </motion.span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#64748b]">New:</span>
                  <span className="font-mono font-bold" style={{ color: zoneInfo.color }}>
                    {(autoApproveThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <p className="mb-5 text-xs text-[#64748b]">
                {autoApproveThreshold > savedThreshold
                  ? "Raising the threshold means more decisions will require human review before execution."
                  : "Lowering the threshold means the AI will auto-approve more decisions without human review."}
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={cancelThresholdSave}
                  variant="outline"
                  className="h-9 flex-1 border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:bg-[#f1f5f9]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmThresholdSave}
                  className="h-9 flex-1 bg-[#2563eb] text-xs font-semibold text-white hover:bg-[#1d4ed8]"
                >
                  Yes, Apply Change
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Email / SMTP Notifications */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#2563eb]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Email Notifications (SMTP)
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleTestEmail}
            disabled={testingEmail || !smtpHost || !smtpTo}
            title={!smtpHost ? "Set SMTP host first" : !smtpTo ? "Set recipient email first" : "Send a test email"}
            className="h-7 border border-[#e2e8f0] bg-white px-2.5 text-[11px] font-medium text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-40"
          >
            <Send className={cn("mr-1 h-3 w-3", testingEmail && "animate-spin")} />
            Send Test Email
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
                placeholder="smtp.gmail.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">SMTP Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">SMTP Username</label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="user@gmail.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">SMTP Password</label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="App password"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">From Address</label>
              <input
                type="email"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="alerts@yourcompany.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">To (comma-separated)</label>
              <input
                type="text"
                value={smtpTo}
                onChange={(e) => setSmtpTo(e.target.value)}
                placeholder="team@company.com, lead@company.com"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">Email mode</label>
            <select
              value={emailNotifyOn}
              onChange={(e) => setEmailNotifyOn(e.target.value)}
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
            >
              <option value="human_approval">Human approval required</option>
              <option value="critical">Critical alerts only</option>
              <option value="warning">Warning + Critical alerts</option>
              <option value="all">All alerts</option>
              <option value="none">Disabled</option>
            </select>
            <p className="mt-1 text-[10px] text-[#94a3b8]">
              {emailNotifyOn === "human_approval"
                ? "Emails sent only when an AI decision needs human approval"
                : emailNotifyOn === "none"
                  ? "Email notifications disabled"
                  : "Emails sent when anomaly alerts match the selected severity"}
            </p>
          </div>
          <p className="text-[10px] text-[#94a3b8]">
            Initial values are loaded from <code className="rounded bg-[#f1f5f9] px-1 py-0.5 font-mono text-[10px] text-[#64748b]">.env</code>. Changes here are runtime-only (not persisted to .env).
          </p>
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
