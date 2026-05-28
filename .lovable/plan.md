## Arquitetura alvo

```
┌──────────────────┐    HTTPS + Bearer Token   ┌────────────────────────────┐
│  AgentZap (Web)  │  ◄──────────────────────► │   VPS Ubuntu (WSL2)        │
│  Lovable preview │                           │   ├─ Node.js + Express     │
│  (só frontend)   │                           │   │  + openwa/wa-automate  │
│  Sem Supabase    │                           │   ├─ PostgreSQL 16         │
│                  │                           │   ├─ Redis (filas)         │
└──────────────────┘                           │   └─ Nginx + Certbot       │
                                               └────────────────────────────┘
```

Lovable Cloud sai por completo. O Postgres vive na VPS ao lado do openwa — uma única máquina, um único dono dos dados, zero dependência externa.

## O que será removido

- `@supabase/supabase-js` do `package.json`
- `src/integrations/supabase/*` (client, auth-middleware, types, attacher)
- `src/lib/whatsapp-mock.ts` e `src/lib/member-add-mock.ts` (substituídos por cliente HTTP)
- `src/routes/api/public/group-search.ts` (vai pra VPS)
- `supabase/` (config.toml, migrations)
- Variáveis `VITE_SUPABASE_*` do `.env`
- `attachSupabaseAuth` do `src/start.ts`

## O que será criado no frontend

1. **`src/lib/api-client.ts`** — fetch wrapper com URL base + bearer token (lido de `localStorage`)
2. **`src/lib/backend/*.ts`** — módulos tipados que substituem cada arquivo mock (mesma assinatura de função, só muda a implementação)
3. **`src/routes/configuracoes.tsx`** — página pra colar URL da VPS + token, salvar em localStorage, botão "testar conexão"
4. **`src/hooks/use-backend-status.ts`** — polling de `/health` pra exibir indicador online/offline no header
5. Refator de todas as rotas existentes pra trocar `supabase.from(...)` por `api.x.y()`

## O que será criado pra VPS (entregue como pacote `backend/` na raiz do projeto)

```
backend/
  package.json
  tsconfig.json
  src/
    server.ts                 # Express + middleware bearer
    db.ts                     # pg pool
    migrations/               # SQL idêntico ao schema atual
    routes/
      instances.ts            # CRUD instâncias
      groups.ts               # listar/buscar grupos
      members.ts              # extrair, adicionar em massa
      leads.ts                # CRUD leads + busca filtrada
      jobs.ts                 # jobs de add com termômetro
      campaigns.ts            # broadcast
      warmers.ts              # aquecimento
      auto-reply.ts
      memory.ts
      group-search.ts         # dorks (Brave/Firecrawl)
    wa/
      client.ts               # openwa singleton por instância
      session-store.ts        # multi-sessão em disco
      add-throttle.ts         # pausa 60-180s + termômetro
    queue.ts                  # BullMQ + Redis
  README.md                   # passo a passo de instalação
  install.sh                  # script idempotente: node, postgres, redis, pm2
  ecosystem.config.js         # pm2
  nginx.conf.example
```

### Endpoints REST principais

```
GET    /health
POST   /auth/login                    → bearer token (single user, senha fixa em .env)

GET    /instances
POST   /instances                     { name }
DELETE /instances/:id
POST   /instances/:id/connect         → { qr: dataUrl }
POST   /instances/:id/disconnect
GET    /instances/:id/status          → SSE com status + qr updates

GET    /instances/:id/groups
POST   /instances/:id/groups/refresh
POST   /groups/:id/extract-members
PATCH  /groups/:id                    { member_goal }

POST   /groups/:id/add-members        { leadIds[], phones[] } → jobId
GET    /jobs                          ?limit=30
GET    /jobs/:id                      → SSE com progresso

GET    /leads                         ?gender&state&city&ageMin&ageMax&search
POST   /leads / PATCH /leads/:id / DELETE /leads/:id
POST   /leads/import                  CSV

POST   /campaigns ...
POST   /warmers ...
POST   /auto-reply ...
POST   /memory ...
POST   /group-search                  dorks
```

### Decisões técnicas

- **openwa**: `@open-wa/wa-automate` (Chromium headless). Cada instância = 1 client persistido em `sessions/{id}/`.
- **Termômetro conservador**: ≤5 adds/grupo/dia = verde, 6-15 amarelo, 16+ vermelho. Contas com <7 dias dividem limites por 2. Pausa randômica 60-180s entre adds. Implementado em `wa/add-throttle.ts`.
- **Auth**: bearer token simples (`Authorization: Bearer xxx`), token gerado no primeiro `install.sh` e impresso no terminal. Sem multi-usuário por enquanto.
- **CORS**: `Access-Control-Allow-Origin: *` (a URL do preview Lovable muda). Restringível depois.
- **Realtime**: SSE (Server-Sent Events) pros status de QR/conexão/job — mais simples que WebSocket e atravessa Nginx sem config extra.
- **Banco**: PostgreSQL nativo na VPS, schema idêntico ao atual (já existe — só migrar SQL). `pg` driver direto, sem ORM.

## Passos da implementação (ordem)

### 1. Backend (entrego pronto pra subir)

a. Criar pasta `backend/` com tudo listado acima
b. SQL de migração com tabelas idênticas (instâncias, grupos, membros, leads, jobs, etc.)
c. `install.sh` idempotente:
   - `apt install nodejs postgresql redis nginx certbot`
   - cria DB + roda migrações
   - `npm install` no backend
   - configura pm2 + reinício automático
   - imprime bearer token gerado
d. `README.md` com:
   - "como rodar no WSL2 do Windows Server"
   - como apontar domínio e gerar SSL
   - como atualizar (git pull + pm2 restart)

### 2. Frontend (refator)

a. Remover dependências e arquivos Supabase
b. Criar `api-client.ts` + `lib/backend/*.ts`
c. Refatorar rotas:
   - `index.tsx` (dashboard)
   - `instancias.$id.tsx`
   - `adicionar-membros.tsx`
   - `leads.tsx`, `membros.tsx`, `historico.tsx`
   - `buscar-grupos.tsx`, `campanhas.tsx`, `filtro-numeros.tsx`
   - `auto-resposta.tsx`, `aquecimento.tsx`, `memoria.tsx`
d. Nova rota `configuracoes.tsx`
e. Remover `start.ts` middleware Supabase
f. Limpar `routeTree.gen.ts` (auto)

### 3. Modo demo (fallback)

Mantenho um `MOCK_MODE` ligável via configuração — se não tiver URL de backend configurada, o cliente HTTP retorna dados fake (igual aos mocks atuais). Isso permite navegar o app sem a VPS pronta e facilita teste local.

## O que você precisa fazer depois

1. Subir a VPS (Hetzner Ubuntu 22.04 ou WSL2 no Windows Server)
2. Rodar `curl -fsSL https://seu-projeto/install.sh | bash`
3. Copiar o bearer token impresso
4. Em **Configurações** no app, colar `https://seu-dominio.com` + token → "Testar conexão" → OK

Pronto, app rodando 100% na sua infra.

## Aviso importante

Esse refator é grande (todos os arquivos de rota + remoção de toda camada Supabase). Vou fazer em uma sequência só, mas o app vai ficar **temporariamente quebrado** durante a transição (alguns minutos no preview). Quando terminar, você precisa configurar a URL do backend em /configuracoes ou ativar o modo demo, senão nenhuma página vai carregar dados.

Confirma que sigo?