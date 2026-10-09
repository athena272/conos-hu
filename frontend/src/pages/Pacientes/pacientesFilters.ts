import type { Paciente } from "../../types";
import { parseDateBRToISODate, toInputDateValue } from "../../utils/dateUtils";

/**
 * Filtra por intervalo inclusivo de datas ISO (YYYY-MM-DD).
 * Datas BR incompletas ou inválidas em dd/mm/aaaa ignoram aquele limite.
 * Quando `requireDate` é true e há ao menos um bound ativo, itens sem data são excluídos.
 */
function filterByIsoDateRange<T>(
  items: T[],
  getIsoDate: (item: T) => string | null | undefined,
  dataInicioBR: string,
  dataFimBR: string,
  requireDate: boolean,
): T[] {
  const isoInicio = parseDateBRToISODate(dataInicioBR);
  const isoFim = parseDateBRToISODate(dataFimBR);
  const hasActiveBound = Boolean(isoInicio || isoFim);
  let list = items;

  if (requireDate && hasActiveBound) {
    list = list.filter((item) => {
      const iso = getIsoDate(item);
      return Boolean(iso);
    });
  }

  if (isoInicio) {
    list = list.filter((item) => {
      const iso = getIsoDate(item);
      return Boolean(iso) && iso! >= isoInicio;
    });
  }
  if (isoFim) {
    list = list.filter((item) => {
      const iso = getIsoDate(item);
      return Boolean(iso) && iso! <= isoFim;
    });
  }
  return list;
}

/**
 * Mantém apenas pacientes cuja data de liberação (YYYY-MM-DD da API) está no intervalo inclusivo.
 * Datas em br incompletas ou inválidas em dd/mm/aaaa ignoram aquele limite.
 */
export function filterPacientesByDataLiberacaoRange(
  pacientes: Paciente[],
  dataInicioBR: string,
  dataFimBR: string,
): Paciente[] {
  return filterByIsoDateRange(
    pacientes,
    (p) => toInputDateValue(p.data_liberacao) || null,
    dataInicioBR,
    dataFimBR,
    false,
  );
}

function isoDatesRetornoPaciente(p: Paciente): string[] {
  if (p.datas_retorno && p.datas_retorno.length > 0) {
    return p.datas_retorno
      .map((d) => toInputDateValue(d) || "")
      .filter(Boolean);
  }
  if (p.proxima_data_retorno) {
    const iso = toInputDateValue(p.proxima_data_retorno);
    return iso ? [iso] : [];
  }
  return [];
}

/**
 * Mantém pacientes que possuem qualquer data de retorno no intervalo inclusivo.
 * Usa `datas_retorno` (agenda completa); fallback para `proxima_data_retorno`.
 * Com qualquer bound ativo, pacientes sem datas de retorno são excluídos.
 */
export function filterPacientesByProximaDataRetornoRange(
  pacientes: Paciente[],
  dataInicioBR: string,
  dataFimBR: string,
): Paciente[] {
  const isoInicio = parseDateBRToISODate(dataInicioBR);
  const isoFim = parseDateBRToISODate(dataFimBR);
  const hasActiveBound = Boolean(isoInicio || isoFim);
  if (!hasActiveBound) return pacientes;

  return pacientes.filter((p) => {
    const datas = isoDatesRetornoPaciente(p);
    if (datas.length === 0) return false;
    return datas.some((iso) => {
      if (isoInicio && iso < isoInicio) return false;
      if (isoFim && iso > isoFim) return false;
      return true;
    });
  });
}

/**
 * Mantém pacientes cuja data de cadastro no sistema está no intervalo inclusivo.
 * Com qualquer bound ativo, pacientes sem `data_cadastro` são excluídos.
 */
export function filterPacientesByDataCadastroRange(
  pacientes: Paciente[],
  dataInicioBR: string,
  dataFimBR: string,
): Paciente[] {
  return filterByIsoDateRange(
    pacientes,
    (p) =>
      p.data_cadastro ? toInputDateValue(p.data_cadastro) || null : null,
    dataInicioBR,
    dataFimBR,
    true,
  );
}

export type PacientesSortDir = "asc" | "desc";

export interface PacientesSortKeyParsed {
  field: string;
  dir: PacientesSortDir;
}

/**
 * Extrai campo e direção de chaves como `proxima_data_retorno_asc`.
 * Usa o sufixo `_asc` / `_desc` (não `split("_")`, que quebra campos com underscore).
 */
export function parsePacientesSortKey(sortKey: string): PacientesSortKeyParsed {
  if (sortKey.endsWith("_desc")) {
    return { field: sortKey.slice(0, -"_desc".length), dir: "desc" };
  }
  if (sortKey.endsWith("_asc")) {
    return { field: sortKey.slice(0, -"_asc".length), dir: "asc" };
  }
  return { field: sortKey, dir: "asc" };
}
