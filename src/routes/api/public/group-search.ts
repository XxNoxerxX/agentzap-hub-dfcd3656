import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Busca agentic de grupos WhatsApp — multi-fonte.
 * F0 Expansão IA · F1 Estratégia · F2 Busca paralela (Brave + Firecrawl + DuckDuckGo + Diretórios)
 * F3 Validação com cache · F4 Refinamento · F5 Relevância estrita.
 */

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";

// Sites diretório de grupos WhatsApp (alta densidade de invites)
const DIRECTORY_SITES = [
  "grupowhats.com",
  "gruposwhats.com.br",
  "gruposdozap.com",
  "whatsgrouplink.com",
  "grupowapp.com",
  "wagrupos.com.br",
  "gruposparawhatsapp.com.br",
  "linkdegrupos.com.br",
  "grupowhatsapp.net",
  "chat-whatsapp.com",
  "whatsappgrupos.com.br",
  "grupozap.net",
];

const SHORTENER_HOSTS = ["bit.ly", "cutt.ly", "tinyurl.com", "encurtador.com.br", "is.gd", "rb.gy", "shorturl.at", "t.ly"];

type GroupStatus = "active" | "revoked" | "unknown";
type Source = "brave" | "firecrawl" | "duckduckgo" | "directory" | "cache";
interface FoundGroup {
  url: string;
  code: string;
  title?: string;
  description?: string;
  image?: string;
  status: GroupStatus;
  relevance?: number;
  reason?: string;
  sources?: Source[];
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
const SHORTENER_RE = new RegExp(`https?:\\/\\/(?:${SHORTENER_HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|")})\\/[A-Za-z0-9_\\-]+`, "gi");

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

async function resolveShortener(shortUrl: string): Promise<{ url: string; code: string } | null> {
  try {
    const res = await fetch(shortUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const final = res.url;
    const m = final.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{8,})/);
    if (m) return { url: `https://chat.whatsapp.com/${m[1]}`, code: m[1] };
    return null;
  } catch { return null; }
}

// ============ FONTES DE BUSCA ============

