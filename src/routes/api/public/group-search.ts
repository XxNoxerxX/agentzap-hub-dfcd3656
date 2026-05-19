import { createFileRoute } from "@tanstack/react-router";

/**
 * Busca agentic de grupos WhatsApp.
 * Brave Search (multi-dork) -> validação real de convite -> auto-refinamento IA.
 * SSE streaming.
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

/** Valida convite real chamando a página do WhatsApp. */
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

    // Sinais de revogado/inválido
    const revokedSignals = [
      /link do convite.*?(reset|revogad|inv[áa]lid|expirad)/i,
      /invite link.*?(reset|revoked|invalid|expired)/i,
      /check with the (?:group admin|community admin)/i,
      /verifique com o administrador/i,
      /n[ãa]o é mais válido/i,
    ];
    if (revokedSignals.some((re) => re.test(html))) return { status: "revoked" };

    // Extrai metadados
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];

    const hasJoinAction = /(use o link do grupo para entrar|use this invite link to join|action=join)/i.test(html);

    // Título genérico = inválido
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

export const Route = createFileRoute("/api/public/group-search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const nvidiaKey = process.env.NVIDIA_API_KEY;
        const braveKey = process.env.BRAVE_API_KEY;

        let body: { query?: string; depth?: number };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        const query = (body.query ?? "").toString().slice(0, 300).trim();
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

              // ============ FASE 1 — Estratégia ============
              send({ phase: 1, type: "info", log: `Profundidade: ${depth}/5 · query: "${query}"` });
              const dorkTargetByDepth = [10, 15, 25, 40, 60][depth - 1];
              let dorks: string[] = [];

              if (nvidiaKey) {
                try {
                  send({ phase: 1, type: "info", log: `Gerando ${dorkTargetByDepth} dorks via IA…` });
                  const out = await nvidia([
                    { role: "system", content: "Você é especialista em Google/Brave dorking para encontrar links públicos de grupos WhatsApp. Responda APENAS um array JSON de strings." },
                    { role: "user", content: `Gere EXATAMENTE ${dorkTargetByDepth} dorks variadas (português + inglês + espanhol quando fizer sentido) para encontrar grupos WhatsApp sobre: "${query}".
Use TODOS estes operadores: site:chat.whatsapp.com, inurl:, intext:, intitle:, "chat.whatsapp.com", aspas em frases-chave, sinônimos, variações regionais, hashtags, plataformas adjacentes (reddit.com, twitter.com, facebook.com/groups, telegram, medium, dev.to, github, pastebin, t.me). Inclua dorks que busquem em fóruns/blogs/listagens. Seja CRIATIVO e EXAUSTIVO. Responda só com o JSON array de strings.` },
                  ], nvidiaKey, 3000);
                  const parsed = extractJSON<string[]>(out) ?? [];
                  dorks = parsed.filter((d) => typeof d === "string" && d.length > 3).slice(0, dorkTargetByDepth);
                  send({ phase: 1, type: "ok", log: `${dorks.length} dorks geradas pela IA` });
                } catch (e) {
                  send({ phase: 1, type: "err", log: `IA falhou: ${(e as Error).message}. Usando padrão.` });
                }
              }
              if (dorks.length === 0) dorks = DEFAULT_DORKS(query);
              dorks.slice(0, 12).forEach((d) => send({ phase: 1, type: "info", log: `  • ${d}` }));
              if (dorks.length > 12) send({ phase: 1, type: "info", log: `  … +${dorks.length - 12} dorks` });

              // ============ FASE 2 — Brave Search ============
              send({ phase: 2, type: "info", log: `Buscando no Brave Search (${dorks.length} dorks)…` });
              let totalResults = 0;
              const allTextForLinks: string[] = [];

              for (let i = 0; i < dorks.length; i++) {
                const d = dorks[i];
                try {
                  const results = await braveSearch(d, braveKey);
                  totalResults += results.length;
                  let nNew = 0;
                  for (const r of results) {
                    allTextForLinks.push(`${r.url} ${r.title ?? ""} ${r.description ?? ""}`);
                    for (const { url, code } of extractWaLinks(`${r.url} ${r.title ?? ""} ${r.description ?? ""}`)) {
                      if (!found.has(code)) {
                        emit({ url, code, title: r.title, description: r.description, status: "unknown" });
                        nNew++;
                      }
                    }
                  }
                  send({ phase: 2, type: nNew > 0 ? "ok" : "info", log: `  [${i + 1}/${dorks.length}] ${results.length} resultados, +${nNew} grupos · "${d.slice(0, 60)}"` });
                  // pequena pausa pra respeitar rate limit Brave free (1 req/s)
                  await new Promise((r) => setTimeout(r, 1100));
                } catch (e) {
                  send({ phase: 2, type: "err", log: `  ✗ "${d.slice(0, 60)}": ${(e as Error).message}` });
                  await new Promise((r) => setTimeout(r, 1500));
                }
              }
              send({ phase: 2, type: "ok", log: `Brave: ${totalResults} resultados · ${found.size} grupos únicos descobertos` });

              // ============ FASE 3 — Validação real de convites ============
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
                send({ phase: 3, type: "info", log: `  validados ${Math.min(i + BATCH, toValidate.length)}/${toValidate.length} · ativos:${active} revogados:${revoked} ?:${unknown}` });
              }
              send({ phase: 3, type: "ok", log: `Validação: ${active} ativos · ${revoked} revogados · ${unknown} indeterminados` });

              // ============ FASE 4 — Auto-refinamento agentic ============
              if (nvidiaKey && depth >= 3 && active > 0) {
                const activeGroups = [...found.values()].filter((g) => g.status === "active").slice(0, 30);
                const refinePasses = depth === 5 ? 2 : 1;

                for (let pass = 1; pass <= refinePasses; pass++) {
                  send({ phase: 4, type: "info", log: `Refinamento ${pass}/${refinePasses}: gerando novas dorks baseado em ${activeGroups.length} grupos ativos…` });
                  try {
                    const sample = activeGroups.map((g) => `- ${g.title ?? g.url}${g.description ? ` :: ${g.description.slice(0, 100)}` : ""}`).join("\n");
                    const out = await nvidia([
                      { role: "system", content: "Você refina buscas. Baseado em grupos JÁ encontrados, infere subtemas/nichos relacionados e gera novas dorks específicas. Responda APENAS array JSON de strings." },
                      { role: "user", content: `Tema original: "${query}".\nGrupos ATIVOS já encontrados:\n${sample}\n\nGere 15 NOVAS dorks (sem repetir as anteriores) focadas em subtemas, variações regionais, nichos adjacentes e termos específicos que apareceram nos títulos acima. Use site:chat.whatsapp.com, inurl:, intext:. JSON array só.` },
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
                        // valida só os novos imediatamente
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
                    send({ phase: 4, type: "ok", log: `Refinamento ${pass}: +${found.size - before} grupos novos` });
                  } catch (e) {
                    send({ phase: 4, type: "err", log: `Refinamento ${pass} falhou: ${(e as Error).message}` });
                  }
                }
              } else {
                send({ phase: 4, type: "info", log: "Refinamento pulado (depth<3 ou sem grupos ativos)" });
              }

              // ============ FASE 5 — Relevância ============
              const finalList = [...found.values()];
              if (nvidiaKey && finalList.length > 0) {
                send({ phase: 5, type: "info", log: `Calculando relevância de ${finalList.length} grupos…` });
                try {
                  const slim = finalList.slice(0, 80).map((g) => ({ url: g.url, title: g.title, description: g.description?.slice(0, 120) }));
                  const out = await nvidia([
                    { role: "system", content: "Você atribui relevância 0-1 (float) a grupos WhatsApp dado um tema. Responda APENAS JSON array de {url, relevance}." },
                    { role: "user", content: `Tema: "${query}". Grupos: ${JSON.stringify(slim)}. Retorne só o JSON.` },
                  ], nvidiaKey, 3000);
                  const scored = extractJSON<Array<{ url: string; relevance: number }>>(out) ?? [];
                  for (const s of scored) {
                    const code = s.url?.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/)?.[1];
                    if (code && found.has(code)) {
                      const cur = found.get(code)!;
                      found.set(code, { ...cur, relevance: s.relevance });
                    }
                  }
                  send({ phase: 5, type: "ok", log: `${scored.length} grupos pontuados` });
                } catch (e) { send({ phase: 5, type: "err", log: `Relevância falhou: ${(e as Error).message}` }); }
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
