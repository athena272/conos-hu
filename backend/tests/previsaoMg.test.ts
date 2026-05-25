import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarPrevisaoMg,
  buildPrevisaoMgFromRow,
  mesesEstoqueFromMg,
  taxaMgPorDiaFromRow,
} from "../utils/previsaoMg";

const conc500 = "500mg";

test("buildPrevisaoMgFromRow diario — A, B e C", () => {
  const p = buildPrevisaoMgFromRow({
    regime_consumo: "diario",
    consumo_diario: 2,
    unidades_por_ciclo: null,
    intervalo_ciclo_dias: null,
    medicamento_concentracao: conc500,
  });
  assert.equal(p.mg_dia_previsto, 1000);
  assert.equal(p.mg_mes_previsto, 30000);
  assert.equal(p.mg_contextual, 1000);
  assert.equal(p.contextual_rotulo, "mg/dia");
});

test("buildPrevisaoMgFromRow por_ciclo — A, B e C", () => {
  const p = buildPrevisaoMgFromRow({
    regime_consumo: "por_ciclo",
    consumo_diario: 0,
    unidades_por_ciclo: 1,
    intervalo_ciclo_dias: 45,
    medicamento_concentracao: conc500,
  });
  assert.ok(Math.abs((p.mg_dia_previsto ?? 0) - 500 / 45) < 0.001);
  assert.equal(p.mg_contextual, 500);
  assert.equal(p.contextual_rotulo, "mg/ciclo");
});

test("buildPrevisaoMgFromRow por_miligrama", () => {
  const p = buildPrevisaoMgFromRow({
    regime_consumo: "por_miligrama",
    consumo_diario: 0,
    unidades_por_ciclo: null,
    intervalo_ciclo_dias: null,
    consumo_mg_diario: 750,
    medicamento_concentracao: conc500,
  });
  assert.equal(p.mg_dia_previsto, 750);
  assert.equal(p.mg_mes_previsto, 22500);
  assert.equal(p.mg_contextual, 750);
  assert.equal(p.contextual_rotulo, "mg/dia");
});

test("buildPrevisaoMgFromRow null when concentration has no mg", () => {
  const p = buildPrevisaoMgFromRow({
    regime_consumo: "diario",
    consumo_diario: 2,
    unidades_por_ciclo: null,
    intervalo_ciclo_dias: null,
    medicamento_concentracao: "1 g",
  });
  assert.equal(p.mg_dia_previsto, null);
  assert.equal(p.mg_mes_previsto, null);
});

test("agregarPrevisaoMg sums mg/dia and uses mg/ciclo when homogeneous", () => {
  const linhas = [
    {
      regime_consumo: "por_ciclo",
      consumo_diario: 0,
      unidades_por_ciclo: 1,
      intervalo_ciclo_dias: 30,
      medicamento_concentracao: conc500,
    },
    {
      regime_consumo: "por_ciclo",
      consumo_diario: 0,
      unidades_por_ciclo: 2,
      intervalo_ciclo_dias: 30,
      medicamento_concentracao: conc500,
    },
  ];
  const agg = agregarPrevisaoMg(linhas);
  assert.equal(agg.mg_contextual, 1500);
  assert.equal(agg.contextual_rotulo, "mg/ciclo");
  assert.ok((agg.mg_dia_previsto ?? 0) > 0);
});

test("agregarPrevisaoMg mixed regimes uses mg/dia contextual", () => {
  const linhas = [
    {
      regime_consumo: "diario",
      consumo_diario: 1,
      unidades_por_ciclo: null,
      intervalo_ciclo_dias: null,
      medicamento_concentracao: conc500,
    },
    {
      regime_consumo: "por_ciclo",
      consumo_diario: 0,
      unidades_por_ciclo: 1,
      intervalo_ciclo_dias: 30,
      medicamento_concentracao: conc500,
    },
  ];
  const agg = agregarPrevisaoMg(linhas);
  assert.equal(agg.contextual_rotulo, "mg/dia");
  assert.equal(agg.mg_contextual, agg.mg_dia_previsto);
});

test("mesesEstoqueFromMg", () => {
  // 100 un × 500mg = 50000mg; 1000 mg/dia × 30 = 30000/mês → 1 mês
  assert.equal(mesesEstoqueFromMg(100, 1000, conc500), 1);
  assert.equal(mesesEstoqueFromMg(100, 0, conc500), null);
  assert.equal(mesesEstoqueFromMg(100, 1000, "sem mg"), null);
});

test("taxaMgPorDiaFromRow por_miligrama ignores concentration", () => {
  assert.equal(
    taxaMgPorDiaFromRow({
      regime_consumo: "por_miligrama",
      consumo_diario: 0,
      unidades_por_ciclo: null,
      intervalo_ciclo_dias: null,
      consumo_mg_diario: 200,
      medicamento_concentracao: "sem mg",
    }),
    200
  );
});
