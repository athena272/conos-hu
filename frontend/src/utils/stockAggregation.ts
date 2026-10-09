import type {
  MedicationWithStatus,
  MedicationStatus,
  MedicationAggregated,
} from "../types/medication";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PROXIMO_VENCER = 90;

function getStatusFromQuantityAndMaxValidity(
  quantidadeTotal: number,
  maxValidade: Date | null
): MedicationStatus {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (quantidadeTotal <= 0) return "emFalta";
  if (!maxValidade) return "emFalta";

  if (maxValidade < hoje) return "foraValidade";

  const diasAteValidade =
    (maxValidade.getTime() - hoje.getTime()) / MS_PER_DAY;
  if (diasAteValidade <= DAYS_PROXIMO_VENCER) return "proximoVencer";
  return "emEstoque";
}

/**
 * Agrupa medicamentos por nome (case-insensitive) e calcula quantidade total,
 * validade e status para exibição no painel por medicamento.
 */
export function aggregateByMedication(
  medications: MedicationWithStatus[]
): MedicationAggregated[] {
  const byKey = new Map<
    string,
    { items: MedicationWithStatus[]; nomeExibicao: string }
  >();

  for (const med of medications) {
    const key = med.nome.trim().toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(med);
    } else {
      byKey.set(key, { items: [med], nomeExibicao: med.nome.trim() });
    }
  }

  const result: MedicationAggregated[] = [];

  byKey.forEach(({ items, nomeExibicao }, nomeNormalizado) => {
    const quantidadeTotal = items.reduce((sum, m) => sum + m.quantidade, 0);
    const lotesComEstoque = items.filter((m) => m.quantidade > 0);

    let maxValidade: Date | null = null;
    const datasDistintas = new Set<string>();

    for (const m of lotesComEstoque) {
      const d = new Date(m.data_validade);
      if (!maxValidade || d > maxValidade) maxValidade = d;
      datasDistintas.add(String(m.data_validade).split("T")[0]);
    }

    const status = getStatusFromQuantityAndMaxValidity(
      quantidadeTotal,
      maxValidade
    );

    const dataValidadeExibicao =
      lotesComEstoque.length === 0
        ? "—"
        : datasDistintas.size > 1
          ? "Várias"
          : lotesComEstoque[0].data_validade;

    result.push({
      nomeExibicao,
      nomeNormalizado,
      quantidadeTotal,
      dataValidadeExibicao,
      status,
      lotesIds: items.map((i) => i.id),
    });
  });

  return result;
}
