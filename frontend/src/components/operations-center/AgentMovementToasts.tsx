import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, X } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";

interface Toast {
  id: string;
  summary: string;
  timestamp: number;
}

const TOAST_DURATION = 5000;
const MAX_TOASTS = 5;

export default function AgentMovementToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const decisions = useDashboardStore((s) => s.decisions);
  const seenIds = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Watch for new movement decisions
  useEffect(() => {
    for (const d of decisions) {
      if (seenIds.current.has(d.id)) continue;
      seenIds.current.add(d.id);

      // Only show toasts for acted movement decisions
      const isMove =
        d.phase === "acted" &&
        d.summary.toLowerCase().includes("move");

      if (!isMove) continue;

      const toast: Toast = {
        id: d.id,
        summary: d.summary,
        timestamp: Date.now(),
      };

      setToasts((prev) => [toast, ...prev].slice(0, MAX_TOASTS));

      // Auto-dismiss
      setTimeout(() => dismiss(toast.id), TOAST_DURATION);
    }
  }, [decisions, dismiss]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2">
      <AnimatePresence>
        {toasts.map((toast, i) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1 - i * 0.08, y: 0, scale: 1 - i * 0.02 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-[#2563eb]/20 bg-white px-4 py-3 shadow-lg shadow-[#2563eb]/5"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]/10">
              <ArrowRightLeft className="h-3.5 w-3.5 text-[#2563eb]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1e293b]">Agent Movement</p>
              <p className="mt-0.5 truncate text-[13px] text-[#475569]">{toast.summary}</p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="mt-0.5 shrink-0 rounded p-0.5 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#64748b]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {/* Auto-dismiss progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
              className="absolute bottom-0 left-0 h-0.5 w-full origin-left rounded-b-xl bg-[#2563eb]/30"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
