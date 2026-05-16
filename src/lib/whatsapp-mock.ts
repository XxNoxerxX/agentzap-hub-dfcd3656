import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

/**
 * Camada mock do WhatsApp. Simula Baileys via dados aleatórios no Lovable Cloud.
 * Quando você plugar um backend real (Baileys em VPS), basta substituir estas
 * funções por chamadas fetch — a interface permanece idêntica.
 */

const SAMPLE_GROUPS = [
  "IFOOD MADRUGA – CDE/PDT FRANCO",
  "Marketing Digital Brasil 🇧🇷",
  "Tráfego Pago Premium",
  "Drop BR – Loja & Fornecedores",
  "Investidores Cripto SP",
  "Cotação USDT Paraguai",
  "Atacadistas CDE",
  "Importação Direta China",
];
const PUSH_NAMES = ["Carlos", "Ana", "João", "Maria", "Lucas", "Beatriz", "Pedro", "Larissa", "Rafael", "Juliana", null, null];
const DDIS = ["55", "57", "595", "598", "591", "54", "1", "351", "44", "49", "86"];

function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function randDigits(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export async function createInstance(name: string) {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .insert({ name, status: "disconnected" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listInstances() {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInstance(id: string) {
  const { data, error } = await supabase.from("whatsapp_instances").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function deleteInstance(id: string) {
  const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
  if (error) throw error;
}

export async function connectInstance(id: string) {
  // Gera QR fake e marca como qr_ready
  const payload = `agentzap-mock-${id}-${Date.now()}`;
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 256, color: { dark: "#1a0b2e", light: "#ffffff" } });
  await supabase.from("whatsapp_instances").update({ status: "qr_ready" }).eq("id", id);
  // Após 8s simula conexão concluída
  setTimeout(() => {
    void supabase
      .from("whatsapp_instances")
      .update({
        status: "connected",
        phone_number: `+55${randDigits(2)}9${randDigits(8)}`,
        session_data: { mock: true, connectedAt: new Date().toISOString() },
      })
      .eq("id", id);
  }, 8000);
  return { qr: qrDataUrl };
}

export async function disconnectInstance(id: string, logout = false) {
  await supabase
    .from("whatsapp_instances")
    .update({
      status: "disconnected",
      ...(logout ? { phone_number: null, session_data: null } : {}),
    })
    .eq("id", id);
}

export async function reconnectInstance(id: string) {
  await supabase.from("whatsapp_instances").update({ status: "connecting" }).eq("id", id);
  setTimeout(() => {
    void supabase.from("whatsapp_instances").update({ status: "connected" }).eq("id", id);
  }, 1500);
}

export async function fetchGroups(instanceId: string) {
  // Gera grupos aleatórios e faz upsert
  const sample = SAMPLE_GROUPS.slice(0, 3 + Math.floor(Math.random() * 5)).map((name, i) => ({
    instance_id: instanceId,
    group_jid: `120363${randDigits(12)}@g.us`,
    name,
    member_count: 30 + Math.floor(Math.random() * 380),
    description: i % 2 === 0 ? "Grupo oficial. Proibido spam." : null,
    fetched_at: new Date().toISOString(),
  }));
  await supabase.from("whatsapp_groups").upsert(sample, { onConflict: "instance_id,group_jid", ignoreDuplicates: false });
  const { data, error } = await supabase
    .from("whatsapp_groups")
    .select("*")
    .eq("instance_id", instanceId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function extractMembers(groupId: string, instanceId: string, groupName: string) {
  const count = 8 + Math.floor(Math.random() * 80);
  const members = Array.from({ length: count }, () => {
    const isLid = Math.random() < 0.15;
    const ddi = rand(DDIS);
    const phone = isLid ? `${randDigits(15)}` : `+${ddi}${randDigits(9 + Math.floor(Math.random() * 2))}`;
    return {
      group_id: groupId,
      instance_id: instanceId,
      phone_number: phone,
      push_name: rand(PUSH_NAMES),
      is_admin: Math.random() < 0.08,
      is_lid: isLid,
      lid_raw_id: isLid ? phone : null,
    };
  });
  await supabase
    .from("group_members")
    .upsert(members, { onConflict: "group_id,phone_number", ignoreDuplicates: true });
  await supabase.from("extraction_history").insert({
    instance_id: instanceId,
    group_id: groupId,
    group_name: groupName,
    member_count: count,
    status: "success",
  });
  await supabase.from("whatsapp_groups").update({ member_count: count }).eq("id", groupId);
  return count;
}

export async function filterNumbers(instanceId: string | null, numbers: string[]) {
  const clean = numbers.map((n) => n.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const n of clean) (Math.random() < 0.72 ? valid : invalid).push(n);
  await supabase.from("number_filters").insert({
    instance_id: instanceId,
    total_checked: clean.length,
    valid_count: valid.length,
    invalid_count: invalid.length,
  });
  return { valid, invalid };
}
