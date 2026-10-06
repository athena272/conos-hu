import { describe, expect, it } from "vitest";
import {
  formatLoteOptionLabel,
  isLoteDisponivelParaRetira,
  isLoteVencido,
  medicamentoGroupKey,
  pickRecommendedLotId,
  pickRecommendedLotIdsByMedicamento,
  sortLotesParaSelecao,
} from "./retiraLotes";
import type { MedicationWithStatus } from "../../types";

function lot(
  partial: Partial<MedicationWithStatus> &
    Pick<MedicationWithStatus, "id" | "data_validade" | "quantidade">,
): MedicationWithStatus {
  return {
    nome: "Med",
    lote: `L${partial.id}`,
    classificacao: "",
    concentracao: "1mg",
    forma: "",
    status: "emEstoque",
    ...partial,
  };
}

describe("isLoteVencido", () => {
  it("considera vencido quando validade é anterior a hoje", () => {
    expect(isLoteVencido("2020-01-01", "2026-09-25")).toBe(true);
  });

  it("não considera vencido no dia da validade", () => {
    expect(isLoteVencido("2026-09-25", "2026-09-25")).toBe(false);
  });
});

describe("pickRecommendedLotId", () => {
  const today = "2026-09-25";

  it("escolhe o que vence primeiro entre lotes disponíveis", () => {
    const id = pickRecommendedLotId(
      [
        lot({ id: 1, data_validade: "2027-01-01", quantidade: 10 }),
        lot({ id: 2, data_validade: "2026-10-01", quantidade: 5 }),
        lot({ id: 3, data_validade: "2026-09-01", quantidade: 5 }),
      ],
      today,
    );
    expect(id).toBe(2);
  });

  it("ignora vencidos e sem estoque", () => {
    const id = pickRecommendedLotId(
      [
        lot({ id: 1, data_validade: "2026-09-01", quantidade: 10 }),
        lot({ id: 2, data_validade: "2026-10-01", quantidade: 0 }),
        lot({ id: 3, data_validade: "2026-11-01", quantidade: 3 }),
      ],
      today,
    );
    expect(id).toBe(3);
  });

  it("retorna null se nenhum disponível", () => {
    expect(
      pickRecommendedLotId(
        [lot({ id: 1, data_validade: "2020-01-01", quantidade: 10 })],
        today,
      ),
    ).toBeNull();
  });
});

describe("formatLoteOptionLabel / isLoteDisponivelParaRetira", () => {
  it("marca recomendado e vencido", () => {
    const rec = lot({
      id: 2,
      data_validade: "2026-10-01",
      quantidade: 5,
      lote: "A",
    });
    expect(formatLoteOptionLabel(rec, true, "2026-09-25")).toContain("recomendado");
    expect(formatLoteOptionLabel(rec, false, "2026-09-25")).not.toContain("recomendado");
    expect(
      formatLoteOptionLabel(
        lot({ id: 1, data_validade: "2020-01-01", quantidade: 1, lote: "B" }),
        true,
        "2026-09-25",
      ),
    ).toContain("vencido");
    expect(isLoteDisponivelParaRetira(rec, "2026-09-25")).toBe(true);
  });
});

describe("medicamentoGroupKey", () => {
  it("agrupa variações de caixa e espaços no nome e na concentração", () => {
    const base = medicamentoGroupKey({ nome: "Dipirona", concentracao: "500mg" });
    expect(medicamentoGroupKey({ nome: "  dipirona ", concentracao: "500 MG" })).toBe(base);
  });

  it("distingue concentrações diferentes", () => {
    expect(medicamentoGroupKey({ nome: "Dipirona", concentracao: "500mg" })).not.toBe(
      medicamentoGroupKey({ nome: "Dipirona", concentracao: "1g" }),
    );
  });
});

describe("pickRecommendedLotIdsByMedicamento", () => {
  const today = "2026-09-25";

  it("escolhe o lote que vence primeiro de cada medicamento", () => {
    const recomendados = pickRecommendedLotIdsByMedicamento(
      [
        lot({ id: 1, nome: "Dipirona", data_validade: "2027-01-01", quantidade: 10 }),
        lot({ id: 2, nome: "Dipirona", data_validade: "2026-11-01", quantidade: 10 }),
        lot({ id: 3, nome: "Paracetamol", data_validade: "2028-01-01", quantidade: 10 }),
      ],
      today,
    );

    expect(recomendados.get(medicamentoGroupKey({ nome: "Dipirona", concentracao: "1mg" }))).toBe(
      2,
    );
    expect(
      recomendados.get(medicamentoGroupKey({ nome: "Paracetamol", concentracao: "1mg" })),
    ).toBe(3);
  });

  it("ignora lotes vencidos ou sem estoque", () => {
    const recomendados = pickRecommendedLotIdsByMedicamento(
      [
        lot({ id: 1, data_validade: "2026-09-01", quantidade: 10 }),
        lot({ id: 2, data_validade: "2026-10-01", quantidade: 0 }),
        lot({ id: 3, data_validade: "2026-12-01", quantidade: 3 }),
        lot({ id: 4, nome: "Outro", data_validade: "2020-01-01", quantidade: 3 }),
      ],
      today,
    );

    expect([...recomendados.values()]).toEqual([3]);
  });
});

describe("sortLotesParaSelecao", () => {
  it("ordena por nome, concentração e validade", () => {
    const ordenados = sortLotesParaSelecao([
      lot({ id: 1, nome: "Paracetamol", data_validade: "2027-01-01", quantidade: 1 }),
      lot({ id: 2, nome: "Dipirona", concentracao: "1g", data_validade: "2027-01-01", quantidade: 1 }),
      lot({ id: 3, nome: "dipirona", concentracao: "500mg", data_validade: "2028-01-01", quantidade: 1 }),
      lot({ id: 4, nome: "Dipirona", concentracao: "500mg", data_validade: "2027-06-01", quantidade: 1 }),
      lot({ id: 5, nome: "Ácido fólico", data_validade: "2027-01-01", quantidade: 1 }),
    ]);

    expect(ordenados.map((m) => m.id)).toEqual([5, 2, 4, 3, 1]);
  });
});
