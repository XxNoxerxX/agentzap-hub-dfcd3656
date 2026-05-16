import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Filter as FilterIcon, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { filterNumbers } from "@/lib/whatsapp-mock";
import { GlassCard } from "@/components/glass-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/filtro-numeros")({
  head: () => ({ meta: [{ title: "Filtro de Números — AgentZap" }, { name: "description", content: "Validar números no WhatsApp." }] }),
  component: Page,
});

function Page() {
  const [numbers, setNumbers] = useState("");
  const [instanceId, setInstanceId] = useState<string>("");
  const [result, setResult] = useState<{ valid: string[]; invalid: string[] } | null>(null);

  const instances = useQuery({
    queryKey: ["instances-all"],
    queryFn: async () => (await supabase.from("whatsapp_instances").select("id,name")).data ?? [],
  });

  const run = useMutation({
    mutationFn: () => filterNumbers(instanceId || null, numbers.split("\n")),
    onSuccess: (r) => { setResult(r); toast.success(`${r.valid.length} válidos · ${r.invalid.length} inválidos`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Filtro de Números" description="Cole uma lista de números e verifique quais existem no WhatsApp." />
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-center gap-2 mb-4 font-semibold"><FilterIcon className="h-5 w-5 text-primary" /> Entrada</div>
          <div className="space-y-3">
            <div>
              <Label>Instância (opcional)</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Qualquer instância" /></SelectTrigger>
                <SelectContent>{instances.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Números (um por linha)</Label>
              <Textarea
                className="mt-1.5 font-mono min-h-[220px]"
                placeholder={"+5511999999999\n+5521988888888\n…"}
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
              />
            </div>
            <Button onClick={() => run.mutate()} disabled={!numbers.trim() || run.isPending} className="w-full gradient-primary text-white border-0">
              {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilterIcon className="mr-2 h-4 w-4" />}
              Validar
            </Button>
          </div>
        </GlassCard>

        <GlassCard neonTop>
          <div className="font-semibold mb-4">Resultados</div>
          {!result && <div className="text-center text-muted-foreground py-12 text-sm">Sem resultados ainda.</div>}
          {result && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Badge className="mb-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30" variant="outline"><Check className="h-3 w-3 mr-1" /> Válidos ({result.valid.length})</Badge>
                <div className="max-h-[360px] overflow-y-auto space-y-1 font-mono text-xs">
                  {result.valid.map((n, i) => <div key={i} className="text-emerald-400 truncate">{n}</div>)}
                </div>
              </div>
              <div>
                <Badge className="mb-2 bg-rose-500/15 text-rose-300 border-rose-500/30" variant="outline"><X className="h-3 w-3 mr-1" /> Inválidos ({result.invalid.length})</Badge>
                <div className="max-h-[360px] overflow-y-auto space-y-1 font-mono text-xs">
                  {result.invalid.map((n, i) => <div key={i} className="text-rose-400 truncate">{n}</div>)}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
