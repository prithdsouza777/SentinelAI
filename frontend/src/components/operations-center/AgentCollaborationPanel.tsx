import { GitMerge } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { motion, AnimatePresence } from "framer-motion";

const agentColors: Record<string, string> = {
  queue_balancer: "text-[#2563eb]",
  predictive_prevention: "text-[#8b5cf6]",
  escalation_handler: "text-[#ef4444]",
  analytics: "text-[#10b981]",
};

const agentBgs: Record<string, string> = {
  queue_balancer: "bg-[#2563eb]/10",
  predictive_prevention: "bg-[#8b5cf6]/10",
  escalation_handler: "bg-[#ef4444]/10",
  analytics: "bg-[#10b981]/10",
};

export default function AgentCollaborationPanel() {
  const negotiations = useDashboardStore((s) => s.negotiations);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(negotiations.length);

  useEffect(() => {
    if (negotiations.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevCountRef.current = negotiations.length;
  }, [negotiations.length]);

  const newestId = negotiations[0]?.id;
  const isRecent =
    negotiations[0] &&
    Date.now() - new Date(negotiations[0].timestamp).getTime() < 8000;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <GitMerge className="h-5 w-5 text-[#f97316]" />
          <span className="text-sm font-bold uppercase tracking-wider text-[#475569]">Agent Collaboration</span>
        </div>
        {negotiations.length > 0 && (
          <span className="rounded-full border border-[#f97316]/20 bg-[#f97316]/10 px-3 py-1 text-[11px] font-semibold text-[#f97316]">
            {negotiations.length}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {negotiations.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                <GitMerge className="h-10 w-10 text-[#e2e8f0]" />
                <p className="text-base font-medium text-[#64748b]">No negotiations yet</p>
                <p className="text-sm text-[#94a3b8]">Conflicts between agents will appear here</p>
              </div>
            ) : (
              negotiations.map((neg) => {
                const isHighlighted = neg.id === newestId && isRecent;
                return (
                  <motion.div
                    key={neg.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-xl border bg-white p-4 transition-all",
                      isHighlighted
                        ? "animate-conflict-pulse border-[#f97316]/40 shadow-md"
                        : "border-[#e2e8f0]",
                    )}
                  >
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1e293b]">
                        {neg.topic}
                      </span>
                      <span className="text-[11px] tabular-nums text-[#94a3b8]">
                        {new Date(neg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {neg.proposals.map((p, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-[13px]">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-xs font-semibold",
                              agentColors[p.agentType] ?? "text-[#64748b]",
                              agentBgs[p.agentType] ?? "bg-[#f1f5f9]",
                            )}
                          >
                            {p.agentType.replace(/_/g, " ")}
                          </span>
                          <span className="flex-1 text-[#475569]">{p.proposal}</span>
                          <span className="tabular-nums font-medium text-[#94a3b8]">
                            {Math.round(p.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-[#e2e8f0] pt-2.5 text-[13px] font-bold text-[#10b981]">
                      Resolution: {neg.resolution}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
