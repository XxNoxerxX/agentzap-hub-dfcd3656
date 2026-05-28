import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Server, KeyRound, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBackendConfig, setBackendConfig, clearBackendConfig, pingBackend,
} from "@/lib/api-client";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — AgentZap" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    const c = getBackendConfig();
    setUrl(c.url);
    setToken(c.token);
  }, []);

  async function test() {
    setTesting(true);
    setResult("idle");
    try {
      if (!url) throw new Error("Informe a URL do backend");
      await pingBackend(url);
      setResult("ok");
      toast.success("Backend online!");
    } catch (e: any) {
      setResult("fail");
      toast.error(`Falhou: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  function save() {
    if (!url || !token) { toast.error("Preencha URL e Token"); return; }
    setBackendConfig(url, token);
    toast.success("Configuração salva");
  }

  function clear() {
    clearBackendConfig();
    setUrl(""); setToken(""); setResult("idle");
    toast.info("Configuração removida");
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Conecte o AgentZap ao seu backend openwa rodando na VPS."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Server className="h-4 w-4 text-primary" /> Backend (VPS)
          </div>

          <div className="space-y-2">
            <Label>URL do backend</Label>
            <Input
              placeholder="https://api.seudominio.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Endereço HTTPS público do servidor onde o backend openwa está rodando.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Token (Bearer)</Label>
            <Input
              type="password"
              placeholder="Cole o token impresso pelo install.sh"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={test} variant="outline" disabled={testing || !url}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                result === "ok" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" /> :
                result === "fail" ? <XCircle className="mr-2 h-4 w-4 text-rose-400" /> : null}
              Testar conexão
            </Button>
            <Button onClick={save} className="gradient-primary text-white border-0">Salvar</Button>
            <Button onClick={clear} variant="ghost" className="text-rose-400 hover:text-rose-300">
              Remover
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4 text-sm">
          <div className="font-semibold flex items-center gap-2"><ExternalLink className="h-4 w-4 text-primary" /> Como configurar</div>
          <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
            <li>Suba uma VPS Ubuntu 22.04+ (ou ative WSL2 no Windows Server).</li>
            <li>Copie a pasta <code className="text-foreground">backend/</code> para a VPS.</li>
            <li>Rode <code className="text-foreground">./install.sh</code> — ele instala Node, Postgres, Chromium, e gera um token.</li>
            <li>Configure Nginx + Certbot pra HTTPS (veja <code className="text-foreground">nginx.conf.example</code>).</li>
            <li>Cole URL e token aqui em cima e clique <strong className="text-foreground">Salvar</strong>.</li>
          </ol>
          <p className="text-xs text-muted-foreground border-t border-border/40 pt-3">
            Documentação completa: <code>backend/README.md</code>
          </p>
        </GlassCard>
      </div>

      <GlassCard className="mt-6 border-amber-500/30 bg-amber-500/5">
        <div className="text-sm">
          <strong className="text-amber-300">Migração em andamento.</strong>{" "}
          <span className="text-muted-foreground">
            O backend openwa já está pronto pra subir. As rotas do app ainda usam o banco do Lovable Cloud
            (modo demo). À medida que cada feature for migrada, ela passa a usar este backend automaticamente.
            Quando tudo estiver migrado, removemos a dependência do Cloud por completo.
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
