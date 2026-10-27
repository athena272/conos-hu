import { describe, expect, it, vi } from "vitest";
import {
  lazyAuthenticatedPages,
  preloadAuthenticatedPage,
} from "./lazyAuthenticatedPages";

vi.mock("../pages/Home", () => ({
  default: function MockHome() {
    return null;
  },
}));

describe("lazyAuthenticatedPages", () => {
  it("expõe um import dinâmico para cada rota autenticada", () => {
    const paths = Object.keys(lazyAuthenticatedPages);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/home",
        "/register-medication",
        "/register-medication-barcode",
        "/retira-medication",
        "/simulador",
        "/pacientes",
        "/estoque-comprometido",
        "/dashboard",
        "/dashboard-stock",
        "/historico",
      ]),
    );
    expect(paths).toHaveLength(10);
  });

  it("preloadAuthenticatedPage resolve um módulo com default exportável", async () => {
    const pageModule = await preloadAuthenticatedPage("/home");
    expect(typeof pageModule.default).toBe("function");
  });
});
