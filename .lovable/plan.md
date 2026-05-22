
# Diagnóstico

A busca atual depende **só do Brave Search**, que tem 3 problemas:

1. **Índice pequeno** — Brave indexa muito menos páginas que Google.
2. **WhatsApp bloqueia indexação** (`robots.txt` em chat.whatsapp.com) → quase nada aparece via `site:chat.whatsapp.com`.
3. **As 60 dorks convergem nos mesmos 4-5 sites** — então mais dorks não ajuda mais.

A solução é **mais fontes em paralelo**, não mais dorks.

# Plano

## 1. Firecrawl Search como motor principal (já conectado!)

Vi que `FIRECRAWL_API_KEY` já está no projeto. Firecrawl `search()` usa **Google** por trás (índice gigante) e ainda retorna o conteúdo scraped da página numa única chamada. Ganho esperado: **5-10x mais grupos**.

## 2. DuckDuckGo HTML scrape (grátis, sem key)

`GET https://html.duckduckgo.com/html/?q=...` + regex. Operador `site:` funciona bem lá. Boa cobertura adicional sem custo.

## 3. Sites diretório de grupos (ganho enorme)

Crawl direto em ~12 sites que **agregam convites de WhatsApp**:
- grupowhats.com, gruposwhats.com.br, gruposdozap.com
- whatsgrouplink.com, grupowapp.com, wagrupos.com.br
- gruposparawhatsapp.com.br, linkdegrupos.com.br
- grupowhatsapp.net, chat-whatsapp.com, whatsappgrupos.com.br, grupozap.net

Pra cada um: `firecrawl.search("site:DOMINIO {query}")` → extrai todos os `chat.whatsapp.com/CODE` do markdown retornado.

## 4. Variantes de query em paralelo

A IA já gera `positiveTerms`. Em vez de só usar nas dorks, **rodar a busca completa em cada variante** (paralelo, dedup no fim). Ex: "paraguai" dispara buscas paralelas pra "ciudad del este", "compras py", "sacoleiros paraguai", "atacado py".

## 5. Cache de invites validados

Nova tabela `validated_invites` (code PK, status, title, description, image, last_checked_at). Buscas futuras pulam validação de códigos já vistos → mais rápido + cria um índice próprio com o tempo.

## 6. Regex expandida + resolução de encurtadores

Adicionar `bit.ly`, `cutt.ly`, `tinyurl`, `encurtador.com.br` → HEAD request → se redireciona pra `chat.whatsapp.com`, conta como invite.

# Pipeline novo

```text
F0 Expansão IA (já existe)
F1 Estratégia: dorks + variantes de query
F2 Busca paralela:
   ├ Brave API           (já tem)
   ├ Firecrawl Search    (Google, já conectado)
   ├ DuckDuckGo scrape   (grátis)
   └ 12 sites diretório  (via firecrawl.search com site:)
F3 Dedup + regex expandida + resolve encurtadores
F4 Validação (com cache em validated_invites)
F5 Refinamento (já existe)
F6 Relevância IA (já existe)
```

Cada fonte é `Promise.allSettled` com timeout de 15s e log colorido próprio no terminal SSE — você vê em tempo real de onde vem cada grupo.

# Perguntas

1. **Cache de invites** — crio a tabela `validated_invites` agora? (recomendo: sim, acelera muito buscas repetidas)
2. **Sites diretório** — a lista de 12 acima é suficiente, ou quer que eu pesquise mais antes de implementar?
3. **Variantes em paralelo** — quantas no máximo por busca? Sugiro **5** (query original + 4 melhores variantes da IA) pra não estourar rate-limit do Firecrawl.
