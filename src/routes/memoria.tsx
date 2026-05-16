import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pin, PinOff, Trash2, Brain } from "lucide-react";
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

export const Route = createFileRoute("/memoria")({
  head: () => ({ meta: [{ title: "Memória — AgentZap" }, { name: "description", content: "Notas persistentes do AgentZap." }] }),
  component: Page,
});

const COLORS = ["#a855f7", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const CATEGORIES = [
  { v: "geral", label: "Geral" },
  { v: "contatos", label: "Contatos" },
  { v: "estrategias", label: "Estratégias" },
  { v: "lembretes", label: "Lembretes" },
];

function Page() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", content: "", category: "geral", color: COLORS[0] });

  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: async () => (await supabase.from("memory_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("memory_notes").insert(form); if (error) throw error; },
    onSuccess: () => { toast.success("Nota criada"); setOpen(false); setForm({ title: "", content: "", category: "geral", color: COLORS[0] }); qc.invalidateQueries({ queryKey: ["notes"] }); },
  });
  const pin = useMutation({
    mutationFn: async ({ id, p }: { id: string; p: boolean }) => { await supabase.from("memory_notes").update({ is_pinned: p }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("memory_notes").delete().eq("id", id); },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["notes"] }); },
  });

  const filtered = (notes.data ?? []).filter((n) => filter === "all" || n.category === filter);

  return (
    <div>
      <PageHeader title="Memória" description="Notas persistentes — estratégias, contatos, lembretes." actions={
        <Button onClick={() => setOpen(true)} className="gradient-primary text-white border-0"><Plus className="mr-2 h-4 w-4" /> Nova Nota</Button>
      } />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="outline" className={`cursor-pointer ${filter === "all" ? "bg-primary/20 text-primary border-primary/40" : ""}`} onClick={() => setFilter("all")}>Todas</Badge>
        {CATEGORIES.map((c) => (
          <Badge key={c.v} variant="outline" className={`cursor-pointer ${filter === c.v ? "bg-primary/20 text-primary border-primary/40" : ""}`} onClick={() => setFilter(c.v)}>{c.label}</Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((n) => (
          <GlassCard key={n.id} className="relative" style={{ borderColor: `${n.color}55`, boxShadow: n.is_pinned ? `0 0 18px ${n.color}55` : undefined }}>
            <div className="absolute top-3 right-3 flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => pin.mutate({ id: n.id, p: !n.is_pinned })}>
                {n.is_pinned ? <Pin className="h-3.5 w-3.5 text-primary" /> : <PinOff className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-400" onClick={() => del.mutate(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-2 mb-2 pr-16">
              <Brain className="h-4 w-4" style={{ color: n.color }} />
              <span className="font-semibold truncate">{n.title}</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{n.content}</p>
            <Badge variant="outline" className="mt-3 text-[10px]" style={{ borderColor: `${n.color}55`, color: n.color }}>{n.category}</Badge>
          </GlassCard>
        ))}
        {filtered.length === 0 && <GlassCard className="sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center text-muted-foreground py-10">Nenhuma nota nesta categoria.</GlassCard>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-primary/30">
          <DialogHeader><DialogTitle>Nova Nota</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input className="mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Conteúdo</Label><Textarea className="mt-1.5 min-h-[140px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <div className="mt-1.5 flex gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`h-8 w-8 rounded-full ring-2 ${form.color === c ? "ring-white" : "ring-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={!form.title.trim()} className="gradient-primary text-white border-0">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
