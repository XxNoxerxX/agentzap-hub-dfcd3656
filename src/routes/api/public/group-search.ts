import { createFileRoute } from "@tanstack/react-router";

/**
 * Busca agentic de grupos WhatsApp.
 * Fase 0: Expansão IA (briefing + sugestões de keywords).
 * Fase 1: Geração de dorks.
 * Fase 2: Brave Search.
 * Fase 3: Validação real do convite (HTML do WhatsApp).
 * Fase 4: Auto-refinamento agentic.
 * Fase 5: Relevância estrita (com base no título/descrição REAIS).
 */

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";

type GroupStatus = "active" | "revoked" | "unknown";
interface FoundGroup {
  url: string;
  code: string;
  title?: string;
  description?: string;
  image?: string;
  status: GroupStatus;
  relevance?: number;
  reason?: string;
}

function sse(obj: unknown) { return `data: ${JSON.stringify(obj)}\n\n`; }

function extractJSON<T = unknown>(raw: string): T | null {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1").trim();
  const i = s.search(/[\[{]/);
  if (i === -1) return null;
  const open = s[i], close = open === "[" ? "]" : "}";
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close) { depth--; if (depth === 0) { try { return JSON.parse(s.slice(i, j + 1)); } catch { return null; } } }
  }
  return null;
}

async function nvidia(messages: Array<{ role: string; content: string }>, key: string, maxTokens = 2048): Promise<string> {
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: NVIDIA_MODEL, messages, max_tokens: maxTokens, temperature: 0.4, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`NVIDIA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

const WA_LINK_RE = /https?:\/\/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{8,})/gi;

function extractWaLinks(text: string): Array<{ url: string; code: string }> {
  const out: Array<{ url: string; code: string }> = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(WA_LINK_RE)) {
    const code = m[1];
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ url: `https://chat.whatsapp.com/${code}`, code });
  }
  return out;
}

async function braveSearch(query: string, key: string): Promise<{ url: string; title?: string; description?: string }[]> {
  const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=20&safesearch=off&country=BR`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json", "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const j = await res.json() as { web?: { results?: Array<{ url: string; title?: string; description?: string }> } };
  return j.web?.results ?? [];
}

async function validateInvite(code: string): Promise<{ status: GroupStatus; title?: string; description?: string; image?: string }> {
  try {
    const res = await fetch(`https://chat.whatsapp.com/${code}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (!res.ok) return { status: "unknown" };
    const html = await res.text();

    const revokedSignals = [
      /link do convite.*?(reset|revogad|inv[áa]lid|expirad)/i,
      /invite link.*?(reset|revoked|invalid|expired)/i,
      /check with the (?:group admin|community admin)/i,
      /verifique com o administrador/i,
      /n[ãa]o é mais válido/i,
    ];
    if (revokedSignals.some((re) => re.test(html))) return { status: "revoked" };

    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];

    const hasJoinAction = /(use o link do grupo para entrar|use this invite link to join|action=join)/i.test(html);

    if (!ogTitle || /^WhatsApp$/i.test(ogTitle.trim())) {
      return hasJoinAction ? { status: "unknown" } : { status: "revoked" };
    }
    return { status: "active", title: ogTitle, description: ogDesc, image: ogImage };
  } catch { return { status: "unknown" }; }
}

const DEFAULT_DORKS = (q: string) => [
  `"${q}" site:chat.whatsapp.com`,
  `${q} "chat.whatsapp.com"`,
  `${q} grupo whatsapp link`,
  `${q} entrar grupo whatsapp`,
  `inurl:chat.whatsapp.com ${q}`,
  `intext:"chat.whatsapp.com" ${q}`,
  `${q} whatsapp group join`,
  `"${q}" whatsapp grupo`,
];

interface ExpansionBrief {
  brief: string;             // descrição rica do que o usuário procura
  positiveTerms: string[];   // termos que DEVEM aparecer (sinônimos, variantes regionais)
  negativeTerms: string[];   // termos a evitar (desambiguação)
  keywordVariants: string[]; // sugestões de queries alternativas pro usuário clicar
  suggestions: string[];     // sugestões textuais de refinamento
}

