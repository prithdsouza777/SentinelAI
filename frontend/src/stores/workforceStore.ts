import { create } from "zustand";
import type { HumanAgentProfile } from "@/types";
import { humanAgentsApi } from "@/services/api";

interface WorkforceState {
  agents: HumanAgentProfile[];
  loading: boolean;
  error: string | null;
  selectedAgent: HumanAgentProfile | null;
  searchQuery: string;
  departmentFilter: string; // "" = all, or "q-support", etc.
  statusFilter: string; // "" = all, "available", "busy", "on_break"

  fetchAgents: () => Promise<void>;
  setSelectedAgent: (agent: HumanAgentProfile | null) => void;
  setSearchQuery: (query: string) => void;
  setDepartmentFilter: (dept: string) => void;
  setStatusFilter: (status: string) => void;
  getFilteredAgents: () => HumanAgentProfile[];
}

export const useWorkforceStore = create<WorkforceState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,
  selectedAgent: null,
  searchQuery: "",
  departmentFilter: "",
  statusFilter: "",

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const data = await humanAgentsApi.list();
      set({ agents: data.agents, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDepartmentFilter: (dept) => set({ departmentFilter: dept }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  getFilteredAgents: () => {
    const { agents, searchQuery, departmentFilter, statusFilter } = get();
    return agents.filter((a) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = a.name.toLowerCase().includes(q);
        const skillMatch = a.skillProficiencies.some(
          (s) => s.skillName.replace("_", " ").includes(q) && s.proficiency >= 0.3
        );
        if (!nameMatch && !skillMatch) return false;
      }
      if (departmentFilter && a.currentQueueId !== departmentFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  },
}));
