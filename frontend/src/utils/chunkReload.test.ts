// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RELOAD_COOLDOWN_MS, setupChunkReload, shouldAttemptReload } from "./chunkReload";
import { reloadPage } from "./reloadPage";

vi.mock("./reloadPage", () => ({ reloadPage: vi.fn() }));

describe("shouldAttemptReload", () => {
  const now = 1_000_000;

  it("permite o primeiro reload", () => {
    expect(shouldAttemptReload(null, now)).toBe(true);
  });

  it("bloqueia um novo reload dentro do cooldown", () => {
    expect(shouldAttemptReload(now - 1, now)).toBe(false);
    expect(shouldAttemptReload(now - (RELOAD_COOLDOWN_MS - 1), now)).toBe(false);
  });

  it("libera o reload depois do cooldown", () => {
    expect(shouldAttemptReload(now - RELOAD_COOLDOWN_MS, now)).toBe(true);
  });

  it("não trava o reload se o relógio voltou no tempo", () => {
    expect(shouldAttemptReload(now + 5_000, now)).toBe(true);
  });
});

describe("setupChunkReload", () => {
  beforeAll(() => {
    setupChunkReload();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function dispatchPreloadError(): Event {
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  it("recarrega quando o Vite não consegue baixar o chunk de uma tela", () => {
    const event = dispatchPreloadError();

    expect(event.defaultPrevented).toBe(true);
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("não entra em loop: falhas seguidas dentro do cooldown recarregam uma única vez", () => {
    dispatchPreloadError();
    dispatchPreloadError();
    dispatchPreloadError();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("volta a recarregar numa falha depois do cooldown (ex.: novo deploy mais tarde)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    dispatchPreloadError();

    vi.setSystemTime(Date.now() + RELOAD_COOLDOWN_MS);
    dispatchPreloadError();

    expect(reloadPage).toHaveBeenCalledTimes(2);
  });

  it("recarrega quando o erro de import dinâmico escapa como rejeição não tratada", () => {
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", {
      value: new TypeError("Failed to fetch dynamically imported module: /assets/Pacientes.js"),
    });
    window.dispatchEvent(event);

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("ignora rejeições que não são de carregamento de chunk", () => {
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: new Error("Network Error") });
    window.dispatchEvent(event);

    expect(reloadPage).not.toHaveBeenCalled();
  });
});
