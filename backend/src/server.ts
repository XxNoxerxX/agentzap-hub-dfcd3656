import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { requireToken } from "./auth.js";
import instances from "./routes/instances.js";
import groups from "./routes/groups.js";
import leads from "./routes/leads.js";
import jobs from "./routes/jobs.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/instances", requireToken, instances);
app.use("/groups", requireToken, groups);
app.use("/leads", requireToken, leads);
app.use("/jobs", requireToken, jobs);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`AgentZap backend rodando em http://localhost:${port}`));
