import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, FileText, FileJson, Filter as FilterIcon, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detectCountry } from "@/lib/country-codes";
import { copyToClipboard, downloadFile, toCSV } from "@/lib/download";

export const Route = createFileRoute("/membros")({
  head: () => ({
    meta: [
      { title: "Membros Extraídos — AgentZap" },
      { name: "description", content: "Todos os membros extraídos de grupos WhatsApp." },
    ],
  }),
  component: MembrosPage,
});

function MembrosPage() {
  const [search, setSearch] = useState("");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const instances = useQuery({
    queryKey: ["instances-all"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });
  const groups = useQuery({
    queryKey: ["groups-all"],
    queryFn: async () => (await supabase.from("whatsapp_groups").select("id,name,instance_id")).data ?? [],
  });
  const members = useQuery({
    queryKey: ["members"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("*, whatsapp_groups(name,instance_id), whatsapp_instances(name)")
        .order("extracted_at", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const list = members.data ?? [];
    return list.filter((m) => {
      if (instanceFilter !== "all" && m.instance_id !== instanceFilter) return false;
      if (groupFilter !== "all" && m.group_id !== groupFilter) return false;
      if (search && !`${m.phone_number} ${m.push_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [members.data, instanceFilter, groupFilter, search]);

  const exportRows = filtered.map((m) => {
    const c = detectCountry(m.phone_number);
    const grp = (m.whatsapp_groups as { name?: string } | null)?.name ?? "";
    return { telefone: m.phone_number, nome: m.push_name ?? "", pais: c.name, grupo: grp, admin: m.is_admin ? "sim" : "não", lid: m.is_lid ? "sim" : "não", extraido_em: m.extracted_at };
  });

  return (
    <div>
      <PageHeader
        title="Membros Extraídos"
        description="Todos os contatos extraídos de grupos do WhatsApp com identificação de país."
        actions={
          <>
            <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1.5"><Users className="h-3 w-3" /> {filtered.length} membros</Badge>
            <Button variant="outline" onClick={() => members.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button>
          </>
        }
      />

      <GlassCard className="mb-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FilterIcon className="h-4 w-4 text-primary" /> Filtros</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Buscar</label>
            <Input placeholder="Nome ou telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Instância</label>
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {instances.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Grupo</label>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {groups.data?.filter((g) => instanceFilter === "all" || g.instance_id === instanceFilter).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={async () => { await copyToClipboard(filtered.map((m) => m.phone_number).join("\n")); toast.success("Números copiados"); }}>
          <Copy className="mr-2 h-4 w-4" /> Copiar Todos os Números
        </Button>
        <Button variant="outline" onClick={() => { downloadFile("membros.csv", toCSV(exportRows), "text/csv"); toast.success("CSV gerado"); }}>
          <FileText className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => { downloadFile("membros.json", JSON.stringify(exportRows, null, 2), "application/json"); toast.success("JSON gerado"); }}>
          <FileJson className="mr-2 h-4 w-4" /> Exportar JSON
        </Button>
      </div>

      <GlassCard neonTop className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Extraído Em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m, i) => {
              const c = detectCountry(m.phone_number);
              const grp = (m.whatsapp_groups as { name?: string } | null)?.name ?? "—";
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-emerald-400">{m.phone_number}{m.is_lid && <Badge className="ml-2 bg-cyan-500/15 text-cyan-300 border-cyan-500/30" variant="outline">LID</Badge>}</TableCell>
                  <TableCell className="italic text-muted-foreground">{m.push_name ?? "Sem nome"}</TableCell>
                  <TableCell><span className="mr-1.5">{c.flag}</span><span className="text-muted-foreground">{c.code}</span> {c.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{grp}</TableCell>
                  <TableCell>{m.is_admin ? <Badge className="bg-primary/20 text-primary border-primary/30" variant="outline">Admin</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(m.extracted_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum membro extraído ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}
