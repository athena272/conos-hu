import { describe, expect, it } from "vitest";
import { criarItemCarrinho } from "./retiraCarrinho";
import { formatRetiraLoteErrorMessage, resolveRetiraErrorSeverity } from "./retiraErrors";

function apiError(status: number, data: Record<string, unknown>) {
  return { response: { status, data } };
}

describe("resolveRetiraErrorSeverity", () => {
  it("trata estoque insuficiente e lote vencido como aviso", () => {
    expect(
      resolveRetiraErrorSeverity(apiError(400, { error: "Quantidade insuficiente em estoque" })),
    ).toBe("warn");
    expect(resolveRetiraErrorSeverity(apiError(400, { error: "Lote fora da validade" }))).toBe(
      "warn",
    );
  });

  it("trata os demais como erro", () => {
    expect(resolveRetiraErrorSeverity(apiError(400, { error: "Paciente não encontrado" }))).toBe(
      "error",
    );
    expect(resolveRetiraErrorSeverity(apiError(500, { error: "Erro interno do servidor" }))).toBe(
      "error",
    );
    expect(resolveRetiraErrorSeverity(new Error("Network Error"))).toBe("error");
  });
});

describe("formatRetiraLoteErrorMessage", () => {
  const itens = [
    criarItemCarrinho(
      { id: 1, nome: "Dipirona", concentracao: "500mg", lote: "A1", data_validade: "2027-01-01" },
      2,
      null,
    ),
    criarItemCarrinho(
      { id: 2, nome: "Paracetamol", concentracao: "750mg", lote: "B2", data_validade: "2027-01-01" },
      1,
      null,
    ),
  ];

  it("cita o item apontado por item_index (numeração a partir de 1)", () => {
    expect(
      formatRetiraLoteErrorMessage(
        apiError(400, { error: "Quantidade insuficiente em estoque", item_index: 1 }),
        itens,
      ),
    ).toBe("Item 2 (Paracetamol - Lote B2): Quantidade insuficiente em estoque");
  });

  it("usa só a mensagem quando não há item_index válido", () => {
    expect(formatRetiraLoteErrorMessage(apiError(400, { error: "Falhou" }), itens)).toBe("Falhou");
    expect(
      formatRetiraLoteErrorMessage(apiError(400, { error: "Falhou", item_index: 9 }), itens),
    ).toBe("Falhou");
  });
});
