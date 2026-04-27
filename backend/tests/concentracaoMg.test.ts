import test from "node:test";
import assert from "node:assert/strict";
import { mgTotaisFromUnidades, parseMgPorUnidadeFromConcentracao } from "../utils/concentracaoMg";

test("parseMgPorUnidadeFromConcentracao parses integer and decimal mg values", () => {
  assert.equal(parseMgPorUnidadeFromConcentracao("500mg"), 500);
  assert.equal(parseMgPorUnidadeFromConcentracao("250,5 mg"), 250.5);
  assert.equal(parseMgPorUnidadeFromConcentracao("1 g"), null);
});

test("mgTotaisFromUnidades calculates total mg only for valid inputs", () => {
  assert.equal(mgTotaisFromUnidades(3, "500mg"), 1500);
  assert.equal(mgTotaisFromUnidades(0, "500mg"), null);
  assert.equal(mgTotaisFromUnidades(3, "1 g"), null);
});
