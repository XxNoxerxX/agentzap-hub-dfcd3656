import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/auto-resposta")({
  head: () => ({ meta: [{ title: "Auto-Resposta — AgentZap" }, { name: "description", content: "Regras de auto-resposta para WhatsApp." }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ instanceId: "", trigger: "", response: "", matchType: "contains" });

  const instances = useQuery({
    queryKey: ["instances-all"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });
  const rules = useQuery({
    queryKey: ["rules"],
    refetchInterval: 6000,
    queryFn: async () => (await supabase.from("auto_reply_rules").select("*, whatsapp_instances(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("auto_reply_rules").insert({
        instance_id: form.instanceId || null, trigger: form.trigger, response: form.response, match_type: form.matchType,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regra criada"); setOpen(false); setForm({ instanceId: "", trigger: "", response: "", matchType: "contains" }); qc.invalidateQueries({ queryKey: ["rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { await supabase.from("auto_reply_rules").update({ is_active: active }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("auto_reply_rules").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["rules"] }); },
  });

  return (
    <div>
      <PageHeader title="Auto-Resposta" description="Crie regras para responder mensagens automaticamente."
        actions={<Button onClick={() => setOpen(true)} className="gradient-primary text-white border-0"><Plus className="mr-2 h-4 w-4" /> Nova Regra</Button>} />

      <div className="grid gap-3 lg:grid-cols-2">
        {rules.data?.map((r) => {
          const name = (r.whatsapp_instances as { name?: string } | null)?.name ?? "Qualquer";
          return (
            <GlassCard key={r.id} neonTop>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{r.trigger}</span>
                    <Badge variant="outline" className="bg-muted/30">{r.match_type}</Badge>
                    <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30">{r.times_triggered} disparos</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Instância: {name}</div>
                  <div className="mt-2 rounded-md bg-card/60 border border-border/40 p-2 text-sm italic">"{r.response}"</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, active: v })} />
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)} className="text-rose-400"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </GlassCard>
          );
        })}
        {rules.data?.length === 0 && <GlassCard className="lg:col-span-2 text-center text-muted-foreground py-10">Nenhuma regra ainda.</GlassCard>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-primary/30">
          <DialogHeader><DialogTitle>Nova Regra de Auto-Resposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Instância (opcional)</Label>
              <Select value={form.instanceId} onValueChange={(v) => setForm({ ...form, instanceId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Qualquer instância" /></SelectTrigger>
                <SelectContent>{instances.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Gatilho</Label><Input className="mt-1.5" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="Ex: oi, preço, horário" /></div>
            <div><Label>Resposta</Label><Textarea className="mt-1.5" value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} /></div>
            <div>
              <Label>Tipo de match</Label>
              <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.trigger || !form.response} className="gradient-primary text-white border-0">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
