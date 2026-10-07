import { describe, expect, it } from "vitest";
import {
  adicionarItem,
  criarItemCarrinho,
  describeCarrinhoItem,
  quantidadeNoCarrinho,
  removerItem,
  toRetiraLotePayload,
  validarNovoItem,
} from "./retiraCarrinho";
import type { MedicationWithStatus } from "../../types";

const TODAY = "2026-09-25";

function lot(
  partial: Partial<MedicationWithStatus> & Pick<MedicationWithStatus, "id">,
): MedicationWithStatus {
  return {
    nome: "Dipirona",
    lote: `L${partial.id}`,
    classificacao: "",
    concentracao: "500mg",
    forma: "",
    status: "emEstoque",
    data_validade: "2027-01-01",
    quantidade: 10,
    ...partial,
  };
}

const PACIENTE_ANA = { id: 7, label: "Ana · Pront. 123" };

describe("describeCarrinhoItem", () => {
  it("identifica o item pelo nome, concentração e lote", () => {
    const item = criarItemCarrinho(lot({ id: 1, lote: "A1" }), 1, null);
    expect(describeCarrinhoItem(item)).toBe("Dipirona 500mg - Lote A1");
  });

  it("sem concentração cadastrada, usa só o nome e o lote", () => {
    const item = criarItemCarrinho(lot({ id: 1, lote: "A1", concentracao: undefined }), 1, null);
    expect(describeCarrinhoItem(item)).toBe("Dipirona - Lote A1");
  });
});

describe("criarItemCarrinho / adicionarItem", () => {
  it("adiciona itens de lotes diferentes separadamente", () => {
    let itens = adicionarItem([], criarItemCarrinho(lot({ id: 1 }), 2, null));
    itens = adicionarItem(itens, criarItemCarrinho(lot({ id: 2 }), 3, PACIENTE_ANA));

    expect(itens).toHaveLength(2);
    expect(itens[1]).toMatchObject({
      medicationId: 2,
      quantidade: 3,
      pacienteId: 7,
      pacienteLabel: PACIENTE_ANA.label,
    });
  });

  it("soma a quantidade quando lote e paciente são os mesmos", () => {
    let itens = adicionarItem([], criarItemCarrinho(lot({ id: 1 }), 2, PACIENTE_ANA));
    itens = adicionarItem(itens, criarItemCarrinho(lot({ id: 1 }), 3, PACIENTE_ANA));

    expect(itens).toHaveLength(1);
    expect(itens[0]!.quantidade).toBe(5);
  });

  it("mantém separados o mesmo lote para pacientes diferentes", () => {
    let itens = adicionarItem([], criarItemCarrinho(lot({ id: 1 }), 2, PACIENTE_ANA));
    itens = adicionarItem(itens, criarItemCarrinho(lot({ id: 1 }), 1, null));

    expect(itens).toHaveLength(2);
    expect(quantidadeNoCarrinho(itens, 1)).toBe(3);
  });
});

describe("removerItem", () => {
  it("remove apenas o item da chave informada", () => {
    const a = criarItemCarrinho(lot({ id: 1 }), 2, null);
    const b = criarItemCarrinho(lot({ id: 2 }), 1, null);

    expect(removerItem([a, b], a.key)).toEqual([b]);
  });
});

describe("validarNovoItem", () => {
  it("aceita quantidade dentro do estoque", () => {
    expect(validarNovoItem(lot({ id: 1, quantidade: 5 }), 5, [], TODAY)).toBeNull();
  });

  it("rejeita quantidade não positiva ou fracionada", () => {
    expect(validarNovoItem(lot({ id: 1 }), 0, [], TODAY)).toMatch(/maior que 0/);
    expect(validarNovoItem(lot({ id: 1 }), 1.5, [], TODAY)).toMatch(/inteiro/);
  });

  it("rejeita lote vencido ou sem estoque", () => {
    expect(validarNovoItem(lot({ id: 1, data_validade: "2020-01-01" }), 1, [], TODAY)).toMatch(
      /indisponível/,
    );
    expect(validarNovoItem(lot({ id: 1, quantidade: 0 }), 1, [], TODAY)).toMatch(/indisponível/);
  });

  it("considera o que já está reservado na lista para o mesmo lote", () => {
    const itens = [criarItemCarrinho(lot({ id: 1 }), 4, PACIENTE_ANA)];

    expect(validarNovoItem(lot({ id: 1, quantidade: 5 }), 1, itens, TODAY)).toBeNull();
    expect(validarNovoItem(lot({ id: 1, quantidade: 5 }), 2, itens, TODAY)).toMatch(
      /lista já reserva 4/,
    );
    expect(validarNovoItem(lot({ id: 2, quantidade: 5 }), 5, itens, TODAY)).toBeNull();
  });
});

describe("toRetiraLotePayload", () => {
  it("monta o corpo do POST /retira/lote omitindo paciente quando não vinculado", () => {
    const itens = [
      criarItemCarrinho(lot({ id: 1 }), 2, PACIENTE_ANA),
      criarItemCarrinho(lot({ id: 2 }), 3, null),
    ];

    expect(toRetiraLotePayload(itens)).toEqual({
      itens: [
        { medication_id: 1, quantidade: 2, paciente_id: 7 },
        { medication_id: 2, quantidade: 3 },
      ],
    });
  });
});
