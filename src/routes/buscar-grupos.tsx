import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, ExternalLink, Loader2, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/buscar-grupos")({
  head: () => ({
    meta: [
      { title: "Buscar Grupos — AgentZap" },
      { name: "description", content: "Busca agentic de grupos WhatsApp com Brave Search, validação real de convites e refinamento por IA." },
    ],
  }),
  component: BuscarGruposPage,
});

type GroupStatus = "active" | "revoked" | "unknown";
interface FoundGroup { url: string; code: string; title?: string; description?: string; image?: string; status: GroupStatus; relevance?: number }
type LogEntry = { phase: number; type: "info" | "ok" | "err"; msg: string; t: string };

function BuscarGruposPage() {
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(5);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groups, setGroups] = useState<Map<string, FoundGroup>>(new Map());
  const [filter, setFilter] = useState<"all" | "active" | "revoked" | "unknown">("active");
  const logRef = useRef<HTMLDivElement>(null);

  const push = (e: Omit<LogEntry, "t">) => {
    setLogs((prev) => [...prev, { ...e, t: new Date().toLocaleTimeString("pt-BR") }]);
    setTimeout(() => logRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 30);
  };

  const upsertGroup = (g: FoundGroup) => {
    setGroups((prev) => { const n = new Map(prev); n.set(g.code, g); return n; });
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setLogs([]); setGroups(new Map());
    try {
      const res = await fetch("/api/public/group-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), depth }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.log) push({ phase: evt.phase ?? 0, type: evt.type ?? "info", msg: evt.log });
            if (evt.group) upsertGroup(evt.group);
            if (evt.groupUpdate) upsertGroup(evt.groupUpdate);
            if (evt.groups) {
              const m = new Map<string, FoundGroup>();
              for (const g of evt.groups as FoundGroup[]) m.set(g.code, g);
              setGroups(m);
            }
            if (evt.done) toast.success(`Busca concluída — ${evt.active ?? 0} ativos · ${evt.revoked ?? 0} revogados · ${evt.unknown ?? 0} ?`);
            if (evt.error) { toast.error(evt.error); push({ phase: 0, type: "err", msg: evt.error }); }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  const PHASES = ["Estratégia IA", "Brave Search", "Validação Convite", "Refinamento Agentic", "Relevância IA"];
  const all = [...groups.values()];
  const counts = {
    all: all.length,
    active: all.filter((g) => g.status === "active").length,
    revoked: all.filter((g) => g.status === "revoked").length,
    unknown: all.filter((g) => g.status === "unknown").length,
  };
  const filtered = filter === "all" ? all : all.filter((g) => g.status === filter);
  const sorted = filtered.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  return (
    <div>
      <PageHeader
        title="Buscar Grupos"
        description="Busca agentic em 5 fases: Brave Search + validação real de convites + auto-refinamento por IA."
      />

      <GlassCard className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: dropshipping nacional, cripto SP, marketing digital BR…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && run()}
              disabled={loading}
            />
            <Button onClick={run} disabled={loading || !query.trim()} className="gradient-primary text-white border-0 hover:opacity-90">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Buscar com IA
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground whitespace-nowrap">Profundidade: <span className="font-mono text-foreground">{depth}/5</span></div>
            <Slider value={[depth]} onValueChange={(v) => setDepth(v[0])} min={1} max={5} step={1} disabled={loading} className="max-w-xs" />
            <div className="text-xs text-muted-foreground">
              {depth === 1 && "~10 dorks, rápido"}
              {depth === 2 && "~15 dorks"}
              {depth === 3 && "~25 dorks + 1 refinamento"}
              {depth === 4 && "~40 dorks + 1 refinamento"}
              {depth === 5 && "~60 dorks + 2 refinamentos (exaustivo, ~3-5min)"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p, i) => {
              const active = logs.some((l) => l.phase === i + 1);
              const done = logs.some((l) => l.phase === i + 1 && l.type === "ok");
              return (
                <Badge key={p} variant="outline" className={
                  done ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : active ? "bg-primary/15 text-primary border-primary/30 animate-pulse"
                  : "bg-muted/30 text-muted-foreground"
                }>
                  {i + 1}. {p}
                </Badge>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard neonTop className="p-0 overflow-hidden">
          <div className="border-b border-border/40 bg-black/30 px-4 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500" /><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="ml-2">agentzap@search ~ %</span>
          </div>
          <div ref={logRef} className="h-[560px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
            {logs.length === 0 && <div className="text-muted-foreground">Aguardando busca…</div>}
            {logs.map((l, i) => (
              <div key={i} className={
                l.type === "ok" ? "text-emerald-400" :
                l.type === "err" ? "text-rose-400" :
                l.phase === 1 ? "text-primary" :
                l.phase === 2 ? "text-cyan-300" :
                l.phase === 3 ? "text-purple-300" :
                l.phase === 4 ? "text-pink-300" :
                l.phase === 5 ? "text-amber-300" : "text-foreground"
              }>
                <span className="text-muted-foreground">[{l.t}]</span>{" "}
                <span className="text-muted-foreground">[F{l.phase}]</span>{" "}
                {l.msg}
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard neonTop className="p-0 overflow-hidden">
          <div className="border-b border-border/40 px-4 py-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Grupos</span>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="ml-auto">
              <TabsList className="h-8">
                <TabsTrigger value="active" className="text-xs h-6 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">Ativos ({counts.active})</TabsTrigger>
                <TabsTrigger value="unknown" className="text-xs h-6 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">? ({counts.unknown})</TabsTrigger>
                <TabsTrigger value="revoked" className="text-xs h-6 data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300">Revogados ({counts.revoked})</TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-6">Todos ({counts.all})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-[560px] overflow-y-auto p-3 space-y-2">
            {sorted.map((g) => {
              const StatusIcon = g.status === "active" ? CheckCircle2 : g.status === "revoked" ? XCircle : HelpCircle;
              const statusCls = g.status === "active" ? "text-emerald-400" : g.status === "revoked" ? "text-rose-400" : "text-amber-400";
              return (
                <motion.a key={g.code} href={g.url} target="_blank" rel="noreferrer"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className={`block rounded-lg border p-3 transition ${
                    g.status === "active" ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : g.status === "revoked" ? "border-rose-500/20 bg-rose-500/5 opacity-60 hover:opacity-100"
                    : "border-border/40 bg-card/60 hover:bg-card/90"
                  }`}>
                  <div className="flex items-start gap-2">
                    {g.image && <img src={g.image} alt="" className="h-10 w-10 rounded-full shrink-0 object-cover" loading="lazy" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusCls}`} />
                        {g.title ?? g.url}
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      {g.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</div>}
                      <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">{g.url}</div>
                    </div>
                    {g.relevance != null && (
                      <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 shrink-0">{Math.round(g.relevance * 100)}%</Badge>
                    )}
                  </div>
                </motion.a>
              );
            })}
            {!loading && sorted.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">Nenhum grupo {filter !== "all" ? `(${filter})` : ""} ainda.</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
