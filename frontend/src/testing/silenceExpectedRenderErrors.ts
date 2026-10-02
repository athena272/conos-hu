import { vi } from "vitest";

/**
 * Silencia os erros que o React reporta de propósito quando um teste faz uma tela falhar
 * para exercitar um error boundary: o `console.error` do React e o "Uncaught" que o jsdom
 * imprime para o evento `error` da janela. Retorna a função que desfaz o silêncio.
 */
export function silenceExpectedRenderErrors(): () => void {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const preventReport = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener("error", preventReport);

  return () => {
    window.removeEventListener("error", preventReport);
    consoleSpy.mockRestore();
  };
}
