import { Router } from "express";
import { q } from "../db.js";
import { listGroupsFor } from "../wa/manager.js";

const r = Router();

r.get("/", async (req, res) => {
  const { instance_id, only_admin } = req.query;
  const where: string[] = [];
  const params: any[] = [];
  if (instance_id) { params.push(instance_id); where.push(`instance_id=$${params.length}`); }
  if (only_admin === "true") where.push("is_admin=true");
  const sql = `SELECT * FROM whatsapp_groups ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY name`;
  res.json(await q(sql, params));
});

r.post("/refresh/:instanceId", async (req, res) => {
  const list = await listGroupsFor(req.params.instanceId);
  for (const g of list) {
    await q(
      `INSERT INTO whatsapp_groups (instance_id, group_jid, name, description, member_count, is_admin, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (instance_id, group_jid) DO UPDATE
       SET name=EXCLUDED.name, description=EXCLUDED.description,
           member_count=EXCLUDED.member_count, is_admin=EXCLUDED.is_admin, fetched_at=now()`,
      [req.params.instanceId, g.jid, g.name, g.description, g.member_count, g.is_admin],
    );
  }
  const rows = await q("SELECT * FROM whatsapp_groups WHERE instance_id=$1 ORDER BY name", [req.params.instanceId]);
  res.json(rows);
});

r.patch("/:id", async (req, res) => {
  const { member_goal } = req.body ?? {};
  await q("UPDATE whatsapp_groups SET member_goal=$1 WHERE id=$2", [member_goal ?? null, req.params.id]);
  res.json({ ok: true });
});

export default r;
