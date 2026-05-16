# AgentZap — Plano de Construção

App TanStack Start em pt-BR com tema glassmorphism (roxo/magenta/cyan, dark mode padrão), 9 páginas funcionais com dados persistidos no Lovable Cloud. A camada Baileys (WhatsApp real) **não roda** no runtime serverless do Lovable — toda a "conexão WhatsApp" será simulada com mocks realistas (QR fake, status que avança, grupos/membros de exemplo). Quando você tiver um backend Baileys em VPS, basta trocar as funções mock por chamadas `fetch`.

## Stack e premissas

- Frontend: TanStack Start + Tailwind + shadcn + framer-motion + lucide-react + sonner.
- Backend: Lovable Cloud (Supabase) para persistência de instâncias, grupos, membros, campanhas, regras, notas etc.
- IA (busca de grupos): NVIDIA Qwen3 Coder via `createServerFn` (você fornecerá `NVIDIA_API_KEY` como secret). Streaming SSE das 5 fases via async generator.
- Sem `@whiskeysockets/baileys`, `pino`, `@hapi/boom` — incompatíveis com Cloudflare Workers. Substituídos por mocks em `src/lib/whatsapp-mock.ts` com mesma interface.

## Design system

Tokens em `src/styles.css`:
- `--primary` roxo `oklch(0.55 0.25 290)`, `--accent` magenta `oklch(0.65 0.28 340)`, `--chart-1` cyan `oklch(0.75 0.18 200)`.
- `--background` `oklch(0.08 0.02 270)`, superfícies translúcidas via `color-mix`.
- Gradientes: `--gradient-primary` roxo→magenta, `--gradient-mesh` para fundo.
- Sombras neon: `--glow-primary`, `--glow-accent`.

Componentes:
- `GlassCard` (backdrop-blur + borda translúcida + glow opcional).
- `MeshBackground` (3 orbs animados com framer-motion, gradient mesh fixo).
- `NeonText` (text com text-shadow neon nos H1).
- `StatCard` com contador animado (`react-intersection-observer` + tween).
- `Sidebar` glass com indicador neon no item ativo, logo gradiente.
- Botões variant `gradient` (roxo→magenta) e `glass`.

## Estrutura de rotas (TanStack file-based)

```
src/routes/
  __root.tsx              shell + MeshBackground + Sidebar + Outlet
  index.tsx               Dashboard
  membros.tsx             Membros Extraídos
  buscar-grupos.tsx       Busca IA com terminal SSE
  aquecimento.tsx
  filtro-numeros.tsx
  campanhas.tsx
  auto-resposta.tsx
  historico.tsx
  memoria.tsx
  instancias.$id.tsx      detalhe da instância (grupos + extração)
  api/group-search.ts     SSE streaming NVIDIA
```

Cada rota define `head()` com title/description em pt-BR.

## Banco de dados (Lovable Cloud)

Tabelas com RLS aberta (app single-user/admin neste estágio, pode ser endurecida depois):
- `whatsapp_instances` — id, name, status, phone_number, session_data(jsonb), created_at, updated_at.
- `whatsapp_groups` — id, instance_id, group_jid, name, member_count, description, fetched_at; unique(instance_id, group_jid).
- `group_members` — id, group_id, phone_number, push_name, is_admin, is_lid, lid_raw_id, extracted_at; unique(group_id, phone_number).
- `extraction_history` — id, instance_id, group_id, group_name, member_count, status, extracted_at.
- `group_searches` — id, query, instance_id, results_count, dorks_generated(jsonb), searched_at.
- `number_warmers` — id, instance_id, status, messages_per_day, total_days, current_day, messages_sent, started_at.
- `number_filters` — id, instance_id, total_checked, valid_count, invalid_count, filtered_at.
- `campaigns` — id, instance_id, name, message, numbers(jsonb), total_numbers, sent_count, failed_count, status, scheduled_at, interval_seconds.
- `auto_reply_rules` — id, instance_id, trigger, response, match_type, is_active, times_triggered.
- `memory_notes` — id, title, content, category, is_pinned, color.

Tabela `auth_keys` é omitida (faz sentido só com Baileys real).

## Camada WhatsApp mock (`src/lib/whatsapp-mock.ts`)

