import test from "node:test";
import assert from "node:assert/strict";
import { validateRecordEventInput } from "../services/eventService";
import { EVENTO_ACOES, EVENTO_ENTIDADES, isEventoAcao, isEventoEntidade } from "../types/evento";

test("validateRecordEventInput accepts payload mínimo válido", () => {
  const err = validateRecordEventInput({
    usuario_id: 1,
    acao: "medication.withdraw",
    entidade_tipo: "medication",
    entidade_id: 10,
    detalhes: { quantidade: 2 },
  });
  assert.equal(err, null);
});

test("validateRecordEventInput rejeita usuario_id inválido", () => {
  assert.equal(
    validateRecordEventInput({
      usuario_id: 0,
      acao: "medication.create",
      entidade_tipo: "medication",
    }),
    "usuario_id é obrigatório e deve ser um número positivo"
  );
  assert.equal(
    validateRecordEventInput({
      acao: "medication.create",
      entidade_tipo: "medication",
    }),
    "usuario_id é obrigatório e deve ser um número positivo"
  );
});

test("validateRecordEventInput rejeita acao e entidade inválidas", () => {
  assert.equal(
    validateRecordEventInput({
      usuario_id: 1,
      acao: "foo.bar" as never,
      entidade_tipo: "medication",
    }),
    "acao inválida"
  );
  assert.equal(
    validateRecordEventInput({
      usuario_id: 1,
      acao: "medication.create",
      entidade_tipo: "foo" as never,
    }),
    "entidade_tipo inválido"
  );
});

test("isEventoAcao e isEventoEntidade cobrem listas conhecidas", () => {
  for (const acao of EVENTO_ACOES) {
    assert.equal(isEventoAcao(acao), true);
  }
  assert.equal(isEventoAcao("desconhecida"), false);

  for (const ent of EVENTO_ENTIDADES) {
    assert.equal(isEventoEntidade(ent), true);
  }
  assert.equal(isEventoEntidade("outro"), false);
});
