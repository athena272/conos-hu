import { describe, expect, it } from "vitest";
import { shouldShowLoading } from "./useApiQuery";

describe("shouldShowLoading", () => {
  it("mostra loading na primeira carga (sem dados)", () => {
    expect(shouldShowLoading(false, false)).toBe(true);
    expect(shouldShowLoading(true, false)).toBe(true);
  });

  it("reload silencioso com dados existentes não mostra loading", () => {
    expect(shouldShowLoading(true, true)).toBe(false);
  });

  it("reload não silencioso mostra loading mesmo com dados", () => {
    expect(shouldShowLoading(false, true)).toBe(true);
  });
});
