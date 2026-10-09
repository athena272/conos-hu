import { reloadPage } from "./reloadPage";

/**
 * Rede de segurança pós-deploy: quando uma aba aberta tenta carregar um chunk
 * antigo que não existe mais (após novo deploy), força um reload para buscar o
 * index.html novo e os bundles atualizados.
 *
 * Guarda em sessionStorage o horário do último reload e não recarrega de novo
 * dentro do cooldown, evitando loop em falhas persistentes. O import de uma tela
 * lazy pode falhar depois do evento `load`, então a proteção não pode depender dele.
 */
const RELOAD_AT_KEY = "conos:chunk-reloaded-at";

export const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
];

function isChunkLoadError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((p) => normalized.includes(p));
}

/** Decide se um novo reload é permitido, dado o horário do último (em ms). */
export function shouldAttemptReload(lastReloadAt: number | null, now: number): boolean {
  if (lastReloadAt === null) return true;
  const elapsed = now - lastReloadAt;
  // Relógio ajustado para trás: não deixa o cooldown travar o reload.
  return elapsed < 0 || elapsed >= RELOAD_COOLDOWN_MS;
}

function readLastReloadAt(): number | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_AT_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function reloadOnce(): void {
  const now = Date.now();
  if (!shouldAttemptReload(readLastReloadAt(), now)) return;
  try {
    sessionStorage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    // sessionStorage indisponível: ainda assim tenta recarregar
  }
  reloadPage();
}

export function setupChunkReload(): void {
  if (typeof window === "undefined") return;

  // Sinal específico do Vite para falha de preload de módulo.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnce();
  });

  // Reforço: erros de import dinâmico que escapam como erro global.
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.message)) {
      reloadOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string } | undefined;
    if (isChunkLoadError(reason?.message)) {
      reloadOnce();
    }
  });
}
