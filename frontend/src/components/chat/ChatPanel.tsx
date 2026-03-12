import { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { chatApi } from "../../services/api";
import type { ChatMessage } from "../../types";

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
    <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="card-header">
        <span className="card-title">Command Center</span>
        <MessageSquare className="h-4 w-4 text-gray-500" />
      </div>

      <div className="flex-1 space-y-2 overflow-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500">
            Ask about queue status, give commands, or create policies...
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-2 text-sm ${
                msg.role === "user"
                  ? "ml-4 bg-brand-600/15 text-gray-200"
                  : "mr-4 bg-surface text-gray-300"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
        {loading && (
          <div className="mr-4 rounded-lg bg-surface p-2 text-sm text-gray-500">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a command..."
          className="flex-1 rounded-lg border border-gray-700 bg-surface px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
