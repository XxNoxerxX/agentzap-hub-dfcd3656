import { useEffect, useState } from "react";
import { getBackendConfig, pingBackend } from "@/lib/api-client";

export function useBackendStatus(pollMs = 15000) {
  const [status, setStatus] = useState<"unknown" | "online" | "offline" | "unconfigured">("unknown");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { url } = getBackendConfig();
      if (!url) { if (!cancelled) setStatus("unconfigured"); return; }
      try {
        await pingBackend(url);
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }
    check();
    const t = setInterval(check, pollMs);
    const h = () => check();
    window.addEventListener("agentzap:backend-config", h);
    return () => { cancelled = true; clearInterval(t); window.removeEventListener("agentzap:backend-config", h); };
  }, [pollMs]);

  return status;
}
