import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ITENS_RETIRADA,
  RETIRA_ERRORS,
  RetiraError,
  parseRetiraItem,
  parseRetiraItens,
} from "../services/retiraService";

function assertRetiraError(
  fn: () => unknown,
  expected: { status: number; message: string; itemIndex?: number },
): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof RetiraError);
    assert.equal(err.status, expected.status);
    assert.equal(err.message, expected.message);
    assert.equal(err.itemIndex, expected.itemIndex);
    return true;
  });
}

test("parseRetiraItem converte item válido sem paciente", () => {
  assert.deepEqual(parseRetiraItem({ medication_id: "7", quantidade: "3" }), {
    medicationId: 7,
    quantidade: 3,
    pacienteId: null,
  });
});

test("parseRetiraItem trata paciente_id vazio como sem paciente", () => {
  assert.equal(parseRetiraItem({ medication_id: 1, quantidade: 1, paciente_id: "" }).pacienteId, null);
  assert.equal(parseRetiraItem({ medication_id: 1, quantidade: 1, paciente_id: null }).pacienteId, null);
  assert.equal(parseRetiraItem({ medication_id: 1, quantidade: 1, paciente_id: 9 }).pacienteId, 9);
});

test("parseRetiraItem mantém as mensagens do POST /retira", () => {
  assertRetiraError(() => parseRetiraItem({ quantidade: 1 }), {
    status: 400,
    message: RETIRA_ERRORS.dadosObrigatorios,
  });
  assertRetiraError(() => parseRetiraItem({ medication_id: 1, quantidade: "abc" }), {
    status: 400,
    message: RETIRA_ERRORS.dadosObrigatorios,
  });
  assertRetiraError(() => parseRetiraItem({ medication_id: 1, quantidade: 0 }), {
    status: 400,
    message: RETIRA_ERRORS.quantidadeInvalida,
  });
  assertRetiraError(() => parseRetiraItem({ medication_id: 1, quantidade: 1, paciente_id: "x" }), {
    status: 400,
    message: RETIRA_ERRORS.pacienteIdInvalido,
  });
  assertRetiraError(() => parseRetiraItem(null), {
    status: 400,
    message: RETIRA_ERRORS.dadosObrigatorios,
  });
});

test("parseRetiraItens rejeita lista ausente ou vazia", () => {
  assertRetiraError(() => parseRetiraItens({}), {
    status: 400,
    message: RETIRA_ERRORS.itensObrigatorios,
  });
  assertRetiraError(() => parseRetiraItens({ itens: [] }), {
    status: 400,
    message: RETIRA_ERRORS.itensObrigatorios,
  });
  assertRetiraError(() => parseRetiraItens(undefined), {
    status: 400,
    message: RETIRA_ERRORS.itensObrigatorios,
  });
});

test("parseRetiraItens rejeita lista acima do limite", () => {
  const itens = Array.from({ length: MAX_ITENS_RETIRADA + 1 }, () => ({
    medication_id: 1,
    quantidade: 1,
  }));
  assertRetiraError(() => parseRetiraItens({ itens }), {
    status: 400,
    message: RETIRA_ERRORS.itensAcimaDoLimite,
  });
});

test("parseRetiraItens aponta o índice do item inválido", () => {
  assertRetiraError(
    () =>
      parseRetiraItens({
        itens: [
          { medication_id: 1, quantidade: 1 },
          { medication_id: 2, quantidade: 1, paciente_id: -3 },
        ],
      }),
    { status: 400, message: RETIRA_ERRORS.pacienteIdInvalido, itemIndex: 1 },
  );
});

test("parseRetiraItens preserva a ordem e o paciente de cada item", () => {
  assert.deepEqual(
    parseRetiraItens({
      itens: [
        { medication_id: 1, quantidade: 2, paciente_id: 10 },
        { medication_id: 2, quantidade: 5 },
      ],
    }),
    [
      { medicationId: 1, quantidade: 2, pacienteId: 10 },
      { medicationId: 2, quantidade: 5, pacienteId: null },
    ],
  );
});
