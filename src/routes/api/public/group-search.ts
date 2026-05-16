import { createFileRoute } from "@tanstack/react-router";

/**
 * Busca inteligente de grupos WhatsApp via NVIDIA Qwen3 Coder.
 * SSE streaming em 5 fases.
 */

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "qwen/qwen3-coder-480b-a35b-instruct";

interface FoundGroup { url: string; title?: string; description?: string; relevance?: number }

function sse(obj: unknown) { return `data: ${JSON.stringify(obj)}\n\n`; }

/** Remove tags <think>, blocos markdown e extrai JSON do texto. */
function extractJSON<T = unknown>(raw: string): T | null {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  s = s.replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1").trim();
  const firstBrace = s.search(/[\[{]/);
  if (firstBrace === -1) return null;
  const opener = s[firstBrace];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  for (let i = firstBrace; i < s.length; i++) {
    if (s[i] === opener) depth++;
    else if (s[i] === closer) { depth--; if (depth === 0) { try { return JSON.parse(s.slice(firstBrace, i + 1)); } catch { return null; } } }
  }
  return null;
}

async function nvidia(messages: Array<{ role: string; content: string }>, key: string): Promise<string> {
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 2048, temperature: 0.3, stream: false }),
  });
  if (!res.ok) throw new Error(`NVIDIA ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? "";
}

const WA_LINK = /https?:\/\/chat\.whatsapp\.com\/(?:invite\/)?[A-Za-z0-9]{8,}/g;
const DIRECTORY_SITES = [
  "https://gruposwhats.app",
  "https://www.grupowhats.com",
];

export const Route = createFileRoute("/api/public/group-search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
          return new Response(sse({ error: "NVIDIA_API_KEY ausente" }), { headers: { "Content-Type": "text/event-stream" } });
        }
        let body: { query?: string };
        try { body = await request.json(); } catch { return new Response("bad json", { status: 400 }); }
        const query = (body.query ?? "").toString().slice(0, 300);
        if (!query) return new Response("query required", { status: 400 });

        const stream = new ReadableStream({
          async start(ctrl) {
            const enc = new TextEncoder();
            const send = (o: unknown) => ctrl.enqueue(enc.encode(sse(o)));
            const found = new Map<string, FoundGroup>();

            try {
              // FASE 1 — Estratégia
              send({ phase: 1, type: "info", log: `Gerando estratégia de busca para: "${query}"` });
              let dorks: string[] = [];
              try {
                const out = await nvidia([
                  { role: "system", content: "Você gera dorks Google para encontrar links de grupos WhatsApp públicos. Responda APENAS um array JSON de strings, sem explicação." },
                  { role: "user", content: `Gere 6 dorks Google variadas para encontrar grupos do tipo: "${query}". Use operadores como site:, intext:, inurl:, "chat.whatsapp.com". Responda só com o JSON array.` },
                ], apiKey);
                const parsed = extractJSON<string[]>(out) ?? [];
                dorks = parsed.filter((d) => typeof d === "string").slice(0, 6);
                send({ phase: 1, type: "ok", log: `Estratégia: ${dorks.length} dorks geradas` });
                dorks.forEach((d) => send({ phase: 1, type: "info", log: `  • ${d}` }));
              } catch (e) {
                send({ phase: 1, type: "err", log: `Falha IA: ${(e as Error).message}. Usando dorks padrão.` });
                dorks = [`"${query}" site:chat.whatsapp.com`, `${query} grupo whatsapp`, `inurl:chat.whatsapp.com ${query}`];
              }

              // FASE 2 — Firecrawl Search (web + scrape em uma chamada)
              const fcKey = process.env.FIRECRAWL_API_KEY;
              if (!fcKey) {
                send({ phase: 2, type: "err", log: "FIRECRAWL_API_KEY ausente — pulando busca web" });
              } else {
                send({ phase: 2, type: "info", log: "Buscando via Firecrawl (search + scrape)…" });
                let totalCredits = 0;
                for (const d of dorks) {
                  try {
                    const r = await fetch("https://api.firecrawl.dev/v2/search", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        query: d,
                        limit: 8,
                        scrapeOptions: { formats: ["markdown", "links"], onlyMainContent: true },
                      }),
                      signal: AbortSignal.timeout(45000),
                    });
                    if (!r.ok) {
                      send({ phase: 2, type: "err", log: `  ✗ ${d}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}` });
                      continue;
                    }
                    const j = await r.json() as { data?: { web?: Array<{ url?: string; title?: string; description?: string; markdown?: string; links?: string[] }> }; creditsUsed?: number };
                    const results = j.data?.web ?? [];
                    totalCredits += j.creditsUsed ?? 0;
                    let nNew = 0;
                    for (const res of results) {
                      // 1) URL direta se já for whatsapp
                      if (res.url && WA_LINK.test(res.url)) {
                        WA_LINK.lastIndex = 0;
                        if (!found.has(res.url)) { found.set(res.url, { url: res.url, title: res.title, description: res.description }); send({ group: { url: res.url, title: res.title } }); nNew++; }
                      }
                      // 2) Links extraídos via scrape
                      for (const l of res.links ?? []) {
                        WA_LINK.lastIndex = 0;
                        if (WA_LINK.test(l) && !found.has(l)) { found.set(l, { url: l }); send({ group: { url: l } }); nNew++; }
                      }
                      // 3) Links no markdown
                      for (const m of (res.markdown ?? "").matchAll(WA_LINK)) {
                        if (!found.has(m[0])) { found.set(m[0], { url: m[0] }); send({ group: { url: m[0] } }); nNew++; }
                      }
                    }
                    send({ phase: 2, type: "info", log: `  ✓ ${d} → ${results.length} resultados, +${nNew} grupos` });
                  } catch (e) { send({ phase: 2, type: "err", log: `  ✗ ${d}: ${(e as Error).message}` }); }
                }
                send({ phase: 2, type: "ok", log: `Firecrawl: ${found.size} grupos · ${totalCredits} créditos usados` });
              }

              // FASE 3 — (mesclada na 2 via scrapeOptions)
              send({ phase: 3, type: "ok", log: "Deep scrape já incluído na fase anterior (Firecrawl)" });

              // FASE 4 — Diretórios
              send({ phase: 4, type: "info", log: "Varrendo sites diretório…" });
              for (const site of DIRECTORY_SITES) {
                try {
                  const r = await fetch(`${site}/?s=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) });
                  const html = await r.text();
                  for (const m of html.matchAll(WA_LINK)) if (!found.has(m[0])) { found.set(m[0], { url: m[0] }); send({ group: { url: m[0] } }); }
                  send({ phase: 4, type: "info", log: `  ✓ ${new URL(site).hostname}` });
                } catch { send({ phase: 4, type: "err", log: `  ✗ ${site}` }); }
              }
              send({ phase: 4, type: "ok", log: `Total: ${found.size}` });

              // FASE 5 — Enriquecimento IA
              const list = [...found.values()];
              if (list.length > 0) {
                send({ phase: 5, type: "info", log: "Enriquecendo com IA (relevância + descrição)…" });
                try {
                  const out = await nvidia([
                    { role: "system", content: "Você infere título curto, descrição (1 frase) e relevância 0-1 para links de grupo WhatsApp baseado no tema da busca. Responda APENAS um array JSON de objetos {url,title,description,relevance}." },
                    { role: "user", content: `Tema: "${query}". Links: ${JSON.stringify(list.slice(0, 30).map((g) => g.url))}. Retorne só o JSON array.` },
                  ], apiKey);
                  const enriched = extractJSON<FoundGroup[]>(out) ?? [];
                  for (const e of enriched) {
                    if (e.url && found.has(e.url)) {
                      found.set(e.url, { ...found.get(e.url)!, title: e.title, description: e.description, relevance: e.relevance });
                    }
                  }
                  send({ phase: 5, type: "ok", log: `${enriched.length} grupos enriquecidos` });
                } catch (e) { send({ phase: 5, type: "err", log: `Enriquecimento falhou: ${(e as Error).message}` }); }
              }

              const finalList = [...found.values()].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
              send({ groups: finalList, done: true, total: finalList.length });
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
