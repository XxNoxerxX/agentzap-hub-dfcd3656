import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, ExternalLink, Loader2, CheckCircle2, XCircle, HelpCircle, Lightbulb, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/buscar-grupos")({
  head: () => ({
    meta: [
      { title: "Buscar Grupos — AgentZap" },
      { name: "description", content: "Busca agentic de grupos WhatsApp com Brave Search, validação real e relevância estrita." },
    ],
  }),
  component: BuscarGruposPage,
});

type GroupStatus = "active" | "revoked" | "unknown";
interface FoundGroup { url: string; code: string; title?: string; description?: string; image?: string; status: GroupStatus; relevance?: number; reason?: string }
interface Expansion { brief: string; positiveTerms: string[]; negativeTerms: string[]; keywordVariants: string[]; suggestions: string[] }
type LogEntry = { phase: number; type: "info" | "ok" | "err"; msg: string; t: string };

function BuscarGruposPage() {
  const [query, setQuery] = useState("");
  const [context, setContext] = useState("");
  const [depth, setDepth] = useState(5);
  const [minRelevance, setMinRelevance] = useState(40);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [groups, setGroups] = useState<Map<string, FoundGroup>>(new Map());
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "revoked" | "unknown">("active");
  const logRef = useRef<HTMLDivElement>(null);

  const push = (e: Omit<LogEntry, "t">) => {
    setLogs((prev) => [...prev, { ...e, t: new Date().toLocaleTimeString("pt-BR") }]);
    setTimeout(() => logRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 30);
  };

  const upsertGroup = (g: FoundGroup) => {
    setGroups((prev) => { const n = new Map(prev); n.set(g.code, g); return n; });
  };

  const run = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    if (overrideQuery) setQuery(overrideQuery);
    setLoading(true); setLogs([]); setGroups(new Map()); setExpansion(null);
    try {
      const res = await fetch("/api/public/group-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, context: context.trim() || undefined, depth }),
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
            if (evt.expansion) setExpansion(evt.expansion);
            if (evt.group) upsertGroup(evt.group);
            if (evt.groupUpdate) upsertGroup(evt.groupUpdate);
            if (evt.groups) {
              const m = new Map<string, FoundGroup>();
              for (const g of evt.groups as FoundGroup[]) m.set(g.code, g);
              setGroups(m);
            }
            if (evt.done) toast.success(`${evt.relevant ?? 0} relevantes · ${evt.active ?? 0} ativos · ${evt.revoked ?? 0} revogados`);
            if (evt.error) { toast.error(evt.error); push({ phase: 0, type: "err", msg: evt.error }); }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  const PHASES = ["Expansão IA", "Estratégia", "Brave Search", "Validação", "Refinamento", "Relevância"];
  const all = [...groups.values()];
  const minRel = minRelevance / 100;
  const passesRel = (g: FoundGroup) => g.status !== "active" || (g.relevance ?? 0) >= minRel;
  const counts = {
    all: all.length,
    active: all.filter((g) => g.status === "active" && passesRel(g)).length,
    revoked: all.filter((g) => g.status === "revoked").length,
    unknown: all.filter((g) => g.status === "unknown").length,
  };
  const filtered = (filter === "all" ? all : all.filter((g) => g.status === filter)).filter(passesRel);
  const sorted = filtered.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  return (
    <div>
      <PageHeader
        title="Buscar Grupos"
        description="Pipeline agentic: expansão IA → dorks → Brave → validação real → relevância estrita."
      />

      <GlassCard className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="Palavra-chave (ex: paraguai, dropshipping nacional, cripto SP…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && run()}
              disabled={loading}
            />
            <Button onClick={() => run()} disabled={loading || !query.trim()} className="gradient-primary text-white border-0 hover:opacity-90">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Buscar com IA
            </Button>
          </div>
          <Textarea
            placeholder="Contexto opcional — o que você procura ESPECIFICAMENTE? Ex: 'grupos de compras/sacoleiros em Ciudad del Este, atacado, eletrônicos, estudantes que viajam pro PY' — quanto mais detalhe, mais precisa fica a busca."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={loading}
            rows={2}
            className="text-sm resize-none"
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Profundidade: <span className="font-mono text-foreground">{depth}/5</span> — {depth === 1 && "~10 dorks"}{depth === 2 && "~15 dorks"}{depth === 3 && "~25 + refinamento"}{depth === 4 && "~40 + refinamento"}{depth === 5 && "~60 + 2 refinamentos"}</div>
              <Slider value={[depth]} onValueChange={(v) => setDepth(v[0])} min={1} max={5} step={1} disabled={loading} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Relevância mínima: <span className="font-mono text-foreground">{minRelevance}%</span> — esconde grupos abaixo desse score</div>
              <Slider value={[minRelevance]} onValueChange={(v) => setMinRelevance(v[0])} min={0} max={90} step={5} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((p, i) => {
              const active = logs.some((l) => l.phase === i);
              const done = logs.some((l) => l.phase === i && l.type === "ok");
              return (
                <Badge key={p} variant="outline" className={
                  done ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : active ? "bg-primary/15 text-primary border-primary/30 animate-pulse"
                  : "bg-muted/30 text-muted-foreground"
                }>{i}. {p}</Badge>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {expansion && (
        <GlassCard className="mb-4">
          <div className="flex items-start gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-amber-300 mb-1">Entendimento da IA</div>
              <div className="text-sm text-foreground/90 italic">"{expansion.brief}"</div>
            </div>
          </div>

          {expansion.suggestions.length > 0 && (
            <div className="mb-3 text-xs text-muted-foreground space-y-1">
              {expansion.suggestions.map((s, i) => <div key={i}>💡 {s}</div>)}
            </div>
          )}

          {expansion.keywordVariants.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-primary mb-2 flex items-center gap-1"><Wand2 className="h-3.5 w-3.5" /> Tente estas variações (clique para buscar):</div>
              <div className="flex flex-wrap gap-2">
                {expansion.keywordVariants.map((kw) => (
                  <button key={kw} onClick={() => !loading && run(kw)} disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition disabled:opacity-50">
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(expansion.positiveTerms.length > 0 || expansion.negativeTerms.length > 0) && (
            <div className="mt-3 pt-3 border-t border-border/40 grid sm:grid-cols-2 gap-3 text-xs">
              {expansion.positiveTerms.length > 0 && (
                <div>
                  <div className="text-emerald-300 font-semibold mb-1">✓ Termos esperados</div>
                  <div className="text-muted-foreground line-clamp-2">{expansion.positiveTerms.join(" · ")}</div>
                </div>
              )}
              {expansion.negativeTerms.length > 0 && (
                <div>
                  <div className="text-rose-300 font-semibold mb-1">✗ Penalizados</div>
                  <div className="text-muted-foreground line-clamp-2">{expansion.negativeTerms.join(" · ")}</div>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}

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
                l.phase === 0 ? "text-amber-300" :
                l.phase === 1 ? "text-primary" :
                l.phase === 2 ? "text-cyan-300" :
                l.phase === 3 ? "text-purple-300" :
                l.phase === 4 ? "text-pink-300" :
                l.phase === 5 ? "text-orange-300" : "text-foreground"
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
              const relPct = g.relevance != null ? Math.round(g.relevance * 100) : null;
              const relCls = relPct == null ? "" : relPct >= 70 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : relPct >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-rose-500/15 text-rose-300 border-rose-500/30";
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
                      {g.reason && <div className="text-[10px] text-primary/80 italic mt-1 line-clamp-1">→ {g.reason}</div>}
                      <div className="text-[10px] font-mono text-muted-foreground mt-1 truncate">{g.url}</div>
                    </div>
                    {relPct != null && (
                      <Badge variant="outline" className={`shrink-0 ${relCls}`}>{relPct}%</Badge>
                    )}
                  </div>
                </motion.a>
              );
            })}
            {!loading && sorted.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {all.length > 0 ? `Nenhum grupo passa o filtro de ${minRelevance}% relevância. Baixe o slider.` : "Nenhum grupo ainda."}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
