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
    addTrendPoint,
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
        const data = msg.data as { id?: string; decisionId?: string };
        approveDecision(data.decisionId || data.id || "");
      }),

      wsService.on("action:rejected", (msg) => {
        const data = msg.data as { id?: string; decisionId?: string };
        rejectDecision(data.decisionId || data.id || "");
      }),

      wsService.on("action:auto_approved", (msg) => {
        const data = msg.data as { decisionId?: string };
        if (data.decisionId) approveDecision(data.decisionId);
      }),

      wsService.on("action:human_approved", (msg) => {
        const data = msg.data as { decisionId?: string };
        if (data.decisionId) approveDecision(data.decisionId);
      }),

      wsService.on("governance:update", (msg) => {
        const snapshot = msg.data as GovernanceSnapshot;
        updateGovernance(snapshot);
      }),

      wsService.on("operations:tick", (msg) => {
        const data = msg.data as {
          tick?: number;
          waitTime?: number;
          queueDepth?: number;
          serviceLevel?: number;
          totalActions?: number;
        };
        const tick = data.tick ?? 0;
        addTrendPoint({
          tick,
          label: `T${tick}`,
          waitTime: data.waitTime ?? 0,
          queueDepth: data.queueDepth ?? 0,
          serviceLevel: data.serviceLevel ?? 85,
          aiActionsCount: data.totalActions ?? 0,
        });
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
    addTrendPoint,
  ]);

  return null;
}
