import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouteTree } from "../../AppRouters";
import type { AuthSession } from "../auth/session";
import { DEVELOPER_CONTACT_LABEL } from "../components/layout/AppFooter";
import { copyrightNotice } from "../config/developer";

const FOOTER_NAV = `<nav aria-label="${DEVELOPER_CONTACT_LABEL}">`;

const VIEWER_SESSION: AuthSession = {
  token: "token-de-teste",
  userId: 1,
  email: "viewer@conos.test",
  role: "viewer",
};

function renderRoute(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppRouteTree />
    </MemoryRouter>,
  );
}

/** Simula o `localStorage` do navegador com uma sessão já autenticada. */
function signIn(session: AuthSession) {
  const storage = new Map([["auth", JSON.stringify(session)]]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
}

describe("rodapé nas rotas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["/login", "<h1>Login</h1>"],
    ["/register", "<h1>Inscreva-se</h1>"],
    ["/rota-que-nao-existe", "<h1>404</h1>"],
  ])("aparece em %s sem substituir o conteúdo da página", (path, pageHeading) => {
    const html = renderRoute(path);

    expect(html).toContain(pageHeading);
    expect(html).toContain(FOOTER_NAV);
    expect(html).toContain(copyrightNotice());
  });

  it.each(["/login", "/register"])("fica no fim da coluna do formulário em %s", (path) => {
    const html = renderRoute(path);

    expect(html).toContain('class="auth-hero-image"');
    expect(html).toContain('<footer class="app-footer auth-layout-footer">');
  });

  it("aparece uma única vez nas telas autenticadas, fixo abaixo do conteúdo", () => {
    signIn(VIEWER_SESSION);
    const html = renderRoute("/simulador");

    expect(html).toContain('class="menu-container"');
    expect(html).toContain('<footer class="app-footer authenticated-layout-footer">');
    expect(html.split(FOOTER_NAV)).toHaveLength(2);
    expect(html.indexOf('class="authenticated-layout-content"')).toBeLessThan(
      html.indexOf("<footer"),
    );
  });
});
