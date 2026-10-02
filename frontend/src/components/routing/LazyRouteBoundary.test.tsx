// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { lazy, type ComponentType, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceExpectedRenderErrors } from "../../testing/silenceExpectedRenderErrors";
import { LazyRouteBoundary, ROUTE_LOADING_MESSAGE } from "./LazyRouteBoundary";

vi.mock("../../utils/reloadPage", () => ({ reloadPage: vi.fn() }));

type PageModule = { default: ComponentType };

/** Tela `lazy` cujo carregamento o teste controla: só termina quando `resolvePage` é chamado. */
function createDeferredPage() {
  let resolvePage!: (module: PageModule) => void;
  const pageModule = new Promise<PageModule>((resolve) => {
    resolvePage = resolve;
  });
  return { Page: lazy(() => pageModule), resolvePage };
}

function renderInRoute(children: ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/pacientes"]}>
      <LazyRouteBoundary>{children}</LazyRouteBoundary>
    </MemoryRouter>,
  );
}

describe("LazyRouteBoundary", () => {
  let restoreErrorReporting: () => void;

  beforeEach(() => {
    restoreErrorReporting = silenceExpectedRenderErrors();
  });

  afterEach(() => {
    cleanup();
    restoreErrorReporting();
  });

  it("avisa que a tela está carregando enquanto o arquivo dela é baixado", () => {
    const { Page } = createDeferredPage();
    renderInRoute(<Page />);

    const loader = screen.getByRole("status");
    expect(loader.getAttribute("aria-busy")).toBe("true");
    expect(loader.textContent).toContain(ROUTE_LOADING_MESSAGE);
  });

  it("troca o loader pela tela quando o arquivo termina de carregar", async () => {
    const { Page, resolvePage } = createDeferredPage();
    renderInRoute(<Page />);
    expect(screen.getByRole("status")).toBeTruthy();

    await act(async () => {
      resolvePage({ default: () => <h2>Pacientes</h2> });
    });

    expect(screen.getByRole("heading", { name: "Pacientes" })).toBeTruthy();
    expect(screen.queryByText(ROUTE_LOADING_MESSAGE)).toBeNull();
  });

  it("mostra o aviso de erro, e não uma tela em branco, quando o arquivo falha", async () => {
    const FailingPage = lazy(() =>
      Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
    );
    renderInRoute(<FailingPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível abrir esta tela.");
    expect(screen.queryByText(ROUTE_LOADING_MESSAGE)).toBeNull();
  });
});
