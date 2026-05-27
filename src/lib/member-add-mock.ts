import { supabase } from "@/integrations/supabase/client";

/**
 * Camada mock de adição de membros em grupos do WhatsApp.
 * Substitua por chamadas HTTP ao backend Baileys (VPS) quando estiver pronto.
 *
 * Endpoint esperado na VPS:
 *   POST {VPS_URL}/instances/:instanceId/groups/:groupJid/add-members
 *   body: { phones: string[] }
 *
 * Termômetro (conservador): por dia, por grupo
 *   verde: até 5 adds  |  amarelo: 6-15  |  vermelho: 16+
 *   contas com <7 dias de conexão: limites pela metade
 *   pausa randômica 60-180s entre adds
 */

export type RiskLevel = "green" | "yellow" | "red";

export function riskFromCount(count: number, accountAgeDays = 30): RiskLevel {
  const factor = accountAgeDays < 7 ? 2 : 1;
  if (count * factor <= 5) return "green";
  if (count * factor <= 15) return "yellow";
  return "red";
}

export function riskLabel(r: RiskLevel) {
  return r === "green" ? "Seguro" : r === "yellow" ? "Cuidado" : "Risco alto de ban";
}

export function riskColor(r: RiskLevel) {
  return r === "green"
    ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
    : r === "yellow"
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-rose-400 border-rose-500/40 bg-rose-500/10";
}

export interface LeadFilters {
  gender?: "M" | "F" | "all";
  state?: string;
  city?: string;
  ageMin?: number;
  ageMax?: number;
  search?: string;
  limit?: number;
}

export async function searchLeads(f: LeadFilters) {
  let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (f.gender && f.gender !== "all") q = q.eq("gender", f.gender);
  if (f.state) q = q.eq("state", f.state);
  if (f.city) q = q.ilike("city", `%${f.city}%`);
  if (f.ageMin != null) q = q.gte("age", f.ageMin);
  if (f.ageMax != null) q = q.lte("age", f.ageMax);
  if (f.search) q = q.or(`name.ilike.%${f.search}%,phone_number.ilike.%${f.search}%`);
  q = q.limit(f.limit ?? 500);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listAdminGroups(instanceId?: string) {
  let q = supabase.from("whatsapp_groups").select("*").eq("is_admin", true).order("name");
  if (instanceId) q = q.eq("instance_id", instanceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateGroupGoal(groupId: string, goal: number | null) {
  const { error } = await supabase
    .from("whatsapp_groups")
    .update({ member_goal: goal })
    .eq("id", groupId);
  if (error) throw error;
}

export interface StartAddJobParams {
  instanceId: string;
  groupId: string;
  groupName: string;
  leadIds: string[];
  phones: string[];
}

/** Cria job e simula execução em background com pausa randômica. */
export async function startAddJob(p: StartAddJobParams) {
  const risk = riskFromCount(p.phones.length);
  const { data: job, error } = await supabase
    .from("member_add_jobs")
    .insert({
      instance_id: p.instanceId,
      group_id: p.groupId,
      group_name: p.groupName,
      target_count: p.phones.length,
      status: "running",
      risk_level: risk,
      lead_ids: p.leadIds,
      log: [{ ts: new Date().toISOString(), msg: `Iniciando adição de ${p.phones.length} membros (risco ${risk})` }],
    })
    .select()
    .single();
  if (error) throw error;

  // Simula execução em background — substitua por POST à VPS
  void simulateExecution(job.id, p.phones);
  return job;
}

async function simulateExecution(jobId: string, phones: string[]) {
  let added = 0;
  let failed = 0;
  const log: { ts: string; msg: string }[] = [];
  for (let i = 0; i < phones.length; i++) {
    // Pausa randômica 1-3s no mock (60-180s em produção)
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 2200));
    const ok = Math.random() > 0.18;
    if (ok) {
      added++;
      log.push({ ts: new Date().toISOString(), msg: `✔ ${phones[i]} adicionado` });
    } else {
      failed++;
      log.push({ ts: new Date().toISOString(), msg: `✗ ${phones[i]} falhou (privacidade ou inválido)` });
    }
    await supabase
      .from("member_add_jobs")
      .update({ added_count: added, failed_count: failed, log })
      .eq("id", jobId);
  }
  await supabase
    .from("member_add_jobs")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function listJobs(limit = 30) {
  const { data, error } = await supabase
    .from("member_add_jobs")
    .select("*, whatsapp_instances(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Quantos membros foram adicionados HOJE neste grupo (para o termômetro). */
export async function getTodayAddedForGroup(groupId: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("member_add_jobs")
    .select("added_count")
    .eq("group_id", groupId)
    .gte("created_at", since.toISOString());
  return (data ?? []).reduce((s, j) => s + (j.added_count ?? 0), 0);
}
