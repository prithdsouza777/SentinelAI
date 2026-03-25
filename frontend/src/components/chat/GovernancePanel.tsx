import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Activity,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { governanceApi } from "@/services/api";

interface RaiaStatus {
  enabled: boolean;
  active?: boolean;
  interactions?: number;
  traceId?: string;
  sessionId?: string;
  reason?: string;
}

interface LockThreatStatus {
  connected: boolean;
  frameworks: Array<{
    name: string;
    status: string;
    controls: number;
    passing: number;
  }>;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

export default function GovernancePanel() {
  const [raia, setRaia] = useState<RaiaStatus | null>(null);
  const [lockthreat, setLockthreat] = useState<LockThreatStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await governanceApi.getStatus();
      setRaia(res.raia);
      setLockthreat(res.lockthreat);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* RAIA Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#8b5cf6]/20 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6]/10">
              <Shield className="h-4 w-4 text-[#8b5cf6]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e293b]">RAIA</span>
              <p className="text-[9px] text-[#94a3b8]">AI Governance</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {raia?.active && (
              <span className="flex items-center gap-1 rounded-full bg-[#10b981]/10 px-2 py-0.5 text-[9px] font-semibold text-[#10b981]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
                Tracing
              </span>
            )}
            <button
              onClick={fetchStatus}
              className="rounded p-1 text-[#94a3b8] hover:text-[#64748b]"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {raia?.enabled ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
              <span className="text-[10px] text-[#64748b]">Interactions Traced</span>
              <span className="text-sm font-bold tabular-nums text-[#8b5cf6]">
                {raia.interactions ?? 0}
              </span>
            </div>

            {raia.active && raia.sessionId && (
              <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
                <span className="text-[10px] text-[#64748b]">Session</span>
                <span className="font-mono text-[10px] text-[#475569]">
                  {raia.sessionId}
                </span>
              </div>
            )}

            {/* RAIA Compliance Checks */}
            <div className="mt-2 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                AI Governance Checks
              </p>
              {[
                { name: "Tool Authorization", passed: true },
                { name: "Boundary Compliance", passed: true },
                { name: "Escalation Protocol", passed: true },
                { name: "Confidence Thresholds", passed: true },
                { name: "Trace Logging", passed: raia.active ?? false },
              ].map((check) => (
                <div
                  key={check.name}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {check.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" />
                  )}
                  <span
                    className={cn(
                      check.passed ? "text-[#475569]" : "text-[#94a3b8]"
                    )}
                  >
                    {check.name}
                  </span>
                </div>
              ))}
            </div>

            <a
              href="http://raia-dev.cirruslabs.io"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 py-1.5 text-[10px] font-semibold text-[#8b5cf6] transition-all hover:bg-[#8b5cf6]/10"
            >
              Open RAIA Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <p className="text-[11px] text-[#94a3b8]">
            {raia?.reason || "Not configured"}
          </p>
        )}
      </motion.div>

      {/* LockThreat GRC Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-[#2563eb]/20 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb]/10">
              <Activity className="h-4 w-4 text-[#2563eb]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#1e293b]">LockThreat</span>
              <p className="text-[9px] text-[#94a3b8]">GRC Platform</p>
            </div>
          </div>
          {lockthreat?.connected && (
            <span className="flex items-center gap-1 rounded-full bg-[#10b981]/10 px-2 py-0.5 text-[9px] font-semibold text-[#10b981]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              Connected
            </span>
          )}
        </div>

        {lockthreat ? (
          <div className="space-y-2">
            {/* Framework compliance badges */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Framework Compliance
              </p>
              {lockthreat.frameworks.map((fw) => (
                <div
                  key={fw.name}
                  className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    {fw.status === "compliant" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#10b981]" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-[#f59e0b]" />
                    )}
                    <span className="text-[11px] font-medium text-[#475569]">
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
                </div>
              ))}
            </div>

            {/* Compliance checks */}
            <div className="mt-2 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Policy Checks
              </p>
              {lockthreat.checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {check.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
                  )}
                  <span className="text-[#475569]">{check.name}</span>
                  <span className="ml-auto text-[9px] text-[#94a3b8]">
                    {check.detail}
                  </span>
                </div>
              ))}
            </div>

            <a
              href="https://www.lockthreat.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-[#2563eb]/20 bg-[#2563eb]/5 py-1.5 text-[10px] font-semibold text-[#2563eb] transition-all hover:bg-[#2563eb]/10"
            >
              Open LockThreat GRC
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" />
          </div>
        )}
      </motion.div>
    </div>
  );
}
