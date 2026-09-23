import test from "node:test";
import assert from "node:assert/strict";
import { todayIsoDateSaoPaulo } from "../utils/calendarDate";

test("todayIsoDateSaoPaulo usa calendário de Brasília, não UTC", () => {
  // 23:30 BRT = 02:30 UTC do dia seguinte
  const lateEveningBrt = new Date("2026-09-23T02:30:00.000Z");
  assert.equal(todayIsoDateSaoPaulo(lateEveningBrt), "2026-09-22");
});

test("todayIsoDateSaoPaulo coincide com UTC quando ainda é o mesmo dia civil em BRT", () => {
  // 15:00 BRT = 18:00 UTC no mesmo dia
  const afternoon = new Date("2026-09-23T18:00:00.000Z");
  assert.equal(todayIsoDateSaoPaulo(afternoon), "2026-09-23");
});
