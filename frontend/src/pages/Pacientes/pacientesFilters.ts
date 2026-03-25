import type { Paciente } from "../../types";
import { parseDateBRToISODate, toInputDateValue } from "../../utils/dateUtils";

/**
 * Mantém apenas pacientes cuja data de liberação (YYYY-MM-DD da API) está no intervalo inclusivo.
 * Datas em br incompletas ou inválidas em dd/mm/aaaa ignoram aquele limite.
 */
export function filterPacientesByDataLiberacaoRange(
  pacientes: Paciente[],
  dataInicioBR: string,
  dataFimBR: string,
): Paciente[] {
  const isoInicio = parseDateBRToISODate(dataInicioBR);
  const isoFim = parseDateBRToISODate(dataFimBR);
  let list = pacientes;
  if (isoInicio) {
    list = list.filter(
      (p) => toInputDateValue(p.data_liberacao) >= isoInicio,
    );
  }
  if (isoFim) {
    list = list.filter(
      (p) => toInputDateValue(p.data_liberacao) <= isoFim,
    );
  }
  return list;
}
