import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Users, Filter as FilterIcon, Search, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { searchLeads, type LeadFilters } from "@/lib/member-add-mock";
import { copyToClipboard } from "@/lib/download";

const STATES = ["SP","RJ","MG","PR","SC","RS","BA","CE","PE","DF","GO","ES","PA","AM"];

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — AgentZap" }] }),
  component: LeadsPage,
});

function LeadsPage() {
  const [filters, setFilters] = useState<LeadFilters>({ gender: "all", limit: 500 });
  const [search, setSearch] = useState("");

  const leads = useQuery({
    queryKey: ["leads", filters, search],
    queryFn: () => searchLeads({ ...filters, search: search || undefined }),
  });

  const update = <K extends keyof LeadFilters>(k: K, v: LeadFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Banco de Leads"
        description="Busque potenciais membros por gênero, estado, cidade e idade. Use para alimentar campanhas de adição em grupos."
        actions={
          <>
            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1.5">
              <Users className="h-3 w-3" /> {leads.data?.length ?? 0} leads
            </Badge>
            <Button asChild className="gradient-primary text-white border-0">
              <Link to="/adicionar-membros"><UserPlus className="h-4 w-4 mr-2" /> Adicionar em Grupos</Link>
            </Button>
          </>
        }
      />

      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FilterIcon className="h-4 w-4 text-primary" /> Filtros de Segmentação
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs text-muted-foreground">Buscar nome / telefone</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ana, +5511..." />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Gênero</label>
            <Select value={filters.gender} onValueChange={(v) => update("gender", v as "M" | "F" | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Estado</label>
            <Select value={filters.state ?? "all"} onValueChange={(v) => update("state", v === "all" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Cidade</label>
            <Input value={filters.city ?? ""} onChange={(e) => update("city", e.target.value || undefined)} placeholder="São Paulo" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Idade</label>
            <div className="flex items-center gap-1">
              <Input type="number" min={13} max={99} placeholder="Min" value={filters.ageMin ?? ""} onChange={(e) => update("ageMin", e.target.value ? +e.target.value : undefined)} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" min={13} max={99} placeholder="Max" value={filters.ageMax ?? ""} onChange={(e) => update("ageMax", e.target.value ? +e.target.value : undefined)} />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={async () => { await copyToClipboard((leads.data ?? []).map((l) => l.phone_number).join("\n")); toast.success("Telefones copiados"); }}>
          <Copy className="h-4 w-4 mr-2" /> Copiar telefones filtrados
        </Button>
      </div>

      <GlassCard neonTop className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Telefone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Gênero</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leads.data ?? []).map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-emerald-400">{l.phone_number}</TableCell>
                <TableCell>{l.name ?? "—"}</TableCell>
                <TableCell>
                  {l.gender === "F" ? <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30" variant="outline">F</Badge>
                    : l.gender === "M" ? <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30" variant="outline">M</Badge>
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{l.state ?? "—"}</TableCell>
                <TableCell>{l.city ?? "—"}</TableCell>
                <TableCell>{l.age ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(l.tags ?? []).join(", ")}</TableCell>
              </TableRow>
            ))}
            {(leads.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum lead encontrado com esses filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      <GlassCard className="mt-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Fontes futuras de leads:</strong> dorks de Google/Brave por demografia, sua API própria (em breve),
        importação CSV, extração automática de grupos já mapeados. Hoje está em modo demo com 60 leads de exemplo.
      </GlassCard>
    </div>
  );
}
