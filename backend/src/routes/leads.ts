import { Router } from "express";
import { q, one } from "../db.js";

const r = Router();

r.get("/", async (req, res) => {
  const { gender, state, city, ageMin, ageMax, search, limit = "500" } = req.query as Record<string, string>;
  const where: string[] = [];
  const p: any[] = [];
  if (gender && gender !== "all") { p.push(gender); where.push(`gender=$${p.length}`); }
  if (state) { p.push(state); where.push(`state=$${p.length}`); }
  if (city) { p.push(`%${city}%`); where.push(`city ILIKE $${p.length}`); }
  if (ageMin) { p.push(Number(ageMin)); where.push(`age >= $${p.length}`); }
  if (ageMax) { p.push(Number(ageMax)); where.push(`age <= $${p.length}`); }
  if (search) {
    p.push(`%${search}%`);
    where.push(`(name ILIKE $${p.length} OR phone_number ILIKE $${p.length})`);
  }
  p.push(Math.min(Number(limit) || 500, 5000));
  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT $${p.length}`;
  res.json(await q(sql, p));
});

r.post("/", async (req, res) => {
  const { phone_number, name, age, gender, state, city, tags, source, notes } = req.body ?? {};
  if (!phone_number) return res.status(400).json({ error: "phone_number required" });
  const row = await one(
    `INSERT INTO leads (phone_number, name, age, gender, state, city, tags, source, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'manual'),$9) RETURNING *`,
    [phone_number, name, age, gender, state, city, tags ?? [], source, notes],
  );
  res.json(row);
});

r.delete("/:id", async (req, res) => {
  await q("DELETE FROM leads WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

export default r;
