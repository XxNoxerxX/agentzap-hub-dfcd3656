/**
 * Cliente HTTP do backend AgentZap (openwa na VPS).
 * URL e token vêm de localStorage (configurável em /configuracoes).
 */

const URL_KEY = "agentzap.backend.url";
const TOKEN_KEY = "agentzap.backend.token";

export function getBackendConfig() {
  if (typeof window === "undefined") return { url: "", token: "" };
  return {
    url: localStorage.getItem(URL_KEY) ?? "",
    token: localStorage.getItem(TOKEN_KEY) ?? "",
  };
}

export function setBackendConfig(url: string, token: string) {
  localStorage.setItem(URL_KEY, url.replace(/\/$/, ""));
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event("agentzap:backend-config"));
}

export function clearBackendConfig() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("agentzap:backend-config"));
}

export function isBackendConfigured() {
  const { url, token } = getBackendConfig();
  return !!url && !!token;
}

export class BackendError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { url, token } = getBackendConfig();
  if (!url) throw new BackendError(0, "Backend não configurado. Vá em Configurações.");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.auth !== false) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${url}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new BackendError(res.status, body?.error ?? res.statusText);
  return body as T;
}

export async function pingBackend(url: string): Promise<{ ok: true; ts: number }> {
  const res = await fetch(`${url.replace(/\/$/, "")}/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
