import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, FolderOpen, Users, Download, Plus, RefreshCw, Trash2, QrCode, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createInstance, listInstances, deleteInstance, connectInstance, disconnectInstance,
} from "@/lib/whatsapp-mock";
import { StatCard } from "@/components/stat-card";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AgentZap" },
      { name: "description", content: "Visão geral das instâncias WhatsApp, grupos e membros extraídos." },
    ],
  }),
  component: Dashboard,
});

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    connected:   { label: "Conectado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    connecting:  { label: "Conectando", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse" },
    qr_ready:    { label: "QR Pronto", cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
    disconnected:{ label: "Desconectado", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  };
  const s = map[status] ?? map.disconnected;
  return <Badge variant="outline" className={`gap-1.5 ${s.cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{s.label}</Badge>;
}

function Dashboard() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [qrFor, setQrFor] = useState<{ id: string; qr: string } | null>(null);

  const instances = useQuery({ queryKey: ["instances"], queryFn: listInstances, refetchInterval: 3000 });
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    refetchInterval: 5000,
    queryFn: async () => {
      const [inst, grp, mem, ext] = await Promise.all([
        supabase.from("whatsapp_instances").select("id", { count: "exact", head: true }),
        supabase.from("whatsapp_groups").select("id", { count: "exact", head: true }),
        supabase.from("group_members").select("id", { count: "exact", head: true }),
        supabase.from("extraction_history").select("id", { count: "exact", head: true }),
      ]);
      return { inst: inst.count ?? 0, grp: grp.count ?? 0, mem: mem.count ?? 0, ext: ext.count ?? 0 };
    },
  });

  const create = useMutation({
    mutationFn: () => createInstance(newName.trim()),
    onSuccess: () => { toast.success("Instância criada"); setNewName(""); setNewOpen(false); qc.invalidateQueries({ queryKey: ["instances"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const connect = useMutation({
    mutationFn: (id: string) => connectInstance(id),
    onSuccess: (res, id) => { setQrFor({ id, qr: res.qr }); toast.info("Modo demo: conexão simulada em ~8s"); qc.invalidateQueries({ queryKey: ["instances"] }); },
  });
  const disconnect = useMutation({
    mutationFn: ({ id, logout }: { id: string; logout: boolean }) => disconnectInstance(id, logout),
    onSuccess: () => { toast.success("Instância desconectada"); qc.invalidateQueries({ queryKey: ["instances"] }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteInstance(id),
    onSuccess: () => { toast.success("Instância removida"); qc.invalidateQueries({ queryKey: ["instances"] }); },
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Gerencie suas instâncias WhatsApp e extraia dados de grupos."
        actions={
          <>
            <Button variant="outline" onClick={() => { qc.invalidateQueries({ queryKey: ["instances"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button onClick={() => setNewOpen(true)} className="gradient-primary text-white hover:opacity-90 border-0">
              <Plus className="mr-2 h-4 w-4" /> Nova Instância
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Instâncias" value={stats.data?.inst ?? 0} icon={Smartphone} tint="primary" />
        <StatCard label="Grupos" value={stats.data?.grp ?? 0} icon={FolderOpen} tint="accent" />
        <StatCard label="Membros" value={stats.data?.mem ?? 0} icon={Users} tint="cyan" />
        <StatCard label="Extrações" value={stats.data?.ext ?? 0} icon={Download} tint="primary" />
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Instâncias WhatsApp</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {instances.data?.map((inst) => (
            <motion.div key={inst.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassCard neonTop className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold leading-tight">{inst.name}</div>
                      <div className="text-xs text-muted-foreground">{inst.phone_number ?? "Nenhum número vinculado"}</div>
                    </div>
                  </div>
                  {statusBadge(inst.status)}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {inst.status === "connected" ? (
                    <Button size="sm" variant="outline" onClick={() => disconnect.mutate({ id: inst.id, logout: false })}>
                      <Power className="mr-1.5 h-3.5 w-3.5" /> Desconectar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 gradient-primary text-white border-0 hover:opacity-90"
                      onClick={() => connect.mutate(inst.id)}
                    >
                      <QrCode className="mr-1.5 h-3.5 w-3.5" /> {inst.status === "qr_ready" ? "Ver QR" : "Conectar"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10" onClick={() => del.mutate(inst.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>

        {instances.data?.length === 0 && (
          <GlassCard className="md:col-span-2 xl:col-span-3 text-center text-muted-foreground py-12">
            Nenhuma instância ainda. Clique em <strong className="text-foreground">Nova Instância</strong> para começar.
          </GlassCard>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="glass-strong border-primary/30">
          <DialogHeader>
            <DialogTitle>Nova Instância WhatsApp</DialogTitle>
            <DialogDescription>Dê um nome para identificá-la.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Ex: Vendas SP" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button disabled={!newName.trim() || create.isPending} onClick={() => create.mutate()} className="gradient-primary text-white border-0">
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="glass-strong border-primary/30 max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
            <DialogDescription>Modo demo — conexão será simulada em alguns segundos.</DialogDescription>
          </DialogHeader>
          {qrFor && (
            <div className="flex items-center justify-center rounded-xl bg-white p-3">
              <img src={qrFor.qr} alt="QR Code" className="h-64 w-64" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
