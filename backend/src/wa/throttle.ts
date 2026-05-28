/**
 * Termômetro conservador para adição de membros.
 *   verde: ≤5 adds/grupo/dia
 *   amarelo: 6-15
 *   vermelho: 16+
 * Contas com <7 dias dividem limites por 2.
 * Pausa randômica entre adds: 60-180s.
 */
export type Risk = "green" | "yellow" | "red";

export function riskFor(count: number, accountAgeDays = 30): Risk {
  const f = accountAgeDays < 7 ? 2 : 1;
  if (count * f <= 5) return "green";
  if (count * f <= 15) return "yellow";
  return "red";
}

export function randomPause(): number {
  // 60-180s em produção
  return 60000 + Math.floor(Math.random() * 120000);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
