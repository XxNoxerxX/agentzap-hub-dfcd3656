/**
 * Métodos tipados que espelham a API do backend AgentZap (openwa).
 * Use em vez de chamar `supabase` diretamente. Quando todas as rotas
 * estiverem migradas, podemos remover @supabase/supabase-js do projeto.
 */
import { api } from "../api-client";

export interface Instance {
  id: string;
  name: string;
  status: "disconnected" | "connecting" | "qr_ready" | "connected";
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  instance_id: string;
  group_jid: string;
  name: string;
  description: string | null;
  member_count: number;
  member_goal: number | null;
  is_admin: boolean;
  fetched_at: string;
}

export interface Lead {
  id: string;
  phone_number: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  tags: string[];
  source: string;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  instance_id: string | null;
  group_id: string | null;
  group_name: string | null;
  target_count: number;
  added_count: number;
  failed_count: number;
  status: "pending" | "running" | "completed" | "failed";
  risk_level: "green" | "yellow" | "red";
  lead_ids: string[];
  log: { ts: string; msg: string }[];
  created_at: string;
  finished_at: string | null;
  instance_name?: string | null;
}

export const backend = {
  instances: {
    list: () => api<Instance[]>("/instances"),
    create: (name: string) => api<Instance>("/instances", { method: "POST", body: JSON.stringify({ name }) }),
    remove: (id: string) => api<{ ok: true }>(`/instances/${id}`, { method: "DELETE" }),
    connect: (id: string) => api<{ qr: string | null; status: string }>(`/instances/${id}/connect`, { method: "POST" }),
    disconnect: (id: string, logout = false) =>
      api<{ ok: true }>(`/instances/${id}/disconnect`, { method: "POST", body: JSON.stringify({ logout }) }),
    status: (id: string) => api<Instance & { live_status: string; qr: string | null }>(`/instances/${id}/status`),
  },
  groups: {
    list: (params: { instance_id?: string; only_admin?: boolean } = {}) => {
      const s = new URLSearchParams();
      if (params.instance_id) s.set("instance_id", params.instance_id);
      if (params.only_admin) s.set("only_admin", "true");
      return api<Group[]>(`/groups?${s}`);
    },
    refresh: (instanceId: string) => api<Group[]>(`/groups/refresh/${instanceId}`, { method: "POST" }),
    setGoal: (id: string, goal: number | null) =>
      api<{ ok: true }>(`/groups/${id}`, { method: "PATCH", body: JSON.stringify({ member_goal: goal }) }),
  },
  leads: {
    search: (filters: Record<string, string | number | undefined>) => {
      const s = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v != null && v !== "" && s.set(k, String(v)));
      return api<Lead[]>(`/leads?${s}`);
    },
    create: (data: Partial<Lead> & { phone_number: string }) =>
      api<Lead>("/leads", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: string) => api<{ ok: true }>(`/leads/${id}`, { method: "DELETE" }),
  },
  jobs: {
    list: (limit = 30) => api<Job[]>(`/jobs?limit=${limit}`),
    get: (id: string) => api<Job>(`/jobs/${id}`),
    start: (data: {
      instance_id: string;
      group_id: string;
      group_name: string;
      lead_ids: string[];
      phones: string[];
    }) => api<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),
  },
};
