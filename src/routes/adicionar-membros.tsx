import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Target, Thermometer, UserPlus, Play, AlertTriangle, CheckCircle2, Loader2, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  searchLeads,
  listAdminGroups,
  updateGroupGoal,
  startAddJob,
  listJobs,
  getTodayAddedForGroup,
  riskFromCount,
  riskLabel,
  riskColor,
  type LeadFilters,
} from "@/lib/member-add-mock";

const STATES = ["SP","RJ","MG","PR","SC","RS","BA","CE","PE","DF","GO","ES","PA","AM"];

export const Route = createFileRoute("/adicionar-membros")({
  head: () => ({ meta: [{ title: "Adicionar Membros — AgentZap" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [instanceId, setInstanceId] = useState<string>("all");
  const [groupId, setGroupId] = useState<string>("");
  const [batchSize, setBatchSize] = useState(5);
  const [filters, setFilters] = useState<LeadFilters>({ gender: "all", limit: 200 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const instances = useQuery({
    queryKey: ["instances"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });
  const groups = useQuery({
    queryKey: ["admin-groups", instanceId],
    queryFn: () => listAdminGroups(instanceId === "all" ? undefined : instanceId),
  });
  const leads = useQuery({
    queryKey: ["leads-add", filters],
    queryFn: () => searchLeads(filters),
  });
  const jobs = useQuery({
    queryKey: ["add-jobs"],
    queryFn: () => listJobs(15),
    refetchInterval: 2500,
  });

  const selectedGroup = useMemo(
    () => (groups.data ?? []).find((g) => g.id === groupId),
    [groups.data, groupId],
  );

  const addedToday = useQuery({
    queryKey: ["added-today", groupId],
    queryFn: () => (groupId ? getTodayAddedForGroup(groupId) : Promise.resolve(0)),
    enabled: !!groupId,
    refetchInterval: 2500,
  });

  const projectedTotal = (addedToday.data ?? 0) + batchSize;
  const risk = riskFromCount(projectedTotal);

  const setGoal = useMutation({
    mutationFn: (goal: number) => updateGroupGoal(groupId, goal),
    onSuccess: () => { toast.success("Meta atualizada"); qc.invalidateQueries({ queryKey: ["admin-groups"] }); },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!selectedGroup) throw new Error("Selecione um grupo");
      const picked = (leads.data ?? []).filter((l) => selectedIds.has(l.id)).slice(0, batchSize);
      if (picked.length === 0) throw new Error("Selecione ao menos 1 lead");
      return startAddJob({
        instanceId: selectedGroup.instance_id,
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        leadIds: picked.map((l) => l.id),
        phones: picked.map((l) => l.phone_number),
      });
    },
    onSuccess: () => {
      toast.success("Job iniciado! Acompanhe abaixo.");
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["add-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectFirstN = (n: number) => setSelectedIds(new Set((leads.data ?? []).slice(0, n).map((l) => l.id)));

  return (
    <div>
      <PageHeader
        title="Adição em Massa de Membros"
        description="Adicione leads automaticamente em grupos onde sua instância é admin, com termômetro de risco anti-ban."
        actions={
          <Button asChild variant="outline">
            <Link to="/leads"><Users className="h-4 w-4 mr-2" /> Banco de Leads</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Coluna 1-2: Configuração */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard neonTop>
            <div className="mb-3 flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-primary" /> 1. Grupo de destino</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">Instância</label>
                <Select value={instanceId} onValueChange={(v) => { setInstanceId(v); setGroupId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as instâncias</SelectItem>
                    {(instances.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">Grupo (apenas onde você é admin)</label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {(groups.data ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name} · {g.member_count} membros</SelectItem>
                    ))}
                    {(groups.data ?? []).length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum grupo onde você é admin. Vá em uma instância e marque os grupos.</div>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedGroup && (
              <div className="mt-4 rounded-lg border border-border/50 bg-card/40 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Meta de membros do grupo</div>
                  <Badge variant="outline">{selectedGroup.member_count} / {selectedGroup.member_goal ?? "—"}</Badge>
                </div>
                <Progress value={selectedGroup.member_goal ? (selectedGroup.member_count / selectedGroup.member_goal) * 100 : 0} className="mb-2" />
                <div className="flex items-center gap-2">
                  <Input type="number" className="max-w-[140px]" placeholder="Ex: 500" defaultValue={selectedGroup.member_goal ?? ""}
                    onBlur={(e) => { const v = +e.target.value; if (v && v !== selectedGroup.member_goal) setGoal.mutate(v); }} />
                  <span className="text-xs text-muted-foreground">membros como meta</span>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Termômetro */}
          {selectedGroup && (
            <GlassCard className={`border ${riskColor(risk)}`}>
              <div className="mb-3 flex items-center gap-2 font-semibold"><Thermometer className="h-4 w-4" /> 2. Termômetro Anti-Ban</div>
              <div className="grid gap-3 md:grid-cols-3 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Adicionados hoje</div>
                  <div className="text-2xl font-bold">{addedToday.data ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Nesta rodada</div>
                  <div className="text-2xl font-bold">+{batchSize}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total projetado</div>
                  <div className="text-2xl font-bold">{projectedTotal}</div>
                </div>
              </div>
              <div className="mt-3">
                <Slider value={[batchSize]} min={1} max={30} step={1} onValueChange={(v) => setBatchSize(v[0])} />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span><span className="text-emerald-400">5 (seguro)</span><span className="text-amber-300">15</span><span className="text-rose-400">30</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                {risk === "red" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <span className="font-semibold">{riskLabel(risk)}</span>
                <span className="text-xs text-muted-foreground">— pausa randômica 60-180s entre adds em produção</span>
              </div>
            </GlassCard>
          )}

          {/* Leads */}
          <GlassCard>
            <div className="mb-3 flex items-center gap-2 font-semibold"><Search className="h-4 w-4 text-primary" /> 3. Buscar e selecionar leads</div>
            <div className="grid gap-2 md:grid-cols-5 mb-3">
              <Select value={filters.gender} onValueChange={(v) => setFilters((f) => ({ ...f, gender: v as "M" | "F" | "all" }))}>
                <SelectTrigger><SelectValue placeholder="Gênero" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os gêneros</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.state ?? "all"} onValueChange={(v) => setFilters((f) => ({ ...f, state: v === "all" ? undefined : v }))}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos UFs</SelectItem>
                  {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Cidade" value={filters.city ?? ""} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined }))} />
              <Input type="number" placeholder="Idade min" value={filters.ageMin ?? ""} onChange={(e) => setFilters((f) => ({ ...f, ageMin: e.target.value ? +e.target.value : undefined }))} />
              <Input type="number" placeholder="Idade max" value={filters.ageMax ?? ""} onChange={(e) => setFilters((f) => ({ ...f, ageMax: e.target.value ? +e.target.value : undefined }))} />
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{leads.data?.length ?? 0} encontrados</Badge>
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">{selectedIds.size} selecionados</Badge>
              <Button size="sm" variant="outline" onClick={() => selectFirstN(batchSize)}>Selecionar primeiros {batchSize}</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-md border border-border/50 divide-y divide-border/30">
              {(leads.data ?? []).map((l) => (
                <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-card/40 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggle(l.id)} className="accent-primary" />
                  <span className="font-mono text-emerald-400 w-36">{l.phone_number}</span>
                  <span className="flex-1 truncate">{l.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{l.gender} · {l.state} · {l.city} · {l.age}a</span>
                </label>
              ))}
              {(leads.data ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum lead com esses filtros.</div>}
            </div>

            <Button
              className="mt-4 w-full gradient-primary text-white border-0"
              disabled={!selectedGroup || selectedIds.size === 0 || start.isPending}
              onClick={() => start.mutate()}
            >
              {start.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Adicionar {Math.min(selectedIds.size, batchSize)} membros agora
            </Button>
          </GlassCard>
        </div>

        {/* Coluna 3: Jobs */}
        <div>
          <GlassCard neonTop>
            <div className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-primary" /> Jobs recentes</div>
            <div className="space-y-3 max-h-[640px] overflow-auto">
              {(jobs.data ?? []).map((j) => {
                const pct = j.target_count ? ((j.added_count + j.failed_count) / j.target_count) * 100 : 0;
                return (
                  <div key={j.id} className="rounded-lg border border-border/50 bg-card/40 p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate">{j.group_name}</span>
                      <Badge variant="outline" className={riskColor(j.risk_level as "green" | "yellow" | "red")}>{j.risk_level}</Badge>
                    </div>
                    <div className="text-muted-foreground mb-1">{j.added_count}✓ · {j.failed_count}✗ / {j.target_count}</div>
                    <Progress value={pct} className="h-1.5 mb-1" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{j.status}</span>
                      <span>{new Date(j.created_at).toLocaleTimeString("pt-BR")}</span>
                    </div>
                  </div>
                );
              })}
              {(jobs.data ?? []).length === 0 && <div className="text-center text-xs text-muted-foreground py-6">Nenhum job ainda.</div>}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
