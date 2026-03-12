import { create } from "zustand";
import type {
  QueueMetrics,
  Alert,
  AgentDecision,
  AgentNegotiation,
  CostSummary,
  ChatMessage,
  GovernanceSnapshot,
} from "../types";

interface DashboardState {
  // Queue metrics
  queues: QueueMetrics[];
  setQueues: (queues: QueueMetrics[]) => void;
  updateQueue: (queue: QueueMetrics) => void;

  // Alerts
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  resolveAlert: (id: string) => void;

  // AI Decisions
  decisions: AgentDecision[];
  addDecision: (decision: AgentDecision) => void;
  approveDecision: (id: string) => void;
  rejectDecision: (id: string) => void;

  // Negotiations
  negotiations: AgentNegotiation[];
  addNegotiation: (negotiation: AgentNegotiation) => void;

  // Cost
  costSummary: CostSummary;
  updateCost: (cost: Partial<CostSummary>) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;

  // Simulation
  simulationActive: boolean;
  setSimulationActive: (active: boolean) => void;

  // Governance scorecard
  governance: GovernanceSnapshot;
  updateGovernance: (snapshot: Partial<GovernanceSnapshot>) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  queues: [],
  setQueues: (queues) => set({ queues }),
  updateQueue: (queue) =>
    set((state) => {
      const exists = state.queues.some((q) => q.queueId === queue.queueId);
      return {
        queues: exists
          ? state.queues.map((q) => (q.queueId === queue.queueId ? queue : q))
          : [...state.queues, queue],
      };
    }),

  alerts: [],
  addAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 100) })),
  resolveAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, resolvedAt: new Date().toISOString() } : a
      ),
    })),

  decisions: [],
  addDecision: (decision) =>
    set((state) => ({
      decisions: [decision, ...state.decisions].slice(0, 200),
    })),
  approveDecision: (id) =>
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id ? { ...d, approved: true, phase: "acted" as const } : d
      ),
    })),
  rejectDecision: (id) =>
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id ? { ...d, approved: false } : d
      ),
    })),

  negotiations: [],
  addNegotiation: (negotiation) =>
    set((state) => ({
      negotiations: [negotiation, ...state.negotiations].slice(0, 50),
    })),

  costSummary: {
    totalSaved: 0,
    totalPreventedAbandoned: 0,
    actionsToday: 0,
    lastUpdated: new Date().toISOString(),
  },
  updateCost: (cost) =>
    set((state) => ({ costSummary: { ...state.costSummary, ...cost } })),

  chatMessages: [],
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  simulationActive: false,
  setSimulationActive: (active) => set({ simulationActive: active }),

  governance: {
    totalDecisions: 0,
    autoApproved: 0,
    humanApproved: 0,
    blocked: 0,
    avgConfidence: 0,
    lastUpdated: new Date().toISOString(),
  },
  updateGovernance: (snapshot) =>
    set((state) => ({ governance: { ...state.governance, ...snapshot } })),
}));
