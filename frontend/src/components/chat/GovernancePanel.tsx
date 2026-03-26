import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  BrainCircuit,
  Lock,
  X,
  Shield,
  Eye,
  Scale,
  FileSearch,
  Fingerprint,
  AlertTriangle,
  BarChart3,
  Network,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { governanceApi } from "@/services/api";
import { useDashboardStore } from "@/stores/dashboardStore";

type ConnectState = "idle" | "connecting" | "connected" | "failed";

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface FrameworkResult {
  name: string;
  status: string;
  controls: number;
  passing: number;
}

type ModalTarget = "raia" | "lockthreat" | null;

const raiaFeatures = [
  { icon: Eye, label: "AI Explainability & Transparency" },
  { icon: Scale, label: "Fairness & Bias Detection" },
  { icon: FileSearch, label: "Full Decision Traceability" },
  { icon: Shield, label: "Guardrail Compliance Monitoring" },
];

const ltFeatures = [
  { icon: Shield, label: "SOC 2 & ISO 27001 Compliance" },
  { icon: BarChart3, label: "NIST AI Risk Management" },
  { icon: Fingerprint, label: "Audit Trail & Access Control" },
  { icon: AlertTriangle, label: "Real-time Policy Enforcement" },
];

export default function GovernancePanel() {
  const simulationActive = useDashboardStore((s) => s.simulationActive);
  const [raiaState, setRaiaState] = useState<ConnectState>("idle");
  const [raiaChecks, setRaiaChecks] = useState<CheckResult[]>([]);
  const [raiaTraceCount, setRaiaTraceCount] = useState(0);

  const [ltState, setLtState] = useState<ConnectState>("idle");
  const [ltChecks, setLtChecks] = useState<CheckResult[]>([]);
  const [ltFrameworks, setLtFrameworks] = useState<FrameworkResult[]>([]);

  const [raiaExpanded, setRaiaExpanded] = useState(true);
  const [ltExpanded, setLtExpanded] = useState(true);

  const [modal, setModal] = useState<ModalTarget>(null);
  const [connectProgress, setConnectProgress] = useState(0);

  // Reset connect state when simulation stops
  useEffect(() => {
    if (!simulationActive) {
      setRaiaState("idle");
      setRaiaChecks([]);
      setRaiaTraceCount(0);
      setLtState("idle");
      setLtChecks([]);
      setLtFrameworks([]);
    }
  }, [simulationActive]);

  // Poll RAIA status after connecting to update Decision Traceability
  useEffect(() => {
    if (raiaState !== "connected" && raiaState !== "failed") return;
    if (!simulationActive) return;

    const poll = async () => {
      try {
        const res = await governanceApi.getStatus();
        const interactions = res.raia.interactions ?? 0;
        setRaiaTraceCount(interactions);

        // Rebuild checks with updated interaction count
        setRaiaChecks((prev) =>
          prev.map((c) =>
            c.name === "Decision Traceability"
              ? {
                  ...c,
                  passed: interactions > 0,
                  detail: interactions > 0
                    ? `${interactions} interactions traced`
                    : "Awaiting simulation — start demo to trace decisions",
                }
              : c
          )
        );

        // Update overall state: if all checks pass now, switch to connected
        setRaiaChecks((latest) => {
          const allPassed = latest.every((c) => c.passed);
          if (allPassed && raiaState === "failed") {
            setRaiaState("connected");
          }
          return latest;
        });
      } catch { /* ignore */ }
    };

    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [raiaState, simulationActive]);

  useEffect(() => {
    if (connectProgress > 0 && connectProgress < 100) {
      const timer = setTimeout(() => {
        setConnectProgress((p) => Math.min(p + Math.random() * 25 + 10, 95));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [connectProgress]);

  const connectRaia = useCallback(async () => {
    setModal(null);
    setRaiaState("connecting");
    setConnectProgress(10);
    try {
      const res = await governanceApi.connectRaia();
      setConnectProgress(100);
      await new Promise((r) => setTimeout(r, 500));

      setRaiaChecks(res.checks);
      setRaiaTraceCount(res.interactions ?? 0);

      if (res.connected) {
        const allPassed = res.checks.every((c) => c.passed);
        setRaiaState(allPassed ? "connected" : "failed");
      } else {
        setRaiaState("failed");
        if (res.reason) {
          setRaiaChecks([{ name: "Connection", passed: false, detail: res.reason }]);
        }
      }
      setConnectProgress(0);
    } catch {
      setConnectProgress(0);
      setRaiaState("failed");
      setRaiaChecks([
        { name: "Connection", passed: false, detail: "Failed to reach RAIA backend" },
      ]);
    }
  }, []);

  const connectLockThreat = useCallback(async () => {
    setModal(null);
    setLtState("connecting");
    setConnectProgress(10);
    try {
      const res = await governanceApi.connectLockThreat();
      setConnectProgress(100);
      await new Promise((r) => setTimeout(r, 500));

      setLtChecks(res.checks);
      setLtFrameworks(res.frameworks);
      if (res.connected) {
        const allPassed = res.checks.every((c) => c.passed);
        setLtState(allPassed ? "connected" : "failed");
      } else {
        setLtState("failed");
      }
      setConnectProgress(0);
    } catch {
      setConnectProgress(0);
      setLtState("failed");
      setLtChecks([
        { name: "Connection", passed: false, detail: "Failed to reach LockThreat" },
      ]);
    }
  }, []);

  const passedCount = (checks: CheckResult[]) =>
    checks.filter((c) => c.passed).length;

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* RAIA Card */}
        <div
          className={cn(
            "group rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-300",
            raiaState === "connected"
              ? "border-[#10b981]/30 shadow-[#10b981]/5"
              : "border-[#8b5cf6]/15 hover:border-[#8b5cf6]/30 hover:shadow-md"
          )}
        >
          <button
            onClick={() => {
              if (raiaState === "idle") setModal("raia");
              else if (raiaState === "connected" || raiaState === "failed") setRaiaExpanded(!raiaExpanded);
            }}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 transition-all",
              raiaState === "idle" && "cursor-pointer",
              (raiaState === "connected" || raiaState === "failed") && "cursor-pointer",
              raiaState === "connecting" && "bg-gradient-to-r from-[#8b5cf6]/5 to-transparent"
            )}
          >
            <div
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                raiaState === "connected"
                  ? "bg-[#10b981]/10"
                  : "bg-[#8b5cf6]/10 group-hover:bg-[#8b5cf6]/15"
              )}
            >
              {raiaState === "connecting" ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#8b5cf6]" />
              ) : raiaState === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
              ) : (
                <BrainCircuit className="h-5 w-5 text-[#8b5cf6]" />
              )}
              {raiaState === "connected" && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10b981]" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="text-[13px] font-semibold text-[#1e293b]">RAIA</div>
              <div className="text-[10px] text-[#94a3b8]">
                Responsible & Explainable AI
              </div>
            </div>
            {raiaState === "idle" && (
              <span className="rounded-full border border-[#8b5cf6]/25 bg-[#8b5cf6]/5 px-3.5 py-1 text-[10px] font-semibold text-[#8b5cf6] group-hover:bg-[#8b5cf6]/10 transition-colors">
                Connect
              </span>
            )}
            {raiaState === "connecting" && (
              <span className="text-[10px] font-medium text-[#8b5cf6] animate-pulse">
                Connecting...
              </span>
            )}
            {raiaState === "connected" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#10b981]">
                  {passedCount(raiaChecks)}/{raiaChecks.length}
                </span>
                <span className="rounded-full bg-[#10b981]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#10b981]">
                  Connected
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#94a3b8] transition-transform duration-200", raiaExpanded && "rotate-180")} />
              </div>
            )}
            {raiaState === "failed" && (
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-[#f59e0b]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                  Issues Found
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#94a3b8] transition-transform duration-200", raiaExpanded && "rotate-180")} />
              </div>
            )}
            {(raiaState === "connected" || raiaState === "failed") && (
              <ChevronDown className={cn("h-4 w-4 text-[#94a3b8] transition-transform", raiaExpanded && "rotate-180")} />
            )}
          </button>

          {/* Progress bar while connecting */}
          {raiaState === "connecting" && (
            <div className="px-4 pb-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#8b5cf6]/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${connectProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <AnimatePresence>
            {(raiaState === "connected" || raiaState === "failed") && raiaExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#e2e8f0]/80 px-4 py-3 space-y-1.5">
                  {raiaTraceCount > 0 && (
                    <div className="mb-2 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#8b5cf6]/5 to-[#f8fafc] px-3 py-2">
                      <span className="text-[10px] font-medium text-[#64748b]">
                        Decisions Traced
                      </span>
                      <span className="text-sm font-bold tabular-nums text-[#8b5cf6]">
                        {raiaTraceCount}
                      </span>
                    </div>
                  )}
                  {raiaChecks.map((check, i) => (
                    <motion.div
                      key={check.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      {check.passed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
                      )}
                      <span className="text-[#475569]">{check.name}</span>
                      <span className="ml-auto text-[9px] text-[#94a3b8] max-w-[120px] truncate text-right">
                        {check.detail}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* LockThreat Card */}
        <div
          className={cn(
            "group rounded-2xl border bg-white shadow-sm overflow-hidden transition-all duration-300",
            ltState === "connected"
              ? "border-[#10b981]/30 shadow-[#10b981]/5"
              : "border-[#2563eb]/15 hover:border-[#2563eb]/30 hover:shadow-md"
          )}
        >
          <button
            onClick={() => {
              if (ltState === "idle") setModal("lockthreat");
              else if (ltState === "connected" || ltState === "failed") setLtExpanded(!ltExpanded);
            }}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 transition-all",
              ltState === "idle" && "cursor-pointer",
              (ltState === "connected" || ltState === "failed") && "cursor-pointer",
              ltState === "connecting" && "bg-gradient-to-r from-[#2563eb]/5 to-transparent"
            )}
          >
            <div
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                ltState === "connected"
                  ? "bg-[#10b981]/10"
                  : "bg-[#2563eb]/10 group-hover:bg-[#2563eb]/15"
              )}
            >
              {ltState === "connecting" ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#2563eb]" />
              ) : ltState === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
              ) : (
                <Lock className="h-5 w-5 text-[#2563eb]" />
              )}
              {ltState === "connected" && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10b981]" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="text-[13px] font-semibold text-[#1e293b]">LockThreat</div>
              <div className="text-[10px] text-[#94a3b8]">
                Governance, Risk & Compliance
              </div>
            </div>
            {ltState === "idle" && (
              <span className="rounded-full border border-[#2563eb]/25 bg-[#2563eb]/5 px-3.5 py-1 text-[10px] font-semibold text-[#2563eb] group-hover:bg-[#2563eb]/10 transition-colors">
                Connect
              </span>
            )}
            {ltState === "connecting" && (
              <span className="text-[10px] font-medium text-[#2563eb] animate-pulse">
                Connecting...
              </span>
            )}
            {ltState === "connected" && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#10b981]">
                  {passedCount(ltChecks)}/{ltChecks.length}
                </span>
                <span className="rounded-full bg-[#10b981]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#10b981]">
                  Connected
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#94a3b8] transition-transform duration-200", ltExpanded && "rotate-180")} />
              </div>
            )}
            {ltState === "failed" && (
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-[#f59e0b]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                  Issues Found
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-[#94a3b8] transition-transform duration-200", ltExpanded && "rotate-180")} />
              </div>
            )}
            {(ltState === "connected" || ltState === "failed") && (
              <ChevronDown className={cn("h-4 w-4 text-[#94a3b8] transition-transform", ltExpanded && "rotate-180")} />
            )}
          </button>

          {/* Progress bar while connecting */}
          {ltState === "connecting" && (
            <div className="px-4 pb-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#2563eb]/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${connectProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <AnimatePresence>
            {(ltState === "connected" || ltState === "failed") && ltExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-[#e2e8f0]/80 px-4 py-3 space-y-2">
                  {ltFrameworks.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                        Frameworks
                      </p>
                      {ltFrameworks.map((fw, i) => (
                        <motion.div
                          key={fw.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between rounded-lg bg-gradient-to-r from-[#f8fafc] to-transparent px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            {fw.status === "compliant" ? (
                              <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
                            ) : (
                              <XCircle className="h-3 w-3 text-[#f59e0b]" />
                            )}
                            <span className="text-[10px] font-medium text-[#475569]">
                              {fw.name}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-bold tabular-nums",
                              fw.status === "compliant"
                                ? "text-[#10b981]"
                                : "text-[#f59e0b]"
                            )}
                          >
                            {fw.passing}/{fw.controls}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                      Policy Checks
                    </p>
                    {ltChecks.map((check, i) => (
                      <motion.div
                        key={check.name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (ltFrameworks.length + i) * 0.05 }}
                        className="flex items-center gap-2 text-[11px]"
                      >
                        {check.passed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
                        )}
                        <span className="text-[#475569]">{check.name}</span>
                        <span className="ml-auto text-[9px] text-[#94a3b8] max-w-[120px] truncate text-right">
                          {check.detail}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 24 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-[420px] mx-4 overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient header */}
              <div
                className={cn(
                  "relative px-6 pt-8 pb-6",
                  modal === "raia"
                    ? "bg-gradient-to-br from-[#8b5cf6]/8 via-[#8b5cf6]/4 to-transparent"
                    : "bg-gradient-to-br from-[#2563eb]/8 via-[#2563eb]/4 to-transparent"
                )}
              >
                {/* Close */}
                <button
                  onClick={() => setModal(null)}
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-[#94a3b8] hover:bg-black/5 hover:text-[#475569] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Icon with ring */}
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-2xl",
                        modal === "raia" ? "bg-[#8b5cf6]/10" : "bg-[#2563eb]/10"
                      )}
                    >
                      {modal === "raia" ? (
                        <BrainCircuit className="h-8 w-8 text-[#8b5cf6]" />
                      ) : (
                        <Lock className="h-8 w-8 text-[#2563eb]" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white",
                        modal === "raia" ? "bg-[#8b5cf6]" : "bg-[#2563eb]"
                      )}
                    >
                      <Network className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-center text-lg font-bold text-[#1e293b]">
                  Connect to {modal === "raia" ? "RAIA" : "LockThreat"}
                </h3>
                <p className="mt-1.5 text-center text-[13px] text-[#64748b] leading-relaxed">
                  {modal === "raia"
                    ? "Integrate SentinelAI with RAIA to enable responsible AI traceability, explainability, guardrails, and compliance insights."
                    : "Integrate SentinelAI with LockThreat for governance, risk management, and real-time compliance monitoring."}
                </p>
              </div>

              {/* Features list */}
              <div className="px-6 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-3">
                  What you'll get
                </p>
                <div className="space-y-2.5">
                  {(modal === "raia" ? raiaFeatures : ltFeatures).map(
                    (feat, i) => (
                      <motion.div
                        key={feat.label}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            modal === "raia"
                              ? "bg-[#8b5cf6]/8"
                              : "bg-[#2563eb]/8"
                          )}
                        >
                          <feat.icon
                            className={cn(
                              "h-4 w-4",
                              modal === "raia"
                                ? "text-[#8b5cf6]"
                                : "text-[#2563eb]"
                            )}
                          />
                        </div>
                        <span className="text-[13px] text-[#475569]">
                          {feat.label}
                        </span>
                      </motion.div>
                    )
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 border-t border-[#f1f5f9] px-6 py-4">
                <button
                  onClick={
                    modal === "raia" ? connectRaia : connectLockThreat
                  }
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all",
                    modal === "raia"
                      ? "bg-[#8b5cf6] hover:bg-[#7c3aed] shadow-lg shadow-[#8b5cf6]/25"
                      : "bg-[#2563eb] hover:bg-[#1d4ed8] shadow-lg shadow-[#2563eb]/25"
                  )}
                >
                  Connect {modal === "raia" ? "RAIA" : "LockThreat"}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-2.5 text-[13px] font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                >
                  Not now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
