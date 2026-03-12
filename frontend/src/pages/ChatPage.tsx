import { useState } from "react";
import { Send, BrainCircuit, Sparkles, BookOpen } from "lucide-react";
import { clsx } from "clsx";
import { useDashboardStore } from "../stores/dashboardStore";
import { chatApi } from "../services/api";
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
      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Conversational Command Center</h2>
          <p className="text-sm text-gray-500">
            Query status, issue commands, or create policy rules using natural language
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-auto rounded-xl border border-gray-800 bg-surface-raised p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/15">
                <BrainCircuit className="h-6 w-6 text-brand-400" />
              </div>
              <div>
                <p className="font-medium text-gray-300">
                  SentinelAI Command Center
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Ask questions, give commands, or create persistent policy rules
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => handleSend(qa.message)}
                    className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-brand-500 hover:text-brand-400"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx(
                  "max-w-[80%] animate-fade-in rounded-xl px-4 py-3",
                  msg.role === "user"
                    ? "ml-auto bg-brand-600/20 text-gray-200"
                    : "bg-surface text-gray-300"
                )}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.reasoning && (
                  <div className="mt-2 flex items-start gap-1.5 border-t border-gray-700/50 pt-2">
                    <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-purple-400" />
                    <p className="text-xs text-gray-500">{msg.reasoning}</p>
                  </div>
                )}
                <p className="mt-1 text-right text-xs text-gray-600">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
          {loading && (
            <div className="max-w-[80%] animate-fade-in rounded-xl bg-surface px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about queues, give commands, or create policy rules..."
            className="flex-1 rounded-xl border border-gray-700 bg-surface-raised px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Policies sidebar */}
      <div className="hidden w-72 flex-col gap-4 overflow-auto lg:flex">
        <div className="card flex-1">
          <div className="card-header">
            <span className="card-title">Active Policies</span>
            <BookOpen className="h-4 w-4 text-gray-500" />
          </div>
          <p className="text-xs text-gray-500">
            Create policies via chat, e.g. "If support queue exceeds 20 contacts,
            pull from sales first."
          </p>
          <div className="mt-3 space-y-2">
            {/* Placeholder — will be populated when NL policy engine is wired */}
            <div className="rounded-lg bg-surface px-3 py-2 text-xs text-gray-500 italic">
              No policies created yet
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Example Commands</span>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <p>"Move 2 agents from sales to support"</p>
            <p>"What was our busiest hour today?"</p>
            <p>"Set a rule: if billing &gt; 15, pull from general"</p>
            <p>"What would happen if 3 agents go offline?"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
