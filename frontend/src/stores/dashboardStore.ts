import { create } from "zustand";
import type {
  QueueMetrics,
  Alert,
  AgentDecision,
  AgentNegotiation,
  CostSummary,
  ChatMessage,
  GovernanceSnapshot,
  SessionReport,
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
  resetForNewDemo: () => void;

  // Governance scorecard
  governance: GovernanceSnapshot;
  updateGovernance: (snapshot: Partial<GovernanceSnapshot>) => void;

  // Session report (persists across page navigations)
  sessionReport: SessionReport | null;
  setSessionReport: (report: SessionReport | null) => void;
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
    set((state) => {
      // Deduplicate by ID
      if (state.alerts.some((a) => a.id === alert.id)) return state;
      return { alerts: [alert, ...state.alerts].slice(0, 100) };
    }),
  resolveAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, resolvedAt: new Date().toISOString() } : a
      ),
    })),

  decisions: [],
  addDecision: (decision) =>
    set((state) => {
      // Deduplicate by ID, but update if phase changed (e.g. decided → acted)
      const existing = state.decisions.find((d) => d.id === decision.id);
      if (existing) {
        if (existing.phase !== decision.phase) {
          return {
            decisions: state.decisions.map((d) =>
              d.id === decision.id ? { ...d, ...decision } : d
            ),
          };
        }
        return state;
      }
      return { decisions: [decision, ...state.decisions].slice(0, 200) };
    }),
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
    set((state) => ({
      chatMessages: [...state.chatMessages, message].slice(-200),
    })),

  simulationActive: false,
  setSimulationActive: (active) => set({ simulationActive: active }),
  resetForNewDemo: () =>
    set({
      queues: [],
      alerts: [],
      decisions: [],
      negotiations: [],
      chatMessages: [],
      costSummary: {
        totalSaved: 0,
        totalPreventedAbandoned: 0,
        actionsToday: 0,
        lastUpdated: new Date().toISOString(),
      },
      governance: {
        totalDecisions: 0,
        autoApproved: 0,
        humanApproved: 0,
        blocked: 0,
        avgConfidence: 0,
        lastUpdated: new Date().toISOString(),
      },
    }),

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

  sessionReport: null,
  setSessionReport: (report) => set({ sessionReport: report }),
}));
