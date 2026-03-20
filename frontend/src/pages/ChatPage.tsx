import { useState, useRef, useEffect } from "react";
import { Send, BrainCircuit, Sparkles, BookOpen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../stores/dashboardStore";
import { chatApi } from "../services/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "../types";

const quickActions = [
  { label: "Queue status", message: "What's the status of all queues?" },
  { label: "Busiest queue", message: "Which queue has the most contacts right now?" },
  { label: "SLA check", message: "Which queues are breaching SLA targets?" },
  { label: "Agent availability", message: "How many agents are available across all queues?" },
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messages = useDashboardStore((s) => s.chatMessages);
  const addMessage = useDashboardStore((s) => s.addChatMessage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const messageText = text ?? input;
    if (!messageText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    if (!text) setInput("");
    setLoading(true);

    try {
      const response = (await chatApi.send(messageText)) as {
        message: string;
        reasoning?: string;
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
        reasoning: response.reasoning,
        timestamp: new Date().toISOString(),
      };
      addMessage(assistantMsg);
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#1e293b]">Conversational Command Center</h2>
          <p className="text-sm text-[#64748b]">
            Query status, issue commands, or create policy rules using natural language
          </p>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-5 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb]/10"
                >
                  <BrainCircuit className="h-7 w-7 text-[#2563eb]" />
                </motion.div>
                <div>
                  <p className="font-semibold text-[#1e293b]">SentinelAI Command Center</p>
                  <p className="mt-1 text-sm text-[#64748b]">
                    Ask questions, give commands, or create persistent policy rules
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickActions.map((qa) => (
                    <button
                      key={qa.label}
                      onClick={() => handleSend(qa.message)}
                      className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#475569] transition-all hover:border-[#2563eb]/30 hover:bg-[#2563eb]/5 hover:text-[#2563eb]"
                    >
                      <Zap className="mr-1 inline h-3 w-3" />
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "max-w-[80%] rounded-xl px-4 py-3",
                        msg.role === "user"
                          ? "ml-auto border border-[#2563eb]/20 bg-[#2563eb]/5 text-[#1e293b]"
                          : "mr-auto border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                      )}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      {msg.reasoning && (
                        <div className="mt-2 flex items-start gap-1.5 border-t border-[#e2e8f0] pt-2">
                          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#8b5cf6]" />
                          <p className="text-[12px] text-[#64748b]">{msg.reasoning}</p>
                        </div>
                      )}
                      <p className="mt-1 text-right text-[10px] tabular-nums text-[#94a3b8]">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mr-auto max-w-[80%] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-[#64748b]">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-[#8b5cf6]" />
                      Thinking...
                    </span>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-[#e2e8f0] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about queues, give commands, or create policy rules..."
                className="flex-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:border-[#2563eb]/40 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="h-10 w-10 bg-[#2563eb] shadow-md shadow-[#2563eb]/20 hover:bg-[#1d4ed8]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Policies sidebar */}
      <div className="hidden w-72 flex-col gap-4 overflow-auto lg:flex">
        <div className="flex-1 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#2563eb]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
                Active Policies
              </span>
            </div>
          </div>
          <p className="text-[12px] text-[#64748b]">
            Create policies via chat, e.g. &quot;If support queue exceeds 20 contacts,
            pull from sales first.&quot;
          </p>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-[12px] italic text-[#94a3b8]">
              No policies created yet
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
              Example Commands
            </span>
          </div>
          <div className="space-y-2 text-[12px] text-[#475569]">
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
              &quot;Move 2 agents from sales to support&quot;
            </p>
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
              &quot;What was our busiest hour today?&quot;
            </p>
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
              &quot;Set a rule: if billing &gt; 15, pull from general&quot;
            </p>
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
              &quot;What would happen if 3 agents go offline?&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
