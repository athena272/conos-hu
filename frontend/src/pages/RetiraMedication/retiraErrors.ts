import { normalizeErrorMessage } from "../../utils/errorMessages";
import { describeCarrinhoItem, type RetiraCarrinhoItem } from "./retiraCarrinho";

export type RetiraErrorSeverity = "warn" | "error";

interface RetiraApiErrorLike {
  response?: {
    status?: number;
    data?: { error?: string; item_index?: number };
  };
}

/** Erros de estoque/validade que a pessoa consegue corrigir na tela. */
const AVISOS_CORRIGIVEIS = new Set(["Quantidade insuficiente em estoque", "Lote fora da validade"]);

export function resolveRetiraErrorSeverity(error: unknown): RetiraErrorSeverity {
  const response = (error as RetiraApiErrorLike | undefined)?.response;
  const apiError = response?.data?.error;
  return response?.status === 400 && apiError != null && AVISOS_CORRIGIVEIS.has(apiError)
    ? "warn"
    : "error";
}

/** Mensagem do erro da retirada em lote, citando o item apontado por `item_index`. */
export function formatRetiraLoteErrorMessage(error: unknown, itens: RetiraCarrinhoItem[]): string {
  const message = normalizeErrorMessage(error);
  const itemIndex = (error as RetiraApiErrorLike | undefined)?.response?.data?.item_index;
  if (typeof itemIndex !== "number") return message;
  const item = itens[itemIndex];
  if (!item) return message;
  return `Item ${itemIndex + 1} (${describeCarrinhoItem(item)}): ${message}`;
}
