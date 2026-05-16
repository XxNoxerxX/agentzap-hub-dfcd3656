import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/aquecimento")({
  head: () => ({ meta: [{ title: "Aquecimento — AgentZap" }, { name: "description", content: "Aquecimento de números WhatsApp." }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [instanceId, setInstanceId] = useState<string>("");
  const [perDay, setPerDay] = useState(20);
  const [totalDays, setTotalDays] = useState(7);

  const instances = useQuery({
    queryKey: ["instances-all"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });
  const warmers = useQuery({
    queryKey: ["warmers"],
    refetchInterval: 5000,
    queryFn: async () => (await supabase.from("number_warmers").select("*, whatsapp_instances(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!instanceId) throw new Error("Selecione uma instância");
      const { error } = await supabase.from("number_warmers").insert({
        instance_id: instanceId, status: "running", messages_per_day: perDay, total_days: totalDays,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Aquecimento iniciado (modo demo)"); qc.invalidateQueries({ queryKey: ["warmers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stop = useMutation({
    mutationFn: async (id: string) => { await supabase.from("number_warmers").update({ status: "stopped" }).eq("id", id); },
    onSuccess: () => { toast.success("Aquecimento parado"); qc.invalidateQueries({ queryKey: ["warmers"] }); },
  });

  return (
    <div>
      <PageHeader title="Aquecimento" description="Aqueça números novos enviando mensagens gradualmente." />
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4 font-semibold"><Flame className="h-5 w-5 text-accent" /> Novo aquecimento</div>
          <div className="space-y-3">
            <div>
              <Label>Instância</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{instances.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mensagens/dia</Label>
                <Input className="mt-1.5" type="number" min={1} max={500} value={perDay} onChange={(e) => setPerDay(+e.target.value)} />
              </div>
              <div>
                <Label>Total de dias</Label>
                <Input className="mt-1.5" type="number" min={1} max={90} value={totalDays} onChange={(e) => setTotalDays(+e.target.value)} />
              </div>
            </div>
            <Button onClick={() => start.mutate()} disabled={!instanceId || start.isPending} className="w-full gradient-primary text-white border-0 hover:opacity-90">
              <Play className="mr-2 h-4 w-4" /> Iniciar
            </Button>
          </div>
        </GlassCard>

        <GlassCard neonTop className="lg:col-span-2">
          <div className="font-semibold mb-4">Histórico</div>
          <div className="space-y-3">
            {warmers.data?.map((w) => {
              const progress = (w.messages_sent / Math.max(1, w.messages_per_day * w.total_days)) * 100;
              const name = (w.whatsapp_instances as { name?: string } | null)?.name ?? "—";
              return (
                <div key={w.id} className="rounded-lg border border-border/40 bg-card/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-muted-foreground">{w.messages_per_day} msgs/dia · {w.total_days} dias · enviadas {w.messages_sent}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={w.status === "running" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-muted/30"}>{w.status}</Badge>
                      {w.status === "running" && <Button size="sm" variant="ghost" onClick={() => stop.mutate(w.id)}><Square className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                  <Progress value={progress} />
                </div>
              );
            })}
            {warmers.data?.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">Nenhum aquecimento ainda.</div>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
