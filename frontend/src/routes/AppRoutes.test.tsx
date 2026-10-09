import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouteTree } from "../../AppRouters";
import type { AuthSession } from "../auth/session";
import { DEVELOPER_CONTACT_LABEL } from "../components/layout/AppFooter";
import { ROUTE_LOADING_MESSAGE } from "../components/routing/LazyRouteBoundary";
import { copyrightNotice } from "../config/developer";

const FOOTER_NAV = `<nav aria-label="${DEVELOPER_CONTACT_LABEL}">`;

const VIEWER_SESSION: AuthSession = {
  token: "token-de-teste",
  userId: 1,
  email: "viewer@conos.test",
  role: "viewer",
};

/** Admin já identificado: passa pelo `MedicationWriteRoute` sem abrir o `OperatorIdentifyGate`. */
const ADMIN_SESSION: AuthSession = {
  token: "token-de-teste",
  userId: 2,
  email: "admin@conos.test",
  role: "admin",
  operadorNome: "Operador de Teste",
};

/**
 * Renderiza a rota no servidor e só devolve o HTML quando todas as telas `lazy` terminaram
 * de carregar (`onAllReady`). A renderização no servidor não executa effects, então nenhuma
 * página dispara chamadas à API.
 */
function renderRoute(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _encoding, done) {
        html += chunk.toString();
        done();
      },
    });
    sink.on("finish", () => resolve(html));
    sink.on("error", reject);

    const { pipe } = renderToPipeableStream(
      <MemoryRouter initialEntries={[path]}>
        <AppRouteTree />
      </MemoryRouter>,
      {
        onAllReady: () => pipe(sink),
        onShellError: reject,
        onError: reject,
      },
    );
  });
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
  ])("aparece em %s sem substituir o conteúdo da página", async (path, pageHeading) => {
    const html = await renderRoute(path);

    expect(html).toContain(pageHeading);
    expect(html).toContain(FOOTER_NAV);
    expect(html).toContain(copyrightNotice());
  });

  it.each(["/login", "/register"])("fica no fim da coluna do formulário em %s", async (path) => {
    const html = await renderRoute(path);

    expect(html).toContain('class="auth-hero-image"');
    expect(html).toContain('<footer class="app-footer auth-layout-footer">');
  });

  it("aparece uma única vez nas telas autenticadas, fixo abaixo do conteúdo", async () => {
    signIn(VIEWER_SESSION);
    const html = await renderRoute("/simulador");

    expect(html).toContain('class="menu-container"');
    expect(html).toContain('<footer class="app-footer authenticated-layout-footer">');
    expect(html.split(FOOTER_NAV)).toHaveLength(2);
    expect(html.indexOf('class="authenticated-layout-content"')).toBeLessThan(
      html.indexOf("<footer"),
    );
  });
});

describe("telas autenticadas carregadas sob demanda", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["/home", "Medicamentos", VIEWER_SESSION],
    ["/simulador", "Simulador de duração de estoque", VIEWER_SESSION],
    ["/pacientes", "Pacientes", VIEWER_SESSION],
    ["/estoque-comprometido", "Estoque por medicamento (comprometido)", VIEWER_SESSION],
    ["/dashboard", "Painel de Controle", VIEWER_SESSION],
    ["/dashboard-stock", "Painel de Estoque", VIEWER_SESSION],
    ["/historico", "Histórico de ações", VIEWER_SESSION],
    ["/register-medication", "Registrar Medicamento", ADMIN_SESSION],
    ["/register-medication-barcode", "Registrar medicamento (código de barras)", ADMIN_SESSION],
    ["/retira-medication", "Retirar Medicamento", ADMIN_SESSION],
  ])("%s abre a própria tela, e não o loader", async (path, pageTitle, session) => {
    signIn(session);
    const html = await renderRoute(path);

    expect(html).toContain(`<h2>${pageTitle}</h2>`);
    expect(html).toContain('class="menu-container"');
    expect(html).not.toContain(ROUTE_LOADING_MESSAGE);
  });

  it("sem sessão, redireciona sem renderizar a tela nem o loader", async () => {
    const html = await renderRoute("/pacientes");

    expect(html).not.toContain("<h2>Pacientes</h2>");
    expect(html).not.toContain(ROUTE_LOADING_MESSAGE);
  });
});
