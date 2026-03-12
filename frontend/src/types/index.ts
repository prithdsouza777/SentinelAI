// ── Queue Metrics ──

export interface QueueMetrics {
  queueId: string;
  queueName: string;
  contactsInQueue: number;
  oldestContactAge: number;
  agentsOnline: number;
  agentsAvailable: number;
  avgWaitTime: number;
  avgHandleTime: number;
  abandonmentRate: number;
  serviceLevel: number;
  contactsHandled: number;
  timestamp: string;
}

// ── Alerts ──

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  queueId: string;
  queueName: string;
  anomalyVelocity?: number;
  recommendedAction: string;
  timestamp: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// ── AI Agent Decisions ──

export type AgentType =
  | "queue_balancer"
  | "predictive_prevention"
  | "escalation_handler"
  | "analytics";

export type DecisionPhase =
  | "observed"
  | "analyzed"
  | "decided"
  | "acted"
  | "negotiating";

export type GuardrailStatus = "AUTO_APPROVE" | "PENDING_HUMAN" | "BLOCKED";

export interface AgentDecision {
  id: string;
  agentType: AgentType;
  phase: DecisionPhase;
  summary: string;
  reasoning: string;
  action?: string;
  costImpact?: CostImpact;
  timestamp: string;
  // Governance fields
  confidence: number;
  impactScore: number;
  riskScore: number;
  requiresApproval: boolean;
  approved?: boolean | null;
  autoApproveAt?: string | null;
  guardrailResult?: GuardrailStatus | null;
  policyViolations: string[];
}

export interface AgentNegotiation {
  id: string;
  agents: AgentType[];
  topic: string;
  proposals: NegotiationProposal[];
  resolution: string;
  timestamp: string;
}

export interface NegotiationProposal {
  agentType: AgentType;
  proposal: string;
  priority: number;
  confidence: number;
}

// ── Audit Trail ──

export interface AuditEntry {
  id: string;
  decisionId: string;
  agentType: AgentType;
  action: string;
  confidence: number;
  riskScore: number;
  guardrailResult: GuardrailStatus;
  policyViolations: string[];
  approvedBy?: string | null;
  executionResult?: string | null;
  timestamp: string;
}

// ── Governance Scorecard ──

export interface GovernanceSnapshot {
  totalDecisions: number;
  autoApproved: number;
  humanApproved: number;
  blocked: number;
  avgConfidence: number;
  lastUpdated: string;
}

// ── Cost Impact ──

export interface CostImpact {
  preventedAbandoned: number;
  savedAmount: number;
  actionCost: number;
  netSavings: number;
}

export interface CostSummary {
  totalSaved: number;
  revenueAtRisk?: number;       // ticks up during active CRITICAL alerts
  totalPreventedAbandoned: number;
  actionsToday: number;
  lastUpdated: string;
}

// ── Chat ──

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  timestamp: string;
}

// ── Simulation ──

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  duration: number;
}

export type ChaosEventType =
  | "kill_agents"
  | "spike_queue"
  | "network_delay"
  | "cascade_failure";

export interface ChaosEvent {
  type: ChaosEventType;
  params: Record<string, unknown>;
}

// ── WebSocket Events ──

export type WSEventType =
  | "queue:update"
  | "agent:update"
  | "alert:new"
  | "alert:resolved"
  | "action:taken"
  | "action:approved"
  | "action:rejected"
  | "agent:reasoning"
  | "agent:negotiation"
  | "cost:update"
  | "prediction:warning"
  | "chat:response"
  | "simulation:event"
  | "chaos:injected"
  | "governance:update";

export interface WSMessage {
  event: WSEventType;
  data: unknown;
  timestamp: string;
}