async function braveSearch(query: string, key: string): Promise<{ url: string; title?: string; description?: string }[]> {
  const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=20&safesearch=off&country=BR`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json", "Accept-Encoding": "gzip" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const j = await res.json() as { web?: { results?: Array<{ url: string; title?: string; description?: string }> } };
  return j.web?.results ?? [];
}

async function firecrawlSearch(query: string, key: string, limit = 15): Promise<{ url: string; title?: string; description?: string; markdown?: string }[]> {
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  const j = await res.json() as { data?: { web?: Array<{ url: string; title?: string; description?: string; markdown?: string }> } | Array<{ url: string; title?: string; description?: string; markdown?: string }> };
  if (Array.isArray(j.data)) return j.data;
  return j.data?.web ?? [];
}

async function duckduckgoSearch(query: string): Promise<{ url: string; title?: string; description?: string }[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
  const html = await res.text();
  const out: { url: string; title?: string; description?: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let url = m[1];
    // DuckDuckGo wraps URLs: /l/?uddg=...
    const wrap = url.match(/uddg=([^&]+)/);
    if (wrap) try { url = decodeURIComponent(wrap[1]); } catch { /* ignore */ }
    out.push({
      url,
      title: m[2].replace(/<[^>]+>/g, "").trim(),
      description: m[3].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return out;
}

// ============ VALIDAÇÃO COM CACHE ============

async function validateInviteRaw(code: string): Promise<{ status: GroupStatus; title?: string; description?: string; image?: string }> {
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

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

async function validateInviteCached(code: string): Promise<{ status: GroupStatus; title?: string; description?: string; image?: string; cached: boolean }> {
  try {
    const { data } = await supabaseAdmin
      .from("validated_invites")
      .select("status,title,description,image,last_checked_at")
      .eq("code", code)
      .maybeSingle();
    if (data && new Date(data.last_checked_at).getTime() > Date.now() - CACHE_TTL_MS) {
      return {
        status: data.status as GroupStatus,
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        image: data.image ?? undefined,
        cached: true,
      };
    }
  } catch { /* fall through */ }

  const v = await validateInviteRaw(code);
  // Persiste async (não bloqueia)
  supabaseAdmin.from("validated_invites").upsert({
    code,
    status: v.status,
    title: v.title ?? null,
    description: v.description ?? null,
    image: v.image ?? null,
    last_checked_at: new Date().toISOString(),
  }).then(() => { /* ok */ }, () => { /* ignore */ });
  return { ...v, cached: false };
}

// ============ DORKS PADRÃO ============

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
  brief: string;
  positiveTerms: string[];
  negativeTerms: string[];
  keywordVariants: string[];
  suggestions: string[];
}

export const Route = createFileRoute("/api/public/group-search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const nvidiaKey = process.env.NVIDIA_API_KEY;
        const braveKey = process.env.BRAVE_API_KEY;
        const firecrawlKey = process.env.FIRECRAWL_API_KEY;

        let body: { query?: string; depth?: number; context?: string };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        const query = (body.query ?? "").toString().slice(0, 300).trim();
        const context = (body.context ?? "").toString().slice(0, 500).trim();
        const depth = Math.max(1, Math.min(5, body.depth ?? 5));
        if (!query) return new Response("query required", { status: 400 });

        const stream = new ReadableStream({
          async start(ctrl) {
            const enc = new TextEncoder();
            const send = (o: unknown) => { try { ctrl.enqueue(enc.encode(sse(o))); } catch { /* closed */ } };
            const found = new Map<string, FoundGroup>();
            const shortenersSeen = new Set<string>();

            const addSource = (code: string, src: Source) => {
              const g = found.get(code);
              if (!g) return;
              if (!g.sources) g.sources = [];
              if (!g.sources.includes(src)) g.sources.push(src);
            };
            const emit = (g: FoundGroup, src: Source) => {
              const existing = found.get(g.code);
              if (existing) { addSource(g.code, src); return false; }
              g.sources = [src];
              found.set(g.code, g);
              send({ group: g });
              return true;
            };

            try {
              if (!braveKey && !firecrawlKey) {
                send({ error: "Nenhuma fonte de busca configurada (BRAVE_API_KEY ou FIRECRAWL_API_KEY)" });
                return;
              }

              // ============ FASE 0 — Expansão de tema ============
              let expansion: ExpansionBrief = {
                brief: query + (context ? ` — contexto: ${context}` : ""),
                positiveTerms: [query],
                negativeTerms: [],
                keywordVariants: [],
                suggestions: [],
              };

              if (nvidiaKey) {
                send({ phase: 0, type: "info", log: `Expandindo tema "${query}"…` });
                try {
                  const out = await nvidia([
                    { role: "system", content: "Você é especialista em pesquisa semântica e desambiguação. Responda APENAS JSON." },
                    { role: "user", content: `Palavra-chave: "${query}"
${context ? `Contexto: "${context}"` : "Sem contexto extra."}

Retorne JSON:
{
  "brief": "...descrição rica (1-3 frases)...",
  "positiveTerms": ["...","..."],  // 10-20 sinônimos/variantes
  "negativeTerms": ["...","..."],  // 5-15 termos off-topic
  "keywordVariants": ["...","..."], // 6-10 queries alternativas mais específicas
  "suggestions": ["...","..."]      // 3-5 dicas curtas pro usuário
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
                  send({ phase: 1, type: "info", log: `Gerando ${dorkTargetByDepth} dorks…` });
                  const out = await nvidia([
                    { role: "system", content: "Você gera dorks PRECISAS para Google/Brave. Responda APENAS array JSON." },
                    { role: "user", content: `BRIEF: ${expansion.brief}
TERMOS POSITIVOS: ${expansion.positiveTerms.join(", ")}
NEGATIVOS (use -termo): ${expansion.negativeTerms.join(", ")}

Gere ${dorkTargetByDepth} dorks (PT/EN/ES) combinando termos+operadores: site:chat.whatsapp.com, inurl:, intext:, intitle:, aspas em frases, -negativos. Inclua reddit, facebook/groups, t.me, pastebin, github. JSON array só.` },
                  ], nvidiaKey, 3500);
                  dorks = (extractJSON<string[]>(out) ?? []).filter((d) => typeof d === "string" && d.length > 3).slice(0, dorkTargetByDepth);
                  send({ phase: 1, type: "ok", log: `${dorks.length} dorks geradas` });
                } catch (e) {
                  send({ phase: 1, type: "err", log: `IA falhou: ${(e as Error).message}. Padrão.` });
                }
              }
              if (dorks.length === 0) dorks = DEFAULT_DORKS(query);

              // Variantes de query (até 4 + a original)
              const variants = [query, ...expansion.keywordVariants.slice(0, depth >= 4 ? 4 : depth >= 2 ? 2 : 0)];
              send({ phase: 1, type: "ok", log: `${variants.length} variante(s) de query · ${DIRECTORY_SITES.length} diretórios` });
              variants.forEach((v) => send({ phase: 1, type: "info", log: `  ≫ "${v}"` }));

              // Helper genérico pra processar resultados de qualquer fonte
              const processResults = async (
                results: { url: string; title?: string; description?: string; markdown?: string }[],
                source: Source,
              ): Promise<number> => {
                let nNew = 0;
                for (const r of results) {
                  const blob = `${r.url} ${r.title ?? ""} ${r.description ?? ""} ${r.markdown ?? ""}`;
                  for (const { url, code } of extractWaLinks(blob)) {
                    if (emit({ url, code, title: r.title, description: r.description, status: "unknown" }, source)) nNew++;
                    else addSource(code, source);
                  }
                  // Coletar shorteners pra resolver depois
                  for (const m of blob.matchAll(SHORTENER_RE)) shortenersSeen.add(m[0]);
                }
                return nNew;
              };

              // ============ FASE 2 — Busca paralela multi-fonte ============
              send({ phase: 2, type: "info", log: `Busca paralela em 4 fontes…` });

              const tasks: Promise<void>[] = [];

              // Brave: roda todas as dorks com as variantes (limita pra não explodir rate)
              if (braveKey) {
                const braveDorks = dorks.slice(0, Math.min(dorks.length, dorkTargetByDepth));
                tasks.push((async () => {
                  let total = 0;
                  for (let i = 0; i < braveDorks.length; i++) {
                    const d = braveDorks[i];
                    try {
                      const r = await braveSearch(d, braveKey);
                      const n = await processResults(r, "brave");
                      total += n;
                      if (n > 0) send({ phase: 2, type: "ok", log: `🦁 Brave [${i + 1}/${braveDorks.length}] +${n} · "${d.slice(0, 55)}"` });
                      await new Promise((r) => setTimeout(r, 1100));
                    } catch (e) {
                      send({ phase: 2, type: "err", log: `🦁 ${(e as Error).message.slice(0, 80)}` });
                      await new Promise((r) => setTimeout(r, 1500));
                    }
                  }
                  send({ phase: 2, type: "ok", log: `🦁 Brave concluído: +${total} grupos` });
                })());
              }

              // Firecrawl: roda nas variantes (Google index, mais grupos por query)
              if (firecrawlKey) {
                tasks.push((async () => {
                  let total = 0;
                  for (let i = 0; i < variants.length; i++) {
                    const v = variants[i];
                    // 2 queries por variante: uma genérica, outra com site:chat.whatsapp.com
                    const queries = [
                      `${v} grupo whatsapp link convite`,
                      `"${v}" "chat.whatsapp.com"`,
                    ];
                    for (const q of queries) {
                      try {
                        const r = await firecrawlSearch(q, firecrawlKey, 15);
                        const n = await processResults(r, "firecrawl");
                        total += n;
                        if (n > 0) send({ phase: 2, type: "ok", log: `🔥 Firecrawl +${n} · "${q.slice(0, 55)}"` });
                      } catch (e) {
                        send({ phase: 2, type: "err", log: `🔥 ${(e as Error).message.slice(0, 80)}` });
                      }
                      await new Promise((r) => setTimeout(r, 600));
                    }
                  }
                  send({ phase: 2, type: "ok", log: `🔥 Firecrawl concluído: +${total} grupos` });
                })());

                // Sites diretório via Firecrawl (site:domain query)
                tasks.push((async () => {
                  let total = 0;
                  for (const site of DIRECTORY_SITES) {
                    try {
                      const r = await firecrawlSearch(`site:${site} ${query}`, firecrawlKey, 10);
                      const n = await processResults(r, "directory");
                      total += n;
                      if (n > 0) send({ phase: 2, type: "ok", log: `📚 ${site} +${n}` });
                    } catch (e) {
                      send({ phase: 2, type: "err", log: `📚 ${site}: ${(e as Error).message.slice(0, 60)}` });
                    }
                    await new Promise((r) => setTimeout(r, 500));
                  }
                  send({ phase: 2, type: "ok", log: `📚 Diretórios concluídos: +${total} grupos` });
                })());
              }

              // DuckDuckGo: roda nas variantes (grátis, fallback robusto)
              tasks.push((async () => {
                let total = 0;
                for (const v of variants) {
                  const queries = [`${v} chat.whatsapp.com`, `${v} grupo whatsapp link`];
                  for (const q of queries) {
                    try {
                      const r = await duckduckgoSearch(q);
                      const n = await processResults(r, "duckduckgo");
                      total += n;
                      if (n > 0) send({ phase: 2, type: "ok", log: `🦆 DDG +${n} · "${q.slice(0, 55)}"` });
                    } catch (e) {
                      send({ phase: 2, type: "err", log: `🦆 ${(e as Error).message.slice(0, 60)}` });
                    }
                    await new Promise((r) => setTimeout(r, 1500));
                  }
                }
                send({ phase: 2, type: "ok", log: `🦆 DuckDuckGo concluído: +${total} grupos` });
              })());

              await Promise.allSettled(tasks);
              send({ phase: 2, type: "ok", log: `Total único: ${found.size} grupos · ${shortenersSeen.size} shorteners` });

              // Resolver shorteners
              if (shortenersSeen.size > 0) {
                send({ phase: 2, type: "info", log: `Resolvendo ${shortenersSeen.size} encurtadores…` });
                let resolved = 0;
                const shortList = [...shortenersSeen].slice(0, 50);
                const results = await Promise.allSettled(shortList.map(resolveShortener));
                for (const r of results) {
                  if (r.status === "fulfilled" && r.value) {
                    if (emit({ url: r.value.url, code: r.value.code, status: "unknown" }, "directory")) resolved++;
                  }
                }
                send({ phase: 2, type: "ok", log: `+${resolved} grupos via encurtadores` });
              }

              // ============ FASE 3 — Validação com cache ============
              const toValidate = [...found.values()];
              send({ phase: 3, type: "info", log: `Validando ${toValidate.length} convites (cache + WhatsApp)…` });
              let active = 0, revoked = 0, unknown = 0, cached = 0;
              const BATCH = 8;
              for (let i = 0; i < toValidate.length; i += BATCH) {
                const batch = toValidate.slice(i, i + BATCH);
                await Promise.all(batch.map(async (g) => {
                  const v = await validateInviteCached(g.code);
                  if (v.cached) cached++;
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
                send({ phase: 3, type: "info", log: `  ${Math.min(i + BATCH, toValidate.length)}/${toValidate.length} · ✓${active} ✗${revoked} ?${unknown} (cache:${cached})` });
              }
              send({ phase: 3, type: "ok", log: `Validação: ${active} ativos · ${revoked} revogados · ${unknown} ? · ${cached} do cache` });

              // ============ FASE 4 — Refinamento ============
              if (nvidiaKey && depth >= 3 && active > 0 && braveKey) {
                const activeGroups = [...found.values()].filter((g) => g.status === "active").slice(0, 30);
                const refinePasses = depth === 5 ? 2 : 1;
                for (let pass = 1; pass <= refinePasses; pass++) {
                  send({ phase: 4, type: "info", log: `Refinamento ${pass}/${refinePasses} sobre ${activeGroups.length} ativos…` });
                  try {
                    const sample = activeGroups.map((g) => `- ${g.title ?? g.url}${g.description ? ` :: ${g.description.slice(0, 100)}` : ""}`).join("\n");
                    const out = await nvidia([
                      { role: "system", content: "Refine dorks baseado em grupos JÁ ATIVOS. Foco em precisão. Responda APENAS array JSON." },
                      { role: "user", content: `BRIEF: ${expansion.brief}\nGRUPOS ATIVOS:\n${sample}\n\nGere 15 NOVAS dorks ALTAMENTE ESPECÍFICAS (nichos, regionais). JSON array só.` },
                    ], nvidiaKey, 2500);
                    const newDorks = (extractJSON<string[]>(out) ?? []).filter((d) => typeof d === "string").slice(0, 15);
                    const before = found.size;
                    for (let i = 0; i < newDorks.length; i++) {
                      const d = newDorks[i];
                      try {
                        const r = await braveSearch(d, braveKey);
                        const newCodes: string[] = [];
                        for (const res of r) {
                          for (const { url, code } of extractWaLinks(`${res.url} ${res.title ?? ""} ${res.description ?? ""}`)) {
                            if (emit({ url, code, title: res.title, description: res.description, status: "unknown" }, "brave")) newCodes.push(code);
                          }
                        }
                        await Promise.all(newCodes.map(async (code) => {
                          const v = await validateInviteCached(code);
                          const cur = found.get(code)!;
                          const upd = { ...cur, status: v.status, title: v.title ?? cur.title, description: v.description ?? cur.description, image: v.image };
                          found.set(code, upd);
                          send({ groupUpdate: upd });
                        }));
                        if (newCodes.length) send({ phase: 4, type: "ok", log: `  [P${pass} ${i + 1}/${newDorks.length}] +${newCodes.length}` });
                        await new Promise((r) => setTimeout(r, 1100));
                      } catch (e) {
                        send({ phase: 4, type: "err", log: `  ✗ ${(e as Error).message.slice(0, 60)}` });
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
                send({ phase: 5, type: "info", log: `Pontuando ${activeList.length} ativos…` });
                try {
                  const CHUNK = 25;
                  let scoredCount = 0;
                  for (let i = 0; i < activeList.length; i += CHUNK) {
                    const chunk = activeList.slice(i, i + CHUNK);
                    const slim = chunk.map((g, idx) => ({ i: idx, title: g.title, desc: g.description?.slice(0, 200) }));
                    const out = await nvidia([
                      { role: "system", content: `Avalie relevância ESTRITA. Score 0 se off-topic/genérico/menção por acaso. Score 1 se alinhado ao brief. Responda APENAS [{"i":int,"score":float,"reason":"motivo curto"}].` },
                      { role: "user", content: `BRIEF: ${expansion.brief}
POSITIVOS: ${expansion.positiveTerms.join(", ")}
NEGATIVOS (penalize): ${expansion.negativeTerms.join(", ")}

GRUPOS:
${JSON.stringify(slim)}` },
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
                  send({ phase: 5, type: "ok", log: `${scoredCount} pontuados` });
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
