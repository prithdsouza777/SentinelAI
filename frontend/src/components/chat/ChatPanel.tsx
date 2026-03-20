import { useState } from "react";
import { Send, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../../stores/dashboardStore";
import { chatApi } from "../../services/api";
import type { ChatMessage } from "../../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export default function ChatPanel() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messages = useDashboardStore((s) => s.chatMessages);
  const addMessage = useDashboardStore((s) => s.addChatMessage);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      const response = (await chatApi.send(input)) as { message: string; reasoning?: string };
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Command Center</span>
        </div>
        <MessageSquare className="h-4 w-4 text-[#94a3b8]" />
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-[#94a3b8]">
              Ask about queue status, give commands, or create policies...
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-xl p-2.5 text-[12px] leading-relaxed",
                  msg.role === "user"
                    ? "ml-4 border border-[#2563eb]/15 bg-[#2563eb]/5 text-[#1e293b]"
                    : "mr-4 border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                )}
              >
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div className="mr-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5 text-[12px] text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 animate-pulse text-[#8b5cf6]" />
                Thinking...
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-[#e2e8f0] p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a command..."
            className="flex-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm text-[#1e293b] placeholder-[#94a3b8] focus:border-[#2563eb]/40 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-9 w-9 bg-[#2563eb] shadow-md shadow-[#2563eb]/20 hover:bg-[#1d4ed8]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
