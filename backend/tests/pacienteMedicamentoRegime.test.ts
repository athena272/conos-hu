import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResumoTaxaMeta,
  parseRegimeConsumo,
  taxaFromPersistRow,
  taxaUnidadesPorDia,
  tryResumoPorCicloHomogeneo,
} from "../utils/pacienteMedicamentoRegime";

test("parseRegimeConsumo defaults safely to diario", () => {
  assert.equal(parseRegimeConsumo("por_ciclo"), "por_ciclo");
  assert.equal(parseRegimeConsumo("diario"), "diario");
  assert.equal(parseRegimeConsumo("outro"), "diario");
});

test("taxaUnidadesPorDia computes by regime", () => {
  assert.equal(taxaUnidadesPorDia("diario", 2, null, null), 2);
  assert.equal(taxaUnidadesPorDia("por_ciclo", 0, 6, 3), 2);
  assert.equal(taxaUnidadesPorDia("por_ciclo", 0, 6, 0), 0);
});

test("tryResumoPorCicloHomogeneo returns null for mixed intervals", () => {
  const rows = [
    { regime_consumo: "por_ciclo", consumo_diario: 0, unidades_por_ciclo: 4, intervalo_ciclo_dias: 30 },
    { regime_consumo: "por_ciclo", consumo_diario: 0, unidades_por_ciclo: 2, intervalo_ciclo_dias: 15 },
  ];
  assert.equal(tryResumoPorCicloHomogeneo(rows), null);
});

test("buildResumoTaxaMeta classifies homogeneous por_ciclo groups", () => {
  const rows = [
    { regime_consumo: "por_ciclo", consumo_diario: 0, unidades_por_ciclo: 4, intervalo_ciclo_dias: 30 },
    { regime_consumo: "por_ciclo", consumo_diario: 0, unidades_por_ciclo: 2, intervalo_ciclo_dias: 30 },
  ];
  assert.deepEqual(buildResumoTaxaMeta(rows), {
    resumoTaxaTipo: "por_ciclo_homogeneo",
    porCicloUnidadesTotal: 6,
    porCicloIntervaloDias: 30,
  });
});

test("taxaFromPersistRow supports diario and por_ciclo persistence", () => {
  assert.equal(
    taxaFromPersistRow({
      regime_consumo: "diario",
      consumo_diario: 1.5,
      unidades_por_ciclo: null,
      intervalo_ciclo_dias: null,
    }),
    1.5
  );
  assert.equal(
    taxaFromPersistRow({
      regime_consumo: "por_ciclo",
      consumo_diario: 0,
      unidades_por_ciclo: 3,
      intervalo_ciclo_dias: 2,
    }),
    1.5
  );
});
