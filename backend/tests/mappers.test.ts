import test from "node:test";
import assert from "node:assert/strict";
import { formatMysqlTimestamp } from "../models/mappers";

test("formatMysqlTimestamp exibe horário de Brasília (UTC-3), não UTC cru", () => {
  // 14:14:17 UTC == 11:14:17 em America/Sao_Paulo (sem horário de verão desde 2019)
  const utc = new Date("2026-07-21T14:14:17.000Z");
  assert.equal(formatMysqlTimestamp(utc), "2026-07-21 11:14:17");
});

test("formatMysqlTimestamp rejeita Date inválida", () => {
  assert.equal(formatMysqlTimestamp(new Date("invalid")), undefined);
});

test("formatMysqlTimestamp preserva string já formatada", () => {
  assert.equal(formatMysqlTimestamp("2026-07-21 11:14:17"), "2026-07-21 11:14:17");
});
