import { formatDateBR, toInputDateValue } from "../../utils/dateUtils";
import type { MedicationWithStatus } from "../../types";

/** Hoje civil local como YYYY-MM-DD (ambiente hospitalar BRT). */
export function todayIsoLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isLoteVencido(
  dataValidade: string,
  todayIso: string = todayIsoLocal(),
): boolean {
  const iso = toInputDateValue(dataValidade);
  if (!iso) return true;
  return iso < todayIso;
}

export function isLoteDisponivelParaRetira(
  m: Pick<MedicationWithStatus, "quantidade" | "data_validade">,
  todayIso: string = todayIsoLocal(),
): boolean {
  return Number(m.quantidade) > 0 && !isLoteVencido(m.data_validade, todayIso);
}

/**
 * FEFO: primeiro lote com estoque e validade >= hoje, ordenado por data_validade ASC.
 * Assume a lista já pode vir ordenada; reordena de forma estável por validade.
 */
export function pickRecommendedLotId(
  lots: MedicationWithStatus[],
  todayIso: string = todayIsoLocal(),
): number | null {
  const disponiveis = [...lots]
    .filter((m) => isLoteDisponivelParaRetira(m, todayIso))
    .sort((a, b) =>
      toInputDateValue(a.data_validade).localeCompare(
        toInputDateValue(b.data_validade),
      ),
    );
  return disponiveis[0]?.id ?? null;
}

export function formatLoteOptionLabel(
  m: MedicationWithStatus,
  recommendedId: number | null,
  todayIso: string = todayIsoLocal(),
): string {
  const base = `${m.nome} - Lote ${m.lote} - Validade ${formatDateBR(m.data_validade)} - Qtd ${m.quantidade}`;
  if (isLoteVencido(m.data_validade, todayIso)) {
    return `${base} · vencido`;
  }
  if (m.id === recommendedId) {
    return `${base} · recomendado`;
  }
  return base;
}
