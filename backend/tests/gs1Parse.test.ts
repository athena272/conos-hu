import test from "node:test";
import assert from "node:assert/strict";
import { extractGtinFromDigitString, normalizeGtinDigits, parseGs1Raw } from "../utils/gs1Parse";

test("normalizeGtinDigits normalizes supported lengths", () => {
  assert.equal(normalizeGtinDigits("7891234567890"), "07891234567890");
  assert.equal(normalizeGtinDigits("78912345"), "00000078912345");
  assert.equal(normalizeGtinDigits("123"), undefined);
});

test("extractGtinFromDigitString uses last GTIN segment from long streams", () => {
  const stream = "99887766010789123456789017241231";
  assert.equal(extractGtinFromDigitString(stream), "56789017241231");
});

test("parseGs1Raw parses parenthesized payload", () => {
  const raw = "(01)07891234567890(17)241231(10)L123(21)ABC";
  assert.deepEqual(parseGs1Raw(raw), {
    gtin: "07891234567890",
    data_validade: "2024-12-31",
    lote: "L123",
    serial: "ABC",
  });
});

test("parseGs1Raw falls back to gtin-only digit format", () => {
  assert.deepEqual(parseGs1Raw("7891234567890"), { gtin: "07891234567890" });
});
