/**
 * Extrai mg por unidade (comprimido/cápsula) a partir do texto livre de concentração.
 * Ex.: "500mg", "500 mg", "250,5mg" → número em mg; outras unidades → null.
 */
export function parseMgPorUnidadeFromConcentracao(concentracao: string): number | null {
  const s = String(concentracao ?? "").trim();
  if (!s) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*mg\b/i.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Total em mg = unidades × mg por unidade; null se não der para calcular. */
export function mgTotaisFromUnidades(
  quantidadeUnidades: number,
  concentracao: string,
): number | null {
  const mg = parseMgPorUnidadeFromConcentracao(concentracao);
  if (mg == null) return null;
  const q = Number(quantidadeUnidades);
  if (!Number.isFinite(q) || q <= 0) return null;
  return q * mg;
}
