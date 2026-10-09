import { describe, expect, it } from "vitest";
import { getDataTableEmptyMessage } from "./dataTableMessages";

describe("getDataTableEmptyMessage", () => {
  const base = {
    emptyLabel: "Nenhum item encontrado.",
  };

  it("prioriza loading sobre error e empty", () => {
    expect(
      getDataTableEmptyMessage({
        ...base,
        loading: true,
        error: "Falha",
      }),
    ).toBe("Carregando...");
  });

  it("usa loadingLabel customizado", () => {
    expect(
      getDataTableEmptyMessage({
        ...base,
        loading: true,
        error: null,
        loadingLabel: "Buscando medicamentos...",
      }),
    ).toBe("Buscando medicamentos...");
  });

  it("exibe erro quando não está loading", () => {
    const msg = getDataTableEmptyMessage({
      ...base,
      loading: false,
      error: "Erro de rede.",
    });
    expect(msg).toContain("Não foi possível carregar");
    expect(msg).toContain("Erro de rede.");
  });

  it("retorna emptyLabel quando idle sem erro", () => {
    expect(
      getDataTableEmptyMessage({
        ...base,
        loading: false,
        error: null,
      }),
    ).toBe("Nenhum item encontrado.");
  });
});
