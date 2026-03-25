import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  RotateCcw,
  Scale,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentChatApi } from "@/services/api";

interface AgentChatDrawerProps {
  agentId: string;
  agentName: string;
  agentType: "ai" | "human";
  color: string;
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "greeting";
  content: string;
}

const AI_AGENT_ICONS: Record<string, typeof Scale> = {
  queue_balancer: Scale,
  predictive_prevention: TrendingUp,
  escalation_handler: ShieldAlert,
};

export default function AgentChatDrawer({
  agentId,
  agentName,
  agentType,
  color,
  onClose,
}: AgentChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greetingLoaded, setGreetingLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Fetch greeting on mount
  useEffect(() => {
    if (greetingLoaded) return;
    setGreetingLoaded(true);

    agentChatApi.greeting(agentId).then((res) => {
      setMessages([
        {
          id: "greeting",
          role: "greeting",
          content: res.greeting,
        },
      ]);
    }).catch(() => {
      setMessages([
        {
          id: "greeting",
          role: "greeting",
          content: `Hi, I'm ${agentName}. How can I help you?`,
        },
      ]);
    });
  }, [agentId, agentName, greetingLoaded]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await agentChatApi.send(agentId, text);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.message,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I'm having trouble responding right now. Try again?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, agentId]);

  const handleReset = async () => {
    await agentChatApi.reset(agentId).catch(() => {});
    setGreetingLoaded(false);
    setMessages([]);
  };

  const AgentIcon = AI_AGENT_ICONS[agentId] || User;

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-[#e2e8f0] bg-white shadow-2xl"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${color}08, ${color}15)` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}20`, border: `2px solid ${color}` }}
          >
            {agentType === "ai" ? (
              <AgentIcon className="h-5 w-5" style={{ color }} />
            ) : (
              <span className="text-sm font-bold" style={{ color }}>
                {agentName[0]}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1e293b]">{agentName}</h3>
            <span
              className="text-[10px] font-semibold uppercase"
              style={{ color }}
            >
              {agentType === "ai" ? "AI Agent" : "Human Agent"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#64748b]"
            title="Reset conversation"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-[#f1f5f9] hover:text-[#64748b]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto bg-[#2563eb] text-white"
                    : msg.role === "greeting"
                    ? "mr-auto border-2 bg-white text-[#475569]"
                    : "mr-auto border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                )}
                style={
                  msg.role === "greeting"
                    ? { borderColor: `${color}30` }
                    : undefined
                }
              >
                {msg.role === "greeting" && (
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" style={{ color }} />
                    <span
                      className="text-[10px] font-bold uppercase"
                      style={{ color }}
                    >
                      {agentName}
                    </span>
                  </div>
                )}
                {msg.content}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mr-auto max-w-[85%] rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm text-[#94a3b8]">
                <Sparkles
                  className="h-3.5 w-3.5 animate-pulse"
                  style={{ color }}
                />
                Thinking...
              </span>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#e2e8f0] px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`Ask ${agentName} something...`}
            className="flex-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:border-[#2563eb]/40 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-all disabled:opacity-40"
            style={{ backgroundColor: color }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
