import { Router } from "express";
import { q, one } from "../db.js";
import { getSession, startSession, stopSession } from "../wa/manager.js";
import QRCode from "qrcode";

const r = Router();

r.get("/", async (_req, res) => {
  const rows = await q("SELECT * FROM whatsapp_instances ORDER BY created_at DESC");
  res.json(rows);
});

r.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name required" });
  const row = await one(
    "INSERT INTO whatsapp_instances (name) VALUES ($1) RETURNING *",
    [name],
  );
  res.json(row);
});

r.delete("/:id", async (req, res) => {
  await stopSession(req.params.id).catch(() => {});
  await q("DELETE FROM whatsapp_instances WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

r.post("/:id/connect", async (req, res) => {
  startSession(req.params.id).catch((e) => console.error("startSession", e));
  // espera até 5s pelo QR
  for (let i = 0; i < 25; i++) {
    const s = getSession(req.params.id);
    if (s.qr) {
      const dataUrl = await QRCode.toDataURL(s.qr, { width: 256, margin: 1 });
      await q("UPDATE whatsapp_instances SET status='qr_ready', updated_at=now() WHERE id=$1", [req.params.id]);
      return res.json({ qr: dataUrl, status: "qr_ready" });
    }
    if (s.status === "connected") {
      await q("UPDATE whatsapp_instances SET status='connected', updated_at=now() WHERE id=$1", [req.params.id]);
      return res.json({ qr: null, status: "connected" });
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  res.json({ qr: null, status: "connecting" });
});

r.post("/:id/disconnect", async (req, res) => {
  const logout = !!req.body?.logout;
  await stopSession(req.params.id, logout);
  await q(
    `UPDATE whatsapp_instances SET status='disconnected', ${logout ? "phone_number=NULL, session_data=NULL," : ""} updated_at=now() WHERE id=$1`,
    [req.params.id],
  );
  res.json({ ok: true });
});

r.get("/:id/status", async (req, res) => {
  const row = await one("SELECT * FROM whatsapp_instances WHERE id=$1", [req.params.id]);
  if (!row) return res.status(404).json({ error: "not found" });
  const s = getSession(req.params.id);
  res.json({ ...row, live_status: s.status, qr: s.qr ? await QRCode.toDataURL(s.qr) : null });
});

export default r;
