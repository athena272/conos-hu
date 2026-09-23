import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeMedicamentoDisplay,
  medicamentoNomeConcMatchKey,
  normalizeMedicamentoConcentracao,
  normalizeMedicamentoText,
} from "../utils/medicamentoNomeConc";

test("normalizeMedicamentoText colapsa espaços e lower-case", () => {
  assert.equal(normalizeMedicamentoText("  Ana Stro  Zol "), "ana stro zol");
});

test("normalizeMedicamentoConcentracao unifica 1mg / 1 mg / 1MG", () => {
  assert.equal(normalizeMedicamentoConcentracao("1mg"), "1mg");
  assert.equal(normalizeMedicamentoConcentracao("1 mg"), "1mg");
  assert.equal(normalizeMedicamentoConcentracao("1MG"), "1mg");
});

test("medicamentoNomeConcMatchKey agrupa variantes de nome e concentração", () => {
  const a = medicamentoNomeConcMatchKey("Anastrozol", "1mg");
  const b = medicamentoNomeConcMatchKey("anastrozol", "1 mg");
  const c = medicamentoNomeConcMatchKey("ANASTROZOL", "1MG");
  assert.equal(a, b);
  assert.equal(b, c);
});

test("medicamentoNomeConcMatchKey distingue concentrações diferentes", () => {
  assert.notEqual(
    medicamentoNomeConcMatchKey("Anastrozol", "1mg"),
    medicamentoNomeConcMatchKey("Anastrozol", "10mg"),
  );
});

test("canonicalizeMedicamentoDisplay preserva capitalização", () => {
  assert.equal(canonicalizeMedicamentoDisplay("  Anastrozol  "), "Anastrozol");
  assert.equal(canonicalizeMedicamentoDisplay("1  mg"), "1 mg");
});
