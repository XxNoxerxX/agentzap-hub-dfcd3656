import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History as HistoryIcon, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadFile, toCSV } from "@/lib/download";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — AgentZap" }, { name: "description", content: "Histórico de extrações de membros." }] }),
  component: Page,
});

function Page() {
  const history = useQuery({
    queryKey: ["history"],
    refetchInterval: 8000,
    queryFn: async () => (await supabase.from("extraction_history").select("*, whatsapp_instances(name)").order("extracted_at", { ascending: false }).limit(500)).data ?? [],
  });

  const exportGroup = async (groupId: string | null, groupName: string) => {
    if (!groupId) { toast.error("Grupo não disponível"); return; }
    const { data } = await supabase.from("group_members").select("phone_number,push_name,is_admin,is_lid").eq("group_id", groupId);
    if (!data?.length) { toast.error("Sem membros"); return; }
    downloadFile(`${groupName.replace(/[^a-z0-9]/gi, "_")}.csv`, toCSV(data), "text/csv");
    toast.success("CSV gerado");
  };

  return (
    <div>
      <PageHeader title="Histórico" description="Log de todas as extrações realizadas." actions={
        <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary gap-1.5"><HistoryIcon className="h-3 w-3" /> {history.data?.length ?? 0}</Badge>
      } />

      <GlassCard neonTop className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instância</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead className="text-right">Membros</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data?.map((h) => {
              const inst = (h.whatsapp_instances as { name?: string } | null)?.name ?? "—";
              return (
                <TableRow key={h.id}>
                  <TableCell>{inst}</TableCell>
                  <TableCell className="font-medium">{h.group_name}</TableCell>
                  <TableCell className="text-right font-mono">{h.member_count}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">{h.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(h.extracted_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => exportGroup(h.group_id, h.group_name)}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {history.data?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma extração ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </GlassCard>
    </div>
  );
}
