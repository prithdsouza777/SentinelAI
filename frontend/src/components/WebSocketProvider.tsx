/**
 * WebSocketProvider
 *
 * Subscribes to all backend WS events and dispatches them into the
 * Zustand dashboardStore. Mount once inside AppLayout so every page
 * receives live updates automatically.
 */

import { useEffect } from "react";
import { wsService } from "../services/websocket";
import { useDashboardStore } from "../stores/dashboardStore";
import type {
  AgentDecision,
  AgentNegotiation,
  Alert,
  GovernanceSnapshot,
  QueueMetrics,
} from "../types";

export default function WebSocketProvider() {
  const {
    updateQueue,
    addAlert,
    resolveAlert,
    addDecision,
    approveDecision,
    rejectDecision,
    addNegotiation,
    updateCost,
    addChatMessage,
    updateGovernance,
  } = useDashboardStore();

  useEffect(() => {
    const unsubs = [
      wsService.on("queue:update", (msg) => {
        const queue = msg.data as QueueMetrics;
        updateQueue(queue);
      }),

      wsService.on("alert:new", (msg) => {
        const alert = msg.data as Alert;
        addAlert(alert);
      }),

      wsService.on("alert:resolved", (msg) => {
        const { id } = msg.data as { id: string };
        resolveAlert(id);
      }),

      wsService.on("agent:reasoning", (msg) => {
        const decision = msg.data as AgentDecision;
        addDecision(decision);
      }),

      wsService.on("agent:negotiation", (msg) => {
        const negotiation = msg.data as AgentNegotiation;
        addNegotiation(negotiation);
      }),

      wsService.on("cost:update", (msg) => {
        updateCost(msg.data as Parameters<typeof updateCost>[0]);
      }),

      wsService.on("chat:response", (msg) => {
        const { message, reasoning } = msg.data as {
          message: string;
          reasoning?: string;
        };
        addChatMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          reasoning,
          timestamp: msg.timestamp,
        });
      }),

      wsService.on("action:approved", (msg) => {
        const { id } = msg.data as { id: string };
        approveDecision(id);
      }),

      wsService.on("action:rejected", (msg) => {
        const { id } = msg.data as { id: string };
        rejectDecision(id);
      }),

      wsService.on("governance:update", (msg) => {
        const snapshot = msg.data as GovernanceSnapshot;
        updateGovernance(snapshot);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [
    updateQueue,
    addAlert,
    resolveAlert,
    addDecision,
    approveDecision,
    rejectDecision,
    addNegotiation,
    updateCost,
    addChatMessage,
    updateGovernance,
  ]);

  return null;
}
