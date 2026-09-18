import { describe, expect, it } from "vitest";
import {
  areHistoricoContentFiltersActive,
  createDefaultHistoricoContentFilters,
} from "./historicoFilters";

describe("areHistoricoContentFiltersActive", () => {
  it("retorna false para defaults", () => {
    expect(
      areHistoricoContentFiltersActive(createDefaultHistoricoContentFilters()),
    ).toBe(false);
  });

  it("retorna false quando busca é só whitespace", () => {
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        searchInput: "   ",
      }),
    ).toBe(false);
  });

  it("detecta ação, entidade, datas e busca", () => {
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        acaoFilter: "criar",
      }),
    ).toBe(true);
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        entidadeFilter: "paciente",
      }),
    ).toBe(true);
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        dataInicio: "2025-01-01",
      }),
    ).toBe(true);
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        dataFim: "2025-01-31",
      }),
    ).toBe(true);
    expect(
      areHistoricoContentFiltersActive({
        ...createDefaultHistoricoContentFilters(),
        searchInput: "admin",
      }),
    ).toBe(true);
  });
});
