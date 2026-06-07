import { create, type Client } from "@open-wa/wa-automate";
import path from "node:path";
import fs from "node:fs";

interface Session {
  client: Client | null;
  status: "disconnected" | "connecting" | "qr_ready" | "connected";
  qr: string | null;
  startedAt: number | null;
}

const sessions = new Map<string, Session>();

function dir() {
  const d = process.env.SESSIONS_DIR ?? "./sessions";
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

export function getSession(id: string): Session {
  if (!sessions.has(id)) sessions.set(id, { client: null, status: "disconnected", qr: null, startedAt: null });
  return sessions.get(id)!;
}

export async function startSession(id: string) {
  const s = getSession(id);
  if (s.client) return s;
  s.status = "connecting";
  s.startedAt = Date.now();
  try {
    const client = await create({
      sessionId: id,
      sessionDataPath: path.join(dir(), id),
      multiDevice: true,
      headless: true,
      qrTimeout: 0,
      authTimeout: 60,
      qrCallback: (qr: string) => { s.qr = qr; s.status = "qr_ready"; },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    s.client = client;
    s.status = "connected";
    s.qr = null;
  } catch (e) {
    s.status = "disconnected";
    throw e;
  }
  return s;
}

export async function stopSession(id: string, logout = false) {
  const s = sessions.get(id);
  if (!s?.client) return;
  if (logout) await s.client.logout().catch(() => {});
  await s.client.kill().catch(() => {});
  s.client = null;
  s.status = "disconnected";
  s.qr = null;
}

export async function listGroupsFor(id: string) {
  const s = getSession(id);
  if (!s.client) throw new Error("Instância não conectada");
  const chats = await s.client.getAllGroups();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return chats.map((c: any) => ({
    jid: c.id?._serialized ?? c.id,
    name: c.name ?? c.formattedTitle ?? "(sem nome)",
    member_count: c.groupMetadata?.participants?.length ?? 0,
    is_admin: !!c.groupMetadata?.participants?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => (p.id?._serialized ?? p.id) === s.client!.getSessionId() && (p.isAdmin || p.isSuperAdmin),
    ),
    description: c.groupMetadata?.desc ?? null,
  }));
}

export async function addParticipant(id: string, groupJid: string, phone: string) {
  const s = getSession(id);
  if (!s.client) throw new Error("Instância não conectada");
  const cleaned = phone.replace(/\D/g, "");
  const wid = `${cleaned}@c.us`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (s.client as any).addParticipant(groupJid, wid);
}
