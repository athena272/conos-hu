import test from "node:test";
import assert from "node:assert/strict";

/**
 * Testes leves da lógica de decisão do backfill (sem Mongo).
 * Mantém o contrato documentado no script.
 */

function shouldImportMovimentacao(tipo: string): boolean {
  return tipo === "entrada";
}

function resolveUsuarioId(
  usuario_id: number | null,
  fallback: number | null
): { usuario_id: number; desconhecido: boolean } | null {
  if (usuario_id != null && Number.isFinite(usuario_id) && usuario_id >= 1) {
    return { usuario_id, desconhecido: false };
  }
  if (fallback != null && fallback >= 1) {
    return { usuario_id: fallback, desconhecido: true };
  }
  return null;
}

test("backfill importa apenas movimentacoes de entrada", () => {
  assert.equal(shouldImportMovimentacao("entrada"), true);
  assert.equal(shouldImportMovimentacao("saida"), false);
});

test("resolveUsuarioId usa fallback quando original é nulo", () => {
  assert.deepEqual(resolveUsuarioId(7, 1), { usuario_id: 7, desconhecido: false });
  assert.deepEqual(resolveUsuarioId(null, 3), { usuario_id: 3, desconhecido: true });
  assert.equal(resolveUsuarioId(null, null), null);
  assert.equal(resolveUsuarioId(0, null), null);
});
