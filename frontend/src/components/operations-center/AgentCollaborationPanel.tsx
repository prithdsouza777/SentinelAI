import { GitMerge } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

const agentColors: Record<string, string> = {
  queue_balancer: "text-blue-400",
  predictive_prevention: "text-purple-400",
  escalation_handler: "text-red-400",
  analytics: "text-emerald-400",
};

const agentBgs: Record<string, string> = {
  queue_balancer: "bg-blue-500/10",
  predictive_prevention: "bg-purple-500/10",
  escalation_handler: "bg-red-500/10",
  analytics: "bg-emerald-500/10",
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
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Collaboration</span>
        </div>
        {negotiations.length > 0 && (
          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
            {negotiations.length}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {negotiations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <GitMerge className="h-8 w-8 text-white/10" />
                <p className="text-sm text-muted-foreground">No negotiations yet</p>
                <p className="text-xs text-muted-foreground/60">Conflicts between agents will appear here</p>
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
                      "rounded-xl border bg-card/80 p-3 transition-all",
                      isHighlighted
                        ? "animate-conflict-pulse border-orange-500/40"
                        : "border-white/[0.06]",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-foreground">
                        {neg.topic}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(neg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {neg.proposals.map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px]">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-semibold",
                              agentColors[p.agentType] ?? "text-gray-400",
                              agentBgs[p.agentType] ?? "bg-white/5",
                            )}
                          >
                            {p.agentType.replace(/_/g, " ")}
                          </span>
                          <span className="flex-1 text-muted-foreground">{p.proposal}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {Math.round(p.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] font-medium text-emerald-400">
                      Resolution: {neg.resolution}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
