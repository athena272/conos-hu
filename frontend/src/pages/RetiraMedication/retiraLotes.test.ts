import { describe, expect, it } from "vitest";
import {
  formatLoteOptionLabel,
  isLoteDisponivelParaRetira,
  isLoteVencido,
  pickRecommendedLotId,
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
    expect(formatLoteOptionLabel(rec, 2, "2026-09-25")).toContain("recomendado");
    expect(
      formatLoteOptionLabel(
        lot({ id: 1, data_validade: "2020-01-01", quantidade: 1, lote: "B" }),
        2,
        "2026-09-25",
      ),
    ).toContain("vencido");
    expect(isLoteDisponivelParaRetira(rec, "2026-09-25")).toBe(true);
  });
});
