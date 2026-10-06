import type { MedicationWithStatus } from "../../types";
import { isLoteDisponivelParaRetira, todayIsoLocal } from "./retiraLotes";

export interface RetiraCarrinhoItem {
  /** Lote + paciente: itens com a mesma chave são somados. */
  key: string;
  medicationId: number;
  nome: string;
  concentracao: string;
  lote: string;
  dataValidade: string;
  quantidade: number;
  pacienteId: number | null;
  pacienteLabel: string | null;
}

export interface RetiraCarrinhoPaciente {
  id: number;
  label: string;
}

export interface RetiraLotePayload {
  itens: Array<{ medication_id: number; quantidade: number; paciente_id?: number }>;
}

export function buildCarrinhoItemKey(medicationId: number, pacienteId: number | null): string {
  return `${medicationId}:${pacienteId ?? "sem-paciente"}`;
}

export function quantidadeNoCarrinho(itens: RetiraCarrinhoItem[], medicationId: number): number {
  return itens
    .filter((i) => i.medicationId === medicationId)
    .reduce((total, i) => total + i.quantidade, 0);
}

/** Retorna a mensagem de erro do novo item, ou `null` se ele pode entrar na lista. */
export function validarNovoItem(
  lot: Pick<MedicationWithStatus, "id" | "quantidade" | "data_validade">,
  quantidade: number,
  itens: RetiraCarrinhoItem[],
  todayIso: string = todayIsoLocal(),
): string | null {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return "A quantidade deve ser um número inteiro maior que 0.";
  }
  if (!isLoteDisponivelParaRetira(lot, todayIso)) {
    return "Lote indisponível (vencido ou sem estoque).";
  }
  const reservado = quantidadeNoCarrinho(itens, lot.id);
  const estoque = Number(lot.quantidade);
  if (reservado + quantidade > estoque) {
    return reservado > 0
      ? `Estoque insuficiente: o lote tem ${estoque} unidade(s) e a lista já reserva ${reservado}.`
      : `Estoque insuficiente: o lote tem ${estoque} unidade(s).`;
  }
  return null;
}

export function criarItemCarrinho(
  lot: Pick<MedicationWithStatus, "id" | "nome" | "concentracao" | "lote" | "data_validade">,
  quantidade: number,
  paciente: RetiraCarrinhoPaciente | null,
): RetiraCarrinhoItem {
  const pacienteId = paciente?.id ?? null;
  return {
    key: buildCarrinhoItemKey(lot.id, pacienteId),
    medicationId: lot.id,
    nome: lot.nome,
    concentracao: lot.concentracao ?? "",
    lote: lot.lote,
    dataValidade: lot.data_validade,
    quantidade,
    pacienteId,
    pacienteLabel: paciente?.label ?? null,
  };
}

export function adicionarItem(
  itens: RetiraCarrinhoItem[],
  novo: RetiraCarrinhoItem,
): RetiraCarrinhoItem[] {
  const existente = itens.find((i) => i.key === novo.key);
  if (!existente) return [...itens, novo];
  return itens.map((i) =>
    i.key === novo.key ? { ...i, quantidade: i.quantidade + novo.quantidade } : i,
  );
}

export function removerItem(itens: RetiraCarrinhoItem[], key: string): RetiraCarrinhoItem[] {
  return itens.filter((i) => i.key !== key);
}

export function toRetiraLotePayload(itens: RetiraCarrinhoItem[]): RetiraLotePayload {
  return {
    itens: itens.map((i) => ({
      medication_id: i.medicationId,
      quantidade: i.quantidade,
      ...(i.pacienteId != null ? { paciente_id: i.pacienteId } : {}),
    })),
  };
}

export function describeCarrinhoItem(item: Pick<RetiraCarrinhoItem, "nome" | "lote">): string {
  return `${item.nome} - Lote ${item.lote}`;
}
