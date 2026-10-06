import { coll, getDb } from "../models/mongo";
import { getNextId } from "../models/sequences";
import { todayIsoDateSaoPaulo } from "../utils/calendarDate";
import { dateOnly } from "../models/mappers";

export const MAX_ITENS_RETIRADA = 50;

export const RETIRA_ERRORS = {
  dadosObrigatorios: "medication_id e quantidade numérica são obrigatórios",
  quantidadeInvalida: "quantidade deve ser um número positivo",
  pacienteIdInvalido: "paciente_id inválido",
  pacienteNaoEncontrado: "Paciente não encontrado",
  medicacaoNaoEncontrada: "Medicação não encontrada",
  loteVencido: "Lote fora da validade",
  estoqueInsuficiente: "Quantidade insuficiente em estoque",
  itensObrigatorios: "itens deve ser uma lista com ao menos um item",
  itensAcimaDoLimite: `A retirada em lote aceita no máximo ${MAX_ITENS_RETIRADA} itens`,
} as const;

/** Erro de negócio da retirada; `itemIndex` aponta o item (base 0) na retirada em lote. */
export class RetiraError extends Error {
  readonly status: number;
  readonly itemIndex?: number;

  constructor(status: number, message: string, itemIndex?: number) {
    super(message);
    this.name = "RetiraError";
    this.status = status;
    this.itemIndex = itemIndex;
  }
}

export interface RetiraItemInput {
  medicationId: number;
  quantidade: number;
  pacienteId: number | null;
}

export interface RetiradaRealizada extends RetiraItemInput {
  nome: string;
  lote: string;
  pacienteNome: string | null;
}

type MedicationStock = {
  _id: number;
  quantidade: number;
  nome?: string;
  lote?: string;
  data_validade?: string | Date;
};

type PacienteDoc = { _id: number; nome?: string };

type RetiraMedicationDoc = {
  _id: number;
  medication_id: number;
  usuario_id: number;
  quantidade: number;
  data_retirada: Date;
  paciente_id: number | null;
};

type MovimentacaoDoc = {
  _id: number;
  tipo: string;
  medication_id: number;
  quantidade: number;
  usuario_id: number;
  data_movimentacao: Date;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

/** Valida um item de retirada (mesmas regras e mensagens do `POST /retira`). */
export function parseRetiraItem(raw: unknown, itemIndex?: number): RetiraItemInput {
  const { medication_id, quantidade, paciente_id } = asRecord(raw);

  const quantidadeNum = parseInt(String(quantidade), 10);
  if (!medication_id || isNaN(quantidadeNum)) {
    throw new RetiraError(400, RETIRA_ERRORS.dadosObrigatorios, itemIndex);
  }
  if (quantidadeNum < 1) {
    throw new RetiraError(400, RETIRA_ERRORS.quantidadeInvalida, itemIndex);
  }

  let pacienteId: number | null = null;
  if (paciente_id != null && paciente_id !== "") {
    const pid = parseInt(String(paciente_id), 10);
    if (isNaN(pid) || pid < 1) {
      throw new RetiraError(400, RETIRA_ERRORS.pacienteIdInvalido, itemIndex);
    }
    pacienteId = pid;
  }

  return {
    medicationId: parseInt(String(medication_id), 10),
    quantidade: quantidadeNum,
    pacienteId,
  };
}

/** Valida o corpo `{ itens: [...] }` da retirada em lote. */
export function parseRetiraItens(body: unknown): RetiraItemInput[] {
  const { itens } = asRecord(body);
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new RetiraError(400, RETIRA_ERRORS.itensObrigatorios);
  }
  if (itens.length > MAX_ITENS_RETIRADA) {
    throw new RetiraError(400, RETIRA_ERRORS.itensAcimaDoLimite);
  }
  return itens.map((raw, index) => parseRetiraItem(raw, index));
}

async function carregarNomesPacientes(itens: RetiraItemInput[]): Promise<Map<number, string | null>> {
  const ids = [...new Set(itens.map((i) => i.pacienteId).filter((id): id is number => id != null))];
  const nomes = new Map<number, string | null>();
  if (ids.length === 0) return nomes;

  const pacientes = await coll<PacienteDoc>("pacientes").find({ _id: { $in: ids } }).toArray();
  for (const p of pacientes) nomes.set(p._id, p.nome ?? null);

  itens.forEach((item, index) => {
    if (item.pacienteId != null && !nomes.has(item.pacienteId)) {
      throw new RetiraError(400, RETIRA_ERRORS.pacienteNaoEncontrado, index);
    }
  });
  return nomes;
}

async function validarLotes(itens: RetiraItemInput[]): Promise<void> {
  const ids = [...new Set(itens.map((i) => i.medicationId))];
  const meds = await coll<MedicationStock>("medications").find({ _id: { $in: ids } }).toArray();
  const porId = new Map(meds.map((m) => [m._id, m]));
  const today = todayIsoDateSaoPaulo();

  itens.forEach((item, index) => {
    const med = porId.get(item.medicationId);
    if (!med) {
      throw new RetiraError(404, RETIRA_ERRORS.medicacaoNaoEncontrada, index);
    }
    const validadeIso = dateOnly(med.data_validade);
    if (validadeIso && validadeIso < today) {
      throw new RetiraError(400, RETIRA_ERRORS.loteVencido, index);
    }
  });
}

/**
 * Executa as retiradas em uma única transação (tudo ou nada): baixa o estoque e grava
 * `retira_medications` e `movimentacoes` de cada item. Itens repetidos do mesmo lote são
 * debitados em sequência, então a soma acima do estoque é rejeitada.
 */
export async function executarRetiradas(
  usuarioId: number,
  itens: RetiraItemInput[],
): Promise<RetiradaRealizada[]> {
  const db = getDb();
  const nomesPacientes = await carregarNomesPacientes(itens);
  await validarLotes(itens);

  const realizadas: RetiradaRealizada[] = [];
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      realizadas.length = 0;
      const medCol = coll<MedicationStock>("medications");

      for (const [index, item] of itens.entries()) {
        const after = await medCol.findOneAndUpdate(
          { _id: item.medicationId, quantidade: { $gte: item.quantidade } },
          { $inc: { quantidade: -item.quantidade } },
          { session, returnDocument: "after" },
        );
        if (!after) {
          const exists = await medCol.findOne({ _id: item.medicationId }, { session });
          throw exists
            ? new RetiraError(400, RETIRA_ERRORS.estoqueInsuficiente, index)
            : new RetiraError(404, RETIRA_ERRORS.medicacaoNaoEncontrada, index);
        }

        const agora = new Date();
        const retiraId = await getNextId("retira_medications", session);
        await coll<RetiraMedicationDoc>("retira_medications").insertOne(
          {
            _id: retiraId,
            medication_id: item.medicationId,
            usuario_id: usuarioId,
            quantidade: item.quantidade,
            data_retirada: agora,
            paciente_id: item.pacienteId,
          },
          { session },
        );

        const movId = await getNextId("movimentacoes", session);
        await coll<MovimentacaoDoc>("movimentacoes").insertOne(
          {
            _id: movId,
            tipo: "saida",
            medication_id: item.medicationId,
            quantidade: item.quantidade,
            usuario_id: usuarioId,
            data_movimentacao: agora,
          },
          { session },
        );

        realizadas.push({
          ...item,
          nome: after.nome ?? "",
          lote: after.lote ?? "",
          pacienteNome: item.pacienteId != null ? nomesPacientes.get(item.pacienteId) ?? null : null,
        });
      }
    });
  } finally {
    await session.endSession();
  }
  return realizadas;
}
