import type { Paciente, ResumoPorMedicamento } from "../../types";
import {
  agregarPrevisaoMgMedicamentos,
  inferResumoTaxaMetaFromMedicamentos,
  mesesEstoqueFromMgFrontend,
  previsaoMgTemValor,
} from "../../utils/pacienteMedicamentoDisplay";

/** Enriquece linhas do resumo com metadados inferidos a partir da lista de pacientes. */
export function enrichResumoPorMedicamento(
  resumoPorMedicamento: ResumoPorMedicamento[],
  pacientes: Paciente[],
): ResumoPorMedicamento[] {
  return resumoPorMedicamento.map((row) => {
    const meds = pacientes
      .flatMap((p) => p.medicamentos ?? [])
      .filter(
        (m) =>
          m.medicamento_nome === row.medicamento_nome &&
          m.medicamento_concentracao === row.medicamento_concentracao,
      );

    let enriched = row;
    if (row.resumoTaxaTipo == null || row.resumoTaxaTipo === "") {
      const inferred = inferResumoTaxaMetaFromMedicamentos(meds);
      if (inferred) enriched = { ...enriched, ...inferred };
    }

    const previsaoMgTotal =
      enriched.previsaoMgTotal && previsaoMgTemValor(enriched.previsaoMgTotal)
        ? enriched.previsaoMgTotal
        : meds.length > 0
          ? agregarPrevisaoMgMedicamentos(meds)
          : enriched.previsaoMgTotal;

    const mgDia = previsaoMgTotal?.mg_dia_previsto ?? null;
    const mesesEstoqueMg =
      enriched.mesesEstoqueMg != null
        ? enriched.mesesEstoqueMg
        : mesesEstoqueFromMgFrontend(
            enriched.estoqueTotal,
            mgDia,
            row.medicamento_concentracao,
          );

    return {
      ...enriched,
      ...(previsaoMgTotal && previsaoMgTemValor(previsaoMgTotal)
        ? { previsaoMgTotal }
        : {}),
      ...(mesesEstoqueMg !== undefined ? { mesesEstoqueMg } : {}),
    };
  });
}
