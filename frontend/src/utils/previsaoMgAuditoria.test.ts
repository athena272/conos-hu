import { describe, expect, it } from "vitest";
import type { PacienteMedicamento } from "../types/paciente";
import {
  auditoriaCoerenteComPrevisao,
  buildPrevisaoMgAuditoria,
} from "./previsaoMgAuditoria";
import { resolvePrevisaoMgMedicamento } from "./pacienteMedicamentoDisplay";

function med(
  partial: Partial<PacienteMedicamento> &
    Pick<PacienteMedicamento, "medicamento_nome" | "medicamento_concentracao">,
): PacienteMedicamento {
  return {
    consumo_diario: 1,
    regime_consumo: "diario",
    ...partial,
  };
}

describe("buildPrevisaoMgAuditoria", () => {
  it("diario: descreve multiplicacao consumo x mg por unidade", () => {
    const m = med({
      medicamento_nome: "Paracetamol",
      medicamento_concentracao: "500mg",
      consumo_diario: 2,
    });
    const previsao = resolvePrevisaoMgMedicamento(m);
    const audit = buildPrevisaoMgAuditoria(m, { previsaoExibida: previsao });

    expect(audit.previsao.mg_dia_previsto).toBe(1000);
    expect(audit.regimeLabel).toBe("Consumo diário");
    expect(audit.passos.some((p) => p.detalhe.includes("2 unid./dia ×"))).toBe(true);
    expect(audit.passos.some((p) => p.rotulo === "Mg/mês (B)")).toBe(true);
    expect(audit.indisponivel).toBeNull();
    expect(auditoriaCoerenteComPrevisao(audit, previsao)).toBe(true);
  });

  it("por_miligrama: explica valor direto sem concentracao", () => {
    const m = med({
      medicamento_nome: "Metformina",
      medicamento_concentracao: "850mg",
      consumo_diario: 0,
      regime_consumo: "por_miligrama",
      consumo_mg_diario: 1700,
    });
    const previsao = resolvePrevisaoMgMedicamento(m);
    const audit = buildPrevisaoMgAuditoria(m, { previsaoExibida: previsao });

    expect(audit.previsao.mg_dia_previsto).toBe(1700);
    expect(audit.passos.some((p) => p.detalhe.includes("1.700 mg/dia"))).toBe(true);
    expect(
      audit.passos.some((p) =>
        p.detalhe.includes("sem multiplicar pela concentração"),
      ),
    ).toBe(true);
  });

  it("por_ciclo: descreve mg/ciclo e conversao para mg/dia", () => {
    const m = med({
      medicamento_nome: "Sugamadex",
      medicamento_concentracao: "100mg/ml",
      consumo_diario: 0,
      regime_consumo: "por_ciclo",
      unidades_por_ciclo: 1,
      intervalo_ciclo_dias: 45,
    });
    const previsao = resolvePrevisaoMgMedicamento(m);
    const audit = buildPrevisaoMgAuditoria(m, { previsaoExibida: previsao });

    expect(audit.previsao.mg_contextual).toBe(100);
    expect(audit.passos.some((p) => p.rotulo === "Cálculo mg/ciclo (C)")).toBe(true);
    expect(audit.passos.some((p) => p.detalhe.includes("÷ 45 dias"))).toBe(true);
  });

  it("indisponivel: regime diario com consumo zero", () => {
    const m = med({
      medicamento_nome: "Metformina",
      medicamento_concentracao: "850mg",
      consumo_diario: 0,
    });
    const previsao = resolvePrevisaoMgMedicamento(m);
    const audit = buildPrevisaoMgAuditoria(m, { previsaoExibida: previsao });

    expect(audit.indisponivel).toBe("Concentração sem mg no cadastro");
    expect(audit.passos.some((p) => p.detalhe.includes("Consumo diário não informado"))).toBe(
      true,
    );
  });

  it("nao usa jargao tecnico de API ou fallback", () => {
    const m = med({
      medicamento_nome: "Paracetamol",
      medicamento_concentracao: "500mg",
      consumo_diario: 2,
    });
    const audit = buildPrevisaoMgAuditoria(m);
    const texto = audit.passos.map((p) => p.detalhe).join(" ");
    expect(texto).not.toMatch(/API|fallback|navegador/i);
    expect(audit.passos.some((p) => p.rotulo === "Fonte do valor exibido")).toBe(false);
  });

  it("nao depende de retiradas — origem e cadastro do vinculo", () => {
    const m = med({
      medicamento_nome: "Paracetamol",
      medicamento_concentracao: "500mg",
      consumo_diario: 2,
    });
    const audit = buildPrevisaoMgAuditoria(m);

    expect(
      audit.passos.some((p) =>
        p.detalhe.includes("Não utiliza retiradas"),
      ),
    ).toBe(true);
  });
});
