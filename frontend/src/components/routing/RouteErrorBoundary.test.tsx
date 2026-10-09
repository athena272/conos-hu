// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { silenceExpectedRenderErrors } from "../../testing/silenceExpectedRenderErrors";
import { reloadPage } from "../../utils/reloadPage";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

vi.mock("../../utils/reloadPage", () => ({ reloadPage: vi.fn() }));

/** Simula o arquivo de uma tela que não existe mais depois de um novo deploy. */
const MissingChunkPage = lazy(() =>
  Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
);

function renderWithBoundary(routeKey: string) {
  return render(
    <RouteErrorBoundary key={routeKey}>
      <Suspense fallback={<p>Carregando...</p>}>
        <MissingChunkPage />
      </Suspense>
    </RouteErrorBoundary>,
  );
}

describe("RouteErrorBoundary", () => {
  let restoreErrorReporting: () => void;

  beforeEach(() => {
    restoreErrorReporting = silenceExpectedRenderErrors();
  });

  afterEach(() => {
    cleanup();
    restoreErrorReporting();
    vi.clearAllMocks();
  });

  it("mostra o conteúdo quando nada falha", () => {
    render(
      <RouteErrorBoundary>
        <p>Tela de pacientes</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText("Tela de pacientes")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("troca a tela em branco por um aviso quando o arquivo da tela não carrega", async () => {
    const user = userEvent.setup();
    renderWithBoundary("/pacientes");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível abrir esta tela.");

    await user.click(screen.getByRole("button", { name: "Recarregar página" }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("limpa o erro ao trocar de rota", async () => {
    const { rerender } = renderWithBoundary("/pacientes");
    await screen.findByRole("alert");

    rerender(
      <RouteErrorBoundary key="/historico">
        <p>Tela de histórico</p>
      </RouteErrorBoundary>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Tela de histórico")).toBeTruthy();
  });
});
