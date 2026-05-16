import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, CalendarDays, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas — AgentZap" }, { name: "description", content: "Campanhas de envio em massa." }] }),
  component: Page,
});

function statusBadge(s: string) {
  const map: Record<string, string> = {
    draft: "bg-muted/30 text-muted-foreground",
    scheduled: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    running: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse",
    completed: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  };
  return <Badge variant="outline" className={map[s] ?? map.draft}>{s}</Badge>;
}

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", instanceId: "", message: "", numbers: "", scheduledAt: "", intervalSeconds: 5 });

  const instances = useQuery({
    queryKey: ["instances-all"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });
  const campaigns = useQuery({
    queryKey: ["campaigns"],
    refetchInterval: 6000,
    queryFn: async () => (await supabase.from("campaigns").select("*, whatsapp_instances(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const nums = form.numbers.split("\n").map((n) => n.trim()).filter(Boolean);
      const { error } = await supabase.from("campaigns").insert({
        name: form.name, instance_id: form.instanceId || null, message: form.message,
        numbers: nums, total_numbers: nums.length, interval_seconds: form.intervalSeconds,
        scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        status: form.scheduledAt ? "scheduled" : "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Campanha criada"); setOpen(false); setForm({ name: "", instanceId: "", message: "", numbers: "", scheduledAt: "", intervalSeconds: 5 }); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (id: string) => {
      const c = campaigns.data?.find((x) => x.id === id);
      if (!c) return;
      await supabase.from("campaigns").update({ status: "running" }).eq("id", id);
      setTimeout(async () => {
        const sent = Math.floor(c.total_numbers * (0.85 + Math.random() * 0.13));
        await supabase.from("campaigns").update({ status: "completed", sent_count: sent, failed_count: c.total_numbers - sent }).eq("id", id);
        qc.invalidateQueries({ queryKey: ["campaigns"] });
      }, 4000);
    },
    onSuccess: () => { toast.info("Envio simulado iniciado"); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("campaigns").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
  });

  return (
    <div>
      <PageHeader title="Campanhas" description="Crie campanhas de envio em massa com agendamento."
        actions={<Button onClick={() => setOpen(true)} className="gradient-primary text-white border-0"><Plus className="mr-2 h-4 w-4" /> Nova Campanha</Button>} />

      <div className="grid gap-3">
        {campaigns.data?.map((c) => {
          const name = (c.whatsapp_instances as { name?: string } | null)?.name ?? "—";
          return (
            <GlassCard key={c.id} neonTop className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2"><span className="font-semibold">{c.name}</span> {statusBadge(c.status)}</div>
                <div className="text-xs text-muted-foreground mt-1">{name} · {c.total_numbers} números · enviadas {c.sent_count}/{c.total_numbers} · falhas {c.failed_count}</div>
                {c.scheduled_at && <div className="text-xs text-amber-300 mt-0.5 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(c.scheduled_at).toLocaleString("pt-BR")}</div>}
                <div className="text-xs text-muted-foreground mt-2 italic line-clamp-2">"{c.message}"</div>
              </div>
              <div className="flex gap-2">
                {(c.status === "draft" || c.status === "scheduled") && (
                  <Button size="sm" onClick={() => send.mutate(c.id)} className="gradient-primary text-white border-0"><Send className="h-3.5 w-3.5 mr-1" /> Enviar</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)} className="text-rose-400"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </GlassCard>
          );
        })}
        {campaigns.data?.length === 0 && <GlassCard className="text-center text-muted-foreground py-10">Nenhuma campanha ainda.</GlassCard>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-primary/30 max-w-lg">
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input className="mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Instância</Label>
              <Select value={form.instanceId} onValueChange={(v) => setForm({ ...form, instanceId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{instances.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mensagem</Label><Textarea className="mt-1.5 min-h-[100px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <div><Label>Números (um por linha)</Label><Textarea className="mt-1.5 font-mono min-h-[80px]" value={form.numbers} onChange={(e) => setForm({ ...form, numbers: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agendar (opcional)</Label><Input className="mt-1.5" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
              <div><Label>Intervalo (s)</Label><Input className="mt-1.5" type="number" min={1} max={300} value={form.intervalSeconds} onChange={(e) => setForm({ ...form, intervalSeconds: +e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.name || !form.message} className="gradient-primary text-white border-0">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
