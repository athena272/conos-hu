import type { ClientSession } from "mongodb";
import { coll } from "../models/mongo";
import { getNextId } from "../models/sequences";
import type { EventoAcao, EventoDoc, EventoEntidade } from "../types/evento";
import { isEventoAcao, isEventoEntidade } from "../types/evento";

export interface RecordEventInput {
  usuario_id: number;
  acao: EventoAcao;
  entidade_tipo: EventoEntidade;
  entidade_id: number | null;
  detalhes?: Record<string, unknown>;
  session?: ClientSession;
}

/**
 * Persiste um evento de auditoria. Best-effort: falhas são logadas e não propagadas,
 * para não reverter a operação de negócio já concluída.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const { usuario_id, acao, entidade_tipo, entidade_id, detalhes, session } = input;

    if (!Number.isFinite(usuario_id) || usuario_id < 1) {
      console.error("recordEvent: usuario_id inválido", usuario_id);
      return;
    }
    if (!isEventoAcao(acao)) {
      console.error("recordEvent: acao inválida", acao);
      return;
    }
    if (!isEventoEntidade(entidade_tipo)) {
      console.error("recordEvent: entidade_tipo inválido", entidade_tipo);
      return;
    }

    const id = await getNextId("eventos", session);
    const doc: EventoDoc = {
      _id: id,
      acao,
      entidade_tipo,
      entidade_id: entidade_id != null && Number.isFinite(entidade_id) ? entidade_id : null,
      usuario_id,
      created_at: new Date(),
      detalhes: detalhes ?? {},
    };

    await coll<EventoDoc>("eventos").insertOne(doc, session ? { session } : undefined);
  } catch (err) {
    console.error("recordEvent: falha ao gravar evento (operação de negócio não afetada):", err);
  }
}

/** Valida payload mínimo para testes unitários e uso interno. */
export function validateRecordEventInput(input: Partial<RecordEventInput>): string | null {
  if (input.usuario_id == null || !Number.isFinite(input.usuario_id) || input.usuario_id < 1) {
    return "usuario_id é obrigatório e deve ser um número positivo";
  }
  if (!isEventoAcao(input.acao)) {
    return "acao inválida";
  }
  if (!isEventoEntidade(input.entidade_tipo)) {
    return "entidade_tipo inválido";
  }
  return null;
}
