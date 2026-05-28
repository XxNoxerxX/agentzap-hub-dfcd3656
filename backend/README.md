# AgentZap Backend (openwa + Postgres)

Backend independente, sem dependência do Lovable Cloud. Roda em VPS Ubuntu (ou WSL2 no Windows Server).

## Stack

- **Express** — API REST com bearer token
- **@open-wa/wa-automate** — WhatsApp Web headless
- **PostgreSQL 16** — banco de dados
- **pm2** — process manager
- **Nginx + Certbot** — proxy reverso + HTTPS

## Instalação rápida (Ubuntu 22.04+ / WSL2)

```bash
# 1. Clone (ou copie) esta pasta `backend/` pra VPS
scp -r backend/ user@vps:/opt/agentzap

# 2. SSH + roda o instalador
ssh user@vps
cd /opt/agentzap
chmod +x install.sh
./install.sh
```

O `install.sh`:
- Instala Node 20, PostgreSQL, Chromium e libs do headless
- Cria DB/usuário `agentzap`
- Gera um `API_TOKEN` aleatório e imprime no terminal
- Roda migrações (`src/migrations/*.sql`)
- Builda TypeScript
- Sobe com `pm2`

Quando terminar, ele imprime:

```
SEU TOKEN DE API (guarde, copie pro AgentZap → Config):
abc123def456...
```

**Copie esse token.**

## Expor pra internet (HTTPS)

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/agentzap
sudo sed -i 's|SEU_DOMINIO.com|api.seudominio.com|' /etc/nginx/sites-available/agentzap
sudo ln -s /etc/nginx/sites-available/agentzap /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.seudominio.com
```

## WSL2 no Windows Server

```powershell
# PowerShell admin:
wsl --install -d Ubuntu-22.04
```

Depois, dentro do WSL:
```bash
sudo apt update && sudo apt install -y curl
# Copie a pasta backend/ para ~/agentzap e rode install.sh
```

Pra expor a porta do WSL pro mundo, no PowerShell:
```powershell
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=$(wsl hostname -I)
New-NetFirewallRule -DisplayName "AgentZap" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/health` | Saúde (público) |
| GET    | `/instances` | Lista instâncias |
| POST   | `/instances` | Cria `{ name }` |
| DELETE | `/instances/:id` | Remove |
| POST   | `/instances/:id/connect` | Retorna `{ qr, status }` |
| POST   | `/instances/:id/disconnect` | `{ logout? }` |
| GET    | `/instances/:id/status` | Status atual |
| GET    | `/groups?instance_id=...&only_admin=true` | Lista grupos |
| POST   | `/groups/refresh/:instanceId` | Re-sincroniza do WhatsApp |
| PATCH  | `/groups/:id` | `{ member_goal }` |
| GET    | `/leads?gender&state&city&ageMin&ageMax&search` | Filtros |
| POST   | `/leads` | Cria lead |
| DELETE | `/leads/:id` | Remove |
| GET    | `/jobs?limit=30` | Histórico de adds |
| POST   | `/jobs` | `{ instance_id, group_id, group_name, lead_ids, phones }` |
| GET    | `/jobs/:id` | Status do job |

Todas (exceto `/health`) exigem `Authorization: Bearer <token>`.

## Termômetro (anti-ban)

- ≤5 adds/grupo/dia → verde
- 6-15 → amarelo
- 16+ → vermelho (perigo)
- Conta com <7 dias: limites divididos por 2
- Pausa randômica 60-180s entre cada add

## Atualizar

```bash
cd /opt/agentzap
git pull   # ou substitua os arquivos via scp
npm install
npm run migrate
npm run build
pm2 reload agentzap
```

## Conectar ao AgentZap (frontend)

No app, vá em **Configurações** → cole:
- URL: `https://api.seudominio.com`
- Token: o que o `install.sh` imprimiu

Clique **Testar conexão** → deve mostrar "Online".
