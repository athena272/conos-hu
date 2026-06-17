/**
 * Rede de segurança pós-deploy: quando uma aba aberta tenta carregar um chunk
 * antigo que não existe mais (após novo deploy), força um único reload para
 * buscar o index.html novo e os bundles atualizados.
 *
 * Usa flag em sessionStorage para evitar loop de reload em falhas persistentes.
 */
const RELOAD_FLAG = "conos:chunk-reloaded";

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

function reloadOnce(): void {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    // sessionStorage indisponível: ainda assim tenta recarregar uma vez
  }
  window.location.reload();
}

/** Limpa a flag após um carregamento bem-sucedido, liberando reload futuro. */
function clearFlagOnLoad(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    // ignore
  }
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

  window.addEventListener("load", clearFlagOnLoad);
}
