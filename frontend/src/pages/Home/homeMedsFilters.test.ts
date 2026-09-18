import { describe, expect, it } from "vitest";
import { FilterMatchMode } from "primereact/api";
import {
  areHomeMedsFiltersActive,
  createDefaultHomeMedsFilters,
} from "./homeMedsFilters";

describe("createDefaultHomeMedsFilters", () => {
  it("retorna values null com matchModes padrão", () => {
    const defaults = createDefaultHomeMedsFilters();
    expect(defaults.global.value).toBeNull();
    expect(defaults.nome.value).toBeNull();
    expect(defaults.status.value).toBeNull();
    expect(defaults.global.matchMode).toBe(FilterMatchMode.CONTAINS);
    expect(defaults.nome.matchMode).toBe(FilterMatchMode.STARTS_WITH);
    expect(defaults.status.matchMode).toBe(FilterMatchMode.EQUALS);
  });
});

describe("areHomeMedsFiltersActive", () => {
  it("retorna false quando busca e status estão vazios", () => {
    expect(areHomeMedsFiltersActive("", null)).toBe(false);
    expect(areHomeMedsFiltersActive("   ", null)).toBe(false);
  });

  it("detecta busca ou status", () => {
    expect(areHomeMedsFiltersActive("dipirona", null)).toBe(true);
    expect(areHomeMedsFiltersActive("", "emEstoque")).toBe(true);
    expect(areHomeMedsFiltersActive("x", "emFalta")).toBe(true);
  });
});
