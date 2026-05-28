import { Router } from "express";
import { q, one } from "../db.js";
import { addParticipant } from "../wa/manager.js";
import { riskFor, randomPause, sleep } from "../wa/throttle.js";

const r = Router();

r.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 30), 200);
  const rows = await q(
    `SELECT j.*, i.name AS instance_name
     FROM member_add_jobs j LEFT JOIN whatsapp_instances i ON i.id=j.instance_id
     ORDER BY j.created_at DESC LIMIT $1`,
    [limit],
  );
  res.json(rows);
});

r.get("/:id", async (req, res) => {
  const row = await one("SELECT * FROM member_add_jobs WHERE id=$1", [req.params.id]);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

r.post("/", async (req, res) => {
  const { instance_id, group_id, group_name, lead_ids = [], phones = [] } = req.body ?? {};
  if (!instance_id || !group_id || phones.length === 0) {
    return res.status(400).json({ error: "instance_id, group_id, phones required" });
  }
  const groupJid = (await one<{ group_jid: string }>("SELECT group_jid FROM whatsapp_groups WHERE id=$1", [group_id]))?.group_jid;
  if (!groupJid) return res.status(404).json({ error: "group not found" });

  const risk = riskFor(phones.length);
  const job = await one(
    `INSERT INTO member_add_jobs (instance_id, group_id, group_name, target_count, status, risk_level, lead_ids, log)
     VALUES ($1,$2,$3,$4,'running',$5,$6,$7) RETURNING *`,
    [instance_id, group_id, group_name, phones.length, risk, JSON.stringify(lead_ids),
     JSON.stringify([{ ts: new Date().toISOString(), msg: `Iniciando ${phones.length} adds (risco ${risk})` }])],
  );

  // execução em background
  void runJob(job.id, instance_id, groupJid, phones);
  res.json(job);
});

async function runJob(jobId: string, instanceId: string, groupJid: string, phones: string[]) {
  let added = 0, failed = 0;
  const log: any[] = [];
  for (const phone of phones) {
    try {
      await addParticipant(instanceId, groupJid, phone);
      added++;
      log.push({ ts: new Date().toISOString(), msg: `✔ ${phone} adicionado` });
    } catch (e: any) {
      failed++;
      log.push({ ts: new Date().toISOString(), msg: `✗ ${phone}: ${e?.message ?? "falhou"}` });
    }
    await q("UPDATE member_add_jobs SET added_count=$1, failed_count=$2, log=$3 WHERE id=$4",
      [added, failed, JSON.stringify(log), jobId]);
    await sleep(randomPause());
  }
  await q("UPDATE member_add_jobs SET status='completed', finished_at=now() WHERE id=$1", [jobId]);
}

export default r;
