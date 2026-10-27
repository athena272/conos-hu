import type { ComponentType } from "react";

type PageModule = { default: ComponentType };

/**
 * Fonte única dos imports dinâmicos das telas autenticadas.
 * Usado por `React.lazy` nas rotas e por preload na navegação do menu.
 */
export const lazyAuthenticatedPages = {
  "/home": () => import("../pages/Home"),
  "/register-medication": () => import("../pages/RegisterMedication"),
  "/register-medication-barcode": () => import("../pages/RegisterMedicationByBarcode"),
  "/retira-medication": () => import("../pages/RetiraMedication"),
  "/simulador": () => import("../pages/Simulador"),
  "/pacientes": () => import("../pages/Pacientes"),
  "/estoque-comprometido": () => import("../pages/EstoqueComprometido"),
  "/dashboard": () => import("../pages/Dashboard"),
  "/dashboard-stock": () => import("../pages/DashboardStock"),
  "/historico": () => import("../pages/Historico"),
} as const satisfies Record<string, () => Promise<PageModule>>;

export type AuthenticatedPath = keyof typeof lazyAuthenticatedPages;

/** Dispara o download do chunk da tela sem montá-la (idempotente se já estiver em cache). */
export function preloadAuthenticatedPage(path: AuthenticatedPath): Promise<PageModule> {
  return lazyAuthenticatedPages[path]();
}
