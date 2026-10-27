// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Menu from "./index";

const navigateMock = vi.fn();
const preloadMock = vi.fn(() => Promise.resolve({ default: () => null }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../auth/session", () => ({
  clearAuth: vi.fn(),
  sessionCanWriteMedications: () => true,
  sessionCanWithdrawMedications: () => true,
}));

vi.mock("../../routes/lazyAuthenticatedPages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../routes/lazyAuthenticatedPages")>();
  return {
    ...actual,
    preloadAuthenticatedPage: (...args: unknown[]) => preloadMock(...args),
  };
});

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <Menu />
    </MemoryRouter>,
  );
}

describe("Menu", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    preloadMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("navega com o roteador ao clicar em Home, sem href absoluto da rota", async () => {
    const user = userEvent.setup();
    renderMenu();

    const homeLink = screen.getByRole("link", { name: /Home/i });
    expect(homeLink.getAttribute("href")).toBe("#");

    await user.click(homeLink);

    expect(navigateMock).toHaveBeenCalledWith("/home");
    expect(preloadMock).toHaveBeenCalledWith("/home");
  });

  it("não reintroduz navegação por url nos itens de rota de topo", () => {
    renderMenu();

    for (const label of [/Home/i, /Histórico/i]) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toBe("#");
    }
  });
});
