import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/buscar-grupos")({
  head: () => ({
    meta: [
      { title: "Buscar Grupos — AgentZap" },
      { name: "description", content: "Busca inteligente de grupos WhatsApp com IA em 5 fases." },
    ],
  }),
  component: BuscarGruposPage,
});

interface FoundGroup { url: string; title?: string; description?: string; relevance?: number }
type LogEntry = { phase: number; type: "info" | "ok" | "err"; msg: string; t: string };

function BuscarGruposPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groups, setGroups] = useState<FoundGroup[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const push = (e: Omit<LogEntry, "t">) => {
    setLogs((prev) => [...prev, { ...e, t: new Date().toLocaleTimeString("pt-BR") }]);
    setTimeout(() => logRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 30);
  };

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setLogs([]); setGroups([]);
    try {
      const res = await fetch("/api/group-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
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
            if (evt.group) setGroups((g) => g.find((x) => x.url === evt.group.url) ? g : [...g, evt.group]);
            if (evt.groups) setGroups(evt.groups);
            if (evt.done) { toast.success(`Busca concluída — ${evt.total ?? 0} grupos`); }
            if (evt.error) { toast.error(evt.error); push({ phase: 0, type: "err", msg: evt.error }); }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  const PHASES = ["Estratégia IA", "Brave Search", "Deep Scrape", "Sites Diretório", "Enriquecimento IA"];

  return (
    <div>
      <PageHeader
        title="Buscar Grupos"
        description="Busca inteligente de grupos WhatsApp em 5 fases com streaming em tempo real."
      />

      <GlassCard className="mb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ex: dropshipping nacional, marketing digital, criptomoedas Brasil…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={loading}
          />
          <Button onClick={run} disabled={loading || !query.trim()} className="gradient-primary text-white border-0 hover:opacity-90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Buscar com IA
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard neonTop className="p-0 overflow-hidden">
          <div className="border-b border-border/40 bg-black/30 px-4 py-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500" /><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="ml-2">agentzap@search ~ %</span>
          </div>
          <div ref={logRef} className="h-[480px] overflow-y-auto p-4 font-mono text-xs leading-relaxed">
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
          <div className="border-b border-border/40 px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Grupos encontrados <Badge variant="outline" className="ml-auto">{groups.length}</Badge>
          </div>
          <div className="h-[480px] overflow-y-auto p-3 space-y-2">
            {groups.map((g, i) => (
              <motion.a key={g.url + i} href={g.url} target="_blank" rel="noreferrer"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="block rounded-lg border border-border/40 bg-card/60 p-3 hover:border-primary/60 hover:bg-card/90 transition">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {g.title ?? g.url} <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    {g.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</div>}
                    <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">{g.url}</div>
                  </div>
                  {g.relevance != null && (
                    <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 shrink-0">{Math.round(g.relevance * 100)}%</Badge>
                  )}
                </div>
              </motion.a>
            ))}
            {!loading && groups.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">Nenhum grupo ainda.</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