export const Route = createFileRoute("/api/public/group-search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const nvidiaKey = process.env.NVIDIA_API_KEY;
        const braveKey = process.env.BRAVE_API_KEY;

        let body: { query?: string; depth?: number; context?: string };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        const query = (body.query ?? "").toString().slice(0, 300).trim();
        const context = (body.context ?? "").toString().slice(0, 500).trim();
        const depth = Math.max(1, Math.min(5, body.depth ?? 5));
        if (!query) return new Response("query required", { status: 400 });

        const stream = new ReadableStream({
          async start(ctrl) {
            const enc = new TextEncoder();
            const send = (o: unknown) => ctrl.enqueue(enc.encode(sse(o)));
            const found = new Map<string, FoundGroup>();
            const emit = (g: FoundGroup) => { found.set(g.code, g); send({ group: g }); };

            try {
              if (!braveKey) { send({ error: "BRAVE_API_KEY ausente" }); return; }

              // ============ FASE 0 — Expansão de tema ============
              let expansion: ExpansionBrief = {
                brief: query + (context ? ` — contexto: ${context}` : ""),
                positiveTerms: [query],
                negativeTerms: [],
                keywordVariants: [],
                suggestions: [],
              };

              if (nvidiaKey) {
                send({ phase: 0, type: "info", log: `Expandindo tema "${query}"${context ? ` com contexto` : ""}…` });
                try {
                  const out = await nvidia([
                    { role: "system", content: "Você é especialista em pesquisa semântica e desambiguação. Dada uma palavra-chave (e opcionalmente um contexto do usuário), você produz: (1) brief detalhado do que o usuário REALMENTE busca, (2) termos positivos esperados em títulos/descrições de grupos relevantes, (3) termos negativos para descartar grupos NÃO-relacionados (homônimos, ambiguidades), (4) variações de query mais específicas, (5) sugestões textuais para o usuário refinar. Responda APENAS um objeto JSON." },
                    { role: "user", content: `Palavra-chave: "${query}"
${context ? `Contexto fornecido pelo usuário: "${context}"` : "Sem contexto extra."}

Exemplo de problema: para a palavra "paraguai" sem contexto, grupos como "Visão de Águia Estrada" ou "Imitando o Lula" NÃO são relevantes — eles só citam Paraguai por acaso. Grupos relevantes seriam sobre: compras no Paraguai, Ciudad del Este, sacoleiros, atacado PY, importados, eletrônicos CDE, etc.

Retorne JSON exato:
{
  "brief": "...descrição rica do que o usuário busca (1-3 frases)...",
  "positiveTerms": ["...","..."],  // 10-20 termos/sinônimos/variantes regionais que DEVEM aparecer em grupos relevantes
  "negativeTerms": ["...","..."],  // 5-15 termos que indicam grupo OFF-TOPIC (política, religião não relacionada, memes, etc.)
  "keywordVariants": ["...","..."], // 6-10 queries alternativas mais específicas para o usuário clicar (ex.: "compras paraguai ciudad del este", "atacado eletrônicos py")
  "suggestions": ["...","..."]      // 3-5 sugestões TEXTUAIS curtas para o usuário melhorar a busca (ex.: "Adicione 'compras' para focar em sacoleiros")
}` },
                  ], nvidiaKey, 2500);
                  const parsed = extractJSON<Partial<ExpansionBrief>>(out);
                  if (parsed && parsed.brief) {
                    expansion = {
                      brief: parsed.brief,
                      positiveTerms: (parsed.positiveTerms ?? []).filter((s) => typeof s === "string"),
                      negativeTerms: (parsed.negativeTerms ?? []).filter((s) => typeof s === "string"),
                      keywordVariants: (parsed.keywordVariants ?? []).filter((s) => typeof s === "string").slice(0, 10),
                      suggestions: (parsed.suggestions ?? []).filter((s) => typeof s === "string").slice(0, 5),
                    };
                    send({ phase: 0, type: "ok", log: `Brief: ${expansion.brief}` });
                    send({ phase: 0, type: "info", log: `+ ${expansion.positiveTerms.length} termos positivos · ${expansion.negativeTerms.length} negativos` });
                    send({ expansion });
                  }
                } catch (e) {
                  send({ phase: 0, type: "err", log: `Expansão falhou: ${(e as Error).message}` });
                }
              }

              // ============ FASE 1 — Estratégia ============
              send({ phase: 1, type: "info", log: `Profundidade: ${depth}/5` });
              const dorkTargetByDepth = [10, 15, 25, 40, 60][depth - 1];
              let dorks: string[] = [];

              if (nvidiaKey) {
                try {
                  send({ phase: 1, type: "info", log: `Gerando ${dorkTargetByDepth} dorks via IA (com brief expandido)…` });
                  const out = await nvidia([
                    { role: "system", content: "Você é especialista em Google/Brave dorking para encontrar links de grupos WhatsApp PRECISOS. Use o brief e os termos positivos para gerar dorks ALTAMENTE ESPECÍFICAS — evite queries genéricas que retornem off-topic. Responda APENAS array JSON de strings." },
                    { role: "user", content: `BRIEF: ${expansion.brief}
TERMOS POSITIVOS: ${expansion.positiveTerms.join(", ")}
TERMOS A EVITAR (use -termo nas dorks): ${expansion.negativeTerms.join(", ")}

Gere EXATAMENTE ${dorkTargetByDepth} dorks variadas (PT/EN/ES) COMBINANDO os termos positivos com operadores: site:chat.whatsapp.com, inurl:, intext:, intitle:, "chat.whatsapp.com". Use aspas em frases, combine 2-3 termos positivos por dork, e adicione -termoNegativo quando ajudar. Inclua buscas em reddit.com, facebook.com/groups, t.me, pastebin, github. JSON array só.` },
                  ], nvidiaKey, 3500);
                  const parsed = extractJSON<string[]>(out) ?? [];
                  dorks = parsed.filter((d) => typeof d === "string" && d.length > 3).slice(0, dorkTargetByDepth);
                  send({ phase: 1, type: "ok", log: `${dorks.length} dorks geradas` });
                } catch (e) {
                  send({ phase: 1, type: "err", log: `IA falhou: ${(e as Error).message}. Usando padrão.` });
                }
              }
              if (dorks.length === 0) dorks = DEFAULT_DORKS(query);
              dorks.slice(0, 10).forEach((d) => send({ phase: 1, type: "info", log: `  • ${d}` }));
              if (dorks.length > 10) send({ phase: 1, type: "info", log: `  … +${dorks.length - 10} dorks` });

              // ============ FASE 2 — Brave Search ============
              send({ phase: 2, type: "info", log: `Buscando no Brave Search (${dorks.length} dorks)…` });
              let totalResults = 0;
              for (let i = 0; i < dorks.length; i++) {
                const d = dorks[i];
                try {
                  const results = await braveSearch(d, braveKey);
                  totalResults += results.length;
                  let nNew = 0;
                  for (const r of results) {
                    for (const { url, code } of extractWaLinks(`${r.url} ${r.title ?? ""} ${r.description ?? ""}`)) {
                      if (!found.has(code)) {
                        emit({ url, code, title: r.title, description: r.description, status: "unknown" });
                        nNew++;
                      }
                    }
                  }
                  send({ phase: 2, type: nNew > 0 ? "ok" : "info", log: `  [${i + 1}/${dorks.length}] ${results.length} resultados, +${nNew} grupos · "${d.slice(0, 60)}"` });
                  await new Promise((r) => setTimeout(r, 1100));
                } catch (e) {
                  send({ phase: 2, type: "err", log: `  ✗ "${d.slice(0, 60)}": ${(e as Error).message}` });
                  await new Promise((r) => setTimeout(r, 1500));
                }
              }
              send({ phase: 2, type: "ok", log: `Brave: ${totalResults} resultados · ${found.size} grupos únicos` });

              // ============ FASE 3 — Validação ============
              const toValidate = [...found.values()];
              send({ phase: 3, type: "info", log: `Validando ${toValidate.length} convites no WhatsApp…` });
              let active = 0, revoked = 0, unknown = 0;
              const BATCH = 8;
              for (let i = 0; i < toValidate.length; i += BATCH) {
                const batch = toValidate.slice(i, i + BATCH);
                await Promise.all(batch.map(async (g) => {
                  const v = await validateInvite(g.code);
                  const updated: FoundGroup = {
                    ...g,
                    status: v.status,
                    title: v.title ?? g.title,
                    description: v.description ?? g.description,
                    image: v.image,
                  };
                  found.set(g.code, updated);
                  send({ groupUpdate: updated });
                  if (v.status === "active") active++;
                  else if (v.status === "revoked") revoked++;
                  else unknown++;
                }));
                send({ phase: 3, type: "info", log: `  ${Math.min(i + BATCH, toValidate.length)}/${toValidate.length} · ativos:${active} revogados:${revoked} ?:${unknown}` });
              }
              send({ phase: 3, type: "ok", log: `Validação: ${active} ativos · ${revoked} revogados · ${unknown} ?` });

              // ============ FASE 4 — Refinamento ============
              if (nvidiaKey && depth >= 3 && active > 0) {
                const activeGroups = [...found.values()].filter((g) => g.status === "active").slice(0, 30);
                const refinePasses = depth === 5 ? 2 : 1;
                for (let pass = 1; pass <= refinePasses; pass++) {
                  send({ phase: 4, type: "info", log: `Refinamento ${pass}/${refinePasses} sobre ${activeGroups.length} ativos…` });
                  try {
                    const sample = activeGroups.map((g) => `- ${g.title ?? g.url}${g.description ? ` :: ${g.description.slice(0, 100)}` : ""}`).join("\n");
                    const out = await nvidia([
                      { role: "system", content: "Você refina dorks com base no brief e nos grupos JÁ ATIVOS encontrados. Foco em precisão. Responda APENAS array JSON." },
                      { role: "user", content: `BRIEF: ${expansion.brief}\nTERMOS POSITIVOS: ${expansion.positiveTerms.join(", ")}\nGRUPOS ATIVOS:\n${sample}\n\nGere 15 NOVAS dorks ALTAMENTE ESPECÍFICAS (subtemas, nichos, regionais) baseadas nos padrões dos títulos acima. JSON array só.` },
                    ], nvidiaKey, 2500);
                    const newDorks = (extractJSON<string[]>(out) ?? []).filter((d) => typeof d === "string").slice(0, 15);
                    send({ phase: 4, type: "ok", log: `  ${newDorks.length} dorks refinadas` });
                    const before = found.size;
                    for (let i = 0; i < newDorks.length; i++) {
                      const d = newDorks[i];
                      try {
                        const results = await braveSearch(d, braveKey);
                        const newCodes: string[] = [];
                        for (const r of results) {
                          for (const { url, code } of extractWaLinks(`${r.url} ${r.title ?? ""} ${r.description ?? ""}`)) {
                            if (!found.has(code)) {
                              emit({ url, code, title: r.title, description: r.description, status: "unknown" });
                              newCodes.push(code);
                            }
                          }
                        }
                        await Promise.all(newCodes.map(async (code) => {
                          const v = await validateInvite(code);
                          const cur = found.get(code)!;
                          const upd = { ...cur, status: v.status, title: v.title ?? cur.title, description: v.description ?? cur.description, image: v.image };
                          found.set(code, upd);
                          send({ groupUpdate: upd });
                        }));
                        send({ phase: 4, type: newCodes.length ? "ok" : "info", log: `  [P${pass} ${i + 1}/${newDorks.length}] +${newCodes.length} novos · "${d.slice(0, 55)}"` });
                        await new Promise((r) => setTimeout(r, 1100));
                      } catch (e) {
                        send({ phase: 4, type: "err", log: `  ✗ ${(e as Error).message}` });
                        await new Promise((r) => setTimeout(r, 1500));
                      }
                    }
                    send({ phase: 4, type: "ok", log: `Refinamento ${pass}: +${found.size - before} grupos` });
                  } catch (e) {
                    send({ phase: 4, type: "err", log: `Refinamento ${pass}: ${(e as Error).message}` });
                  }
                }
              } else {
                send({ phase: 4, type: "info", log: "Refinamento pulado" });
              }

              // ============ FASE 5 — Relevância ESTRITA ============
              const finalList = [...found.values()];
              const activeList = finalList.filter((g) => g.status === "active" && g.title);
              if (nvidiaKey && activeList.length > 0) {
                send({ phase: 5, type: "info", log: `Avaliando relevância ESTRITA de ${activeList.length} grupos ativos…` });
                try {
                  // Chunks de 25 pra prompt não explodir
                  const CHUNK = 25;
                  let scoredCount = 0;
                  for (let i = 0; i < activeList.length; i += CHUNK) {
                    const chunk = activeList.slice(i, i + CHUNK);
                    const slim = chunk.map((g, idx) => ({ i: idx, title: g.title, desc: g.description?.slice(0, 200) }));
                    const out = await nvidia([
                      { role: "system", content: `Você avalia relevância ESTRITA de grupos WhatsApp dado um brief. Seja RIGOROSO: grupo só é relevante se o título/descrição mostrar conexão CLARA com o tema. Se for genérico, off-topic, política/religião não relacionada, ou só mencionar o termo por acaso, score = 0. Responda APENAS array JSON: [{"i":int, "score":float 0-1, "reason":"motivo curto"}].` },
                      { role: "user", content: `BRIEF: ${expansion.brief}
TERMOS POSITIVOS: ${expansion.positiveTerms.join(", ")}
TERMOS NEGATIVOS (penalize fortemente): ${expansion.negativeTerms.join(", ")}

GRUPOS:
${JSON.stringify(slim)}

Avalie cada grupo. Score 0 = totalmente off-topic. Score 1 = perfeitamente alinhado ao brief.` },
                    ], nvidiaKey, 3500);
                    const scored = extractJSON<Array<{ i: number; score: number; reason?: string }>>(out) ?? [];
                    for (const s of scored) {
                      const g = chunk[s.i];
                      if (g) {
                        const upd = { ...g, relevance: Math.max(0, Math.min(1, s.score)), reason: s.reason };
                        found.set(g.code, upd);
                        send({ groupUpdate: upd });
                        scoredCount++;
                      }
                    }
                    send({ phase: 5, type: "info", log: `  ${Math.min(i + CHUNK, activeList.length)}/${activeList.length} avaliados` });
                  }
                  send({ phase: 5, type: "ok", log: `${scoredCount} grupos pontuados (rigoroso)` });
                } catch (e) {
                  send({ phase: 5, type: "err", log: `Relevância: ${(e as Error).message}` });
                }
              }

              const sorted = [...found.values()].sort((a, b) => {
                const sa = a.status === "active" ? 2 : a.status === "unknown" ? 1 : 0;
                const sb = b.status === "active" ? 2 : b.status === "unknown" ? 1 : 0;
                if (sa !== sb) return sb - sa;
                return (b.relevance ?? 0) - (a.relevance ?? 0);
              });
              const stats = {
                total: sorted.length,
                active: sorted.filter((g) => g.status === "active").length,
                relevant: sorted.filter((g) => g.status === "active" && (g.relevance ?? 0) >= 0.5).length,
                revoked: sorted.filter((g) => g.status === "revoked").length,
                unknown: sorted.filter((g) => g.status === "unknown").length,
              };
              send({ groups: sorted, done: true, ...stats });
            } catch (e) {
              send({ error: (e as Error).message });
            } finally {
              ctrl.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
});
