import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, RefreshCw, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchGroups, extractMembers, getInstance } from "@/lib/whatsapp-mock";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/instancias/$id")({
  head: () => ({ meta: [{ title: "Detalhe da Instância — AgentZap" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const instance = useQuery({ queryKey: ["instance", id], queryFn: () => getInstance(id) });
  const groups = useQuery({
    queryKey: ["groups", id],
    queryFn: async () => (await supabase.from("whatsapp_groups").select("*").eq("instance_id", id).order("name")).data ?? [],
  });

  const refresh = useMutation({
    mutationFn: () => fetchGroups(id),
    onSuccess: () => { toast.success("Grupos atualizados"); qc.invalidateQueries({ queryKey: ["groups", id] }); },
  });
  const extract = useMutation({
    mutationFn: ({ gid, gname }: { gid: string; gname: string }) => extractMembers(gid, id, gname),
    onSuccess: (n) => { toast.success(`${n} membros extraídos`); qc.invalidateQueries({ queryKey: ["groups", id] }); },
  });

  const filtered = (groups.data ?? []).filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
      <PageHeader
        title={instance.data?.name ?? "Instância"}
        description={instance.data?.phone_number ?? "Sem número vinculado"}
        actions={
          <Button onClick={() => refresh.mutate()} disabled={refresh.isPending} className="gradient-primary text-white border-0">
            {refresh.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Buscar Grupos
          </Button>
        }
      />

      <Input placeholder="Buscar grupo…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((g) => (
          <GlassCard key={g.id} neonTop className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{g.name}</div>
              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="mr-1.5">{g.member_count} membros</Badge>
                {g.description && <span className="truncate">{g.description}</span>}
              </div>
            </div>
            <Button size="sm" onClick={() => extract.mutate({ gid: g.id, gname: g.name })} disabled={extract.isPending} className="gradient-primary text-white border-0">
              <Download className="h-3.5 w-3.5 mr-1" /> Extrair
            </Button>
          </GlassCard>
        ))}
        {filtered.length === 0 && <GlassCard className="md:col-span-2 text-center text-muted-foreground py-10">Nenhum grupo. Clique em "Buscar Grupos".</GlassCard>}
      </div>
    </div>
  );
}
