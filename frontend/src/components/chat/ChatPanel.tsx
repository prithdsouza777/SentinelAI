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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Command Center</span>
        </div>
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">
              Ask about queue status, give commands, or create policies...
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-xl p-2.5 text-[12px] leading-relaxed",
                  msg.role === "user"
                    ? "ml-4 border border-blue-500/15 bg-blue-500/10 text-foreground"
                    : "mr-4 border border-white/[0.06] bg-white/[0.03] text-foreground/90"
                )}
              >
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div className="mr-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 animate-pulse text-purple-400" />
                Thinking...
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a command..."
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:border-blue-500/30 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-9 w-9 bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-purple-500"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
