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

function compareByValidade(
  a: Pick<MedicationWithStatus, "data_validade">,
  b: Pick<MedicationWithStatus, "data_validade">,
): number {
  return toInputDateValue(a.data_validade).localeCompare(toInputDateValue(b.data_validade));
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
    .sort(compareByValidade);
  return disponiveis[0]?.id ?? null;
}

/** Identifica o medicamento (nome + concentração), tolerando caixa e espaços ("500 mg" = "500mg"). */
export function medicamentoGroupKey(
  m: Pick<MedicationWithStatus, "nome" | "concentracao">,
): string {
  const nome = m.nome.trim().toLowerCase().replace(/\s+/g, " ");
  const concentracao = (m.concentracao ?? "").toLowerCase().replace(/\s+/g, "");
  return `${nome}|${concentracao}`;
}

/** FEFO por medicamento: chave do medicamento → id do lote que vence primeiro entre os disponíveis. */
export function pickRecommendedLotIdsByMedicamento(
  lots: MedicationWithStatus[],
  todayIso: string = todayIsoLocal(),
): Map<string, number> {
  const recomendados = new Map<string, MedicationWithStatus>();
  for (const lot of lots) {
    if (!isLoteDisponivelParaRetira(lot, todayIso)) continue;
    const key = medicamentoGroupKey(lot);
    const atual = recomendados.get(key);
    if (!atual || compareByValidade(lot, atual) < 0) {
      recomendados.set(key, lot);
    }
  }
  return new Map([...recomendados].map(([key, lot]) => [key, lot.id]));
}

/** Ordena para o select: nome, concentração e validade (pt-BR, ignora acentos e caixa). */
export function sortLotesParaSelecao(lots: MedicationWithStatus[]): MedicationWithStatus[] {
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  return [...lots].sort(
    (a, b) =>
      collator.compare(a.nome.trim(), b.nome.trim()) ||
      collator.compare(a.concentracao ?? "", b.concentracao ?? "") ||
      compareByValidade(a, b),
  );
}

/** Nome com a concentração (ex.: "Dipirona 500mg"), para doses diferentes não se confundirem. */
export function formatMedicamentoNome(m: Pick<MedicationWithStatus, "nome" | "concentracao">): string {
  const concentracao = m.concentracao?.trim();
  return concentracao ? `${m.nome} ${concentracao}` : m.nome;
}

export function formatLoteOptionLabel(
  m: MedicationWithStatus,
  isRecommended: boolean,
  todayIso: string = todayIsoLocal(),
): string {
  const base = `${formatMedicamentoNome(m)} - Lote ${m.lote} - Validade ${formatDateBR(m.data_validade)} - Qtd ${m.quantidade}`;
  if (isLoteVencido(m.data_validade, todayIso)) {
    return `${base} · vencido`;
  }
  if (isRecommended) {
    return `${base} · recomendado`;
  }
  return base;
}