Funções server (`createServerFn`) com a mesma forma da API descrita, mas implementação local:
- `createInstance`, `listInstances`, `deleteInstance`.
- `connectInstance(id)` → cria status `qr_ready`, gera QR fake via `qrcode` (lib pura JS — funciona no Worker) com payload aleatório.
- `getStatus(id)` → simula progressão `connecting` → `qr_ready` → `connected` após N polls.
- `fetchGroups(id)` → semeia grupos fictícios brasileiros realistas (nomes tipo "IFOOD MADRUGA – CDE/PDT").
- `extractMembers(groupId)` → gera membros com mistura de DDIs (55, 57, 595…), flag `is_lid` aleatória, grava em `group_members` + `extraction_history`.
- `filterNumbers(list)` → marca ~70% como válidos aleatoriamente.
- `startWarmer`, `stopWarmer` — atualiza linha em `number_warmers`.
- Auto-resposta e campanhas: persistência completa, "envio" é simulado (incrementa contadores).

Toast em todas as ações: "Modo demo — backend WhatsApp real será conectado separadamente".

## Páginas

1. **Dashboard** — 4 StatCards animados, lista de instâncias (GlassCard com status badge, botão Reconectar, modal QR), botão "+ Nova Instância".
2. **Membros Extraídos** — tabela com filtros (busca, instância, grupo), bandeira por DDI (`src/lib/country-codes.ts` com 180+ países), badge "Admin" e "LID", botões Copiar Todos, Exportar CSV, Exportar JSON (`src/lib/download.ts`).
3. **Buscar Grupos** — input + botão "Buscar com IA". Terminal-style log que recebe eventos SSE de `/api/group-search` mostrando 5 fases (Estratégia → Brave Scrape → Deep Scrape → Sites Diretório → Enriquecimento IA). Cards de grupos aparecem em tempo real. Helper `extractJSON` para limpar `<think>` e fences do Qwen.
4. **Aquecimento** — form (instância, msgs/dia, total dias) + lista histórico com progresso.
5. **Filtro de Números** — textarea + select instância + resultados em duas colunas (válidos/inválidos) com contagem.
6. **Campanhas** — CRUD via Dialog, lista com status badges, agendamento (`<input type="datetime-local">`).
7. **Auto-Resposta** — CRUD de regras, switch ativo/inativo, badge "X disparos".
8. **Histórico** — tabela `extraction_history` com link para baixar membros daquela extração.
9. **Memória** — grid Masonry estilo Google Keep, fixar nota, cores customizadas, filtro por categoria.

## Detalhe técnico — Busca IA (SSE)

`src/routes/api/group-search.ts` (server route):
```
POST → ReadableStream
  yield {phase: 1, msg: "Gerando estratégia..."}
  call NVIDIA chat completions (Qwen3 Coder) com prompt "gere 10 dorks Google p/ grupos WhatsApp sobre: {query}"
  extractJSON → dorks
  yield {phase: 2, ...} → fetch Brave Search HTML para cada dork, parse <a href> com cheerio-lite (regex no Worker)
  yield {phase: 3} → fetch top URLs, regex chat.whatsapp.com/[A-Za-z0-9]+
  yield {phase: 4} → scrape sites diretório conhecidos
  yield {phase: 5} → segundo call Qwen para enriquecer cada link com {title, description, relevance}
  yield {done: true, groups: [...]}
```
Frontend consome via `fetch` + `ReadableStream.getReader()` + `TextDecoder`, renderiza linhas no terminal e cards conforme chegam.

## Dependências a instalar

`framer-motion`, `lucide-react`, `sonner`, `qrcode`, `react-intersection-observer`. Já presentes no template: tailwind, shadcn, tanstack.

NÃO instalar: `@whiskeysockets/baileys`, `@hapi/boom`, `pino` (Node-only, quebram no Worker).

## Secrets necessários

- `NVIDIA_API_KEY` — pedirei após sua aprovação do plano.

## O que fica fora deste plano (próximas iterações)

- Integração real com backend Baileys (será apenas trocar funções mock por `fetch` para sua VPS).
- Listener de mensagens em tempo real para auto-resposta (depende do backend real).
- Sistema de auth multi-usuário com roles.

Aprove o plano para eu implementar tudo de uma vez (será uma única passagem grande, ~30+ arquivos novos).
