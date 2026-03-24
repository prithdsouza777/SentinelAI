const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Queues ──

export const queuesApi = {
  list: () => request("/queues"),
  getMetrics: (id: string) => request(`/queues/${id}/metrics`),
};

// ── Agents ──

export const agentsApi = {
  list: () => request("/agents"),
  getDecisions: () => request("/agents/decisions"),
  getNegotiations: () => request("/agents/negotiations"),
  getAuditLog: (limit = 100) => request(`/agents/audit?limit=${limit}`),
  getGovernanceSummary: () => request("/agents/governance"),
};

// ── Alerts ──

export const alertsApi = {
  list: () => request("/alerts"),
  acknowledge: (id: string) =>
    request(`/alerts/${id}/acknowledge`, { method: "POST" }),
};

// ── Chat ──

export const chatApi = {
  send: (message: string) =>
    request("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  createPolicy: (rule: string) =>
    request("/chat/policy", {
      method: "POST",
      body: JSON.stringify({ rule }),
    }),
  listPolicies: () => request("/chat/policies"),
  deletePolicy: (id: string) =>
    request(`/chat/policies/${id}`, { method: "DELETE" }),
};

// ── Simulation ──

export const simulationApi = {
  listScenarios: () => request("/simulation/scenarios"),
  start: (scenarioId: string) =>
    request("/simulation/start", {
      method: "POST",
      body: JSON.stringify({ scenario_id: scenarioId }),
    }),
  stop: () => request("/simulation/stop", { method: "POST" }),
  injectChaos: (event: { type: string; params: Record<string, unknown> }) =>
    request("/simulation/chaos", {
      method: "POST",
      body: JSON.stringify(event),
    }),
  whatIf: (query: string) =>
    request("/simulation/whatif", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};

// ── Human Agents (Workforce) ──

export const humanAgentsApi = {
  list: () => request<{ agents: import("@/types").HumanAgentProfile[] }>("/agents/human"),
  get: (id: string) => request<import("@/types").HumanAgentProfile>(`/agents/human/${id}`),
  byDepartment: (deptId: string, limit = 10) =>
    request<{ agents: import("@/types").HumanAgentProfile[] }>(
      `/agents/human/by-department/${deptId}?limit=${limit}`
    ),
};

// ── Cost Impact ──

export const costApi = {
  getSummary: () => request("/cost-impact"),
};

// ── Actions ──

export const actionsApi = {
  getLog: () => request("/actions/log"),
};

// ── Health ──

export const healthApi = {
  check: () => request("/health"),
};

// ── Reports ──

export const reportsApi = {
  getSessionReport: () => request("/reports/session"),
};

// ── Notifications ──

export const notificationsApi = {
  getConfig: () => request("/notifications/config"),
  updateConfig: (config: Record<string, unknown>) =>
    request("/notifications/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  testTeams: () =>
    request("/notifications/test/teams", { method: "POST" }),
  testEmail: () =>
    request("/notifications/test/email", { method: "POST" }),
};

// ── History ──

export const historyApi = {
  getMetrics: (queueId?: string, limit = 60) => {
    const params = new URLSearchParams();
    if (queueId) params.set("queue_id", queueId);
    params.set("limit", String(limit));
    return request(`/metrics/history?${params}`);
  },
};
