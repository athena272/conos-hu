import { Calendar } from "primereact/calendar";
import {
  localDateToDateBR,
  parseDateBRToLocalDate,
} from "../../utils/dateUtils";

const DATA_LIBERACAO_MASK = "99/99/9999";
const DATA_LIBERACAO_PLACEHOLDER = "dd/mm/aaaa";
const MASK_SLOT_CHAR = "_";
/** Em PrimeReact, `yy` em dupla exibe o ano com 4 dígitos. */
const CALENDAR_DATE_FORMAT = "dd/mm/yy";

export interface PacientesDateRangeFilterProps {
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (value: string) => void;
  onDataFimChange: (value: string) => void;
}

function calendarValueToFilterString(e: {
  value?: Date | Date[] | string | null;
}): string {
  const v = e.value;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return localDateToDateBR(v);
  }
  return "";
}

/**
 * Filtro por intervalo de data de liberação (calendário + máscara dd/mm/aaaa, alinhado ao padrão PrimeReact do projeto).
 */
export function PacientesDateRangeFilter({
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
}: PacientesDateRangeFilterProps) {
  return (
    <>
      <span className="pacientes-filter-data-wrap">
        <label
          className="pacientes-filter-data-label"
          htmlFor="pacientes-filtro-data-inicio"
        >
          Liberação de
        </label>
        <Calendar
          inputId="pacientes-filtro-data-inicio"
          value={parseDateBRToLocalDate(dataInicio)}
          onChange={(e) => onDataInicioChange(calendarValueToFilterString(e))}
          dateFormat={CALENDAR_DATE_FORMAT}
          showIcon
          icon="pi pi-calendar"
          mask={DATA_LIBERACAO_MASK}
          maskSlotChar={MASK_SLOT_CHAR}
          placeholder={DATA_LIBERACAO_PLACEHOLDER}
          showButtonBar
          className="pacientes-calendar-filter"
          inputClassName="pacientes-calendar-filter-input"
        />
      </span>
      <span className="pacientes-filter-data-wrap">
        <label
          className="pacientes-filter-data-label"
          htmlFor="pacientes-filtro-data-fim"
        >
          Liberação até
        </label>
        <Calendar
          inputId="pacientes-filtro-data-fim"
          value={parseDateBRToLocalDate(dataFim)}
          onChange={(e) => onDataFimChange(calendarValueToFilterString(e))}
          dateFormat={CALENDAR_DATE_FORMAT}
          showIcon
          icon="pi pi-calendar"
          mask={DATA_LIBERACAO_MASK}
          maskSlotChar={MASK_SLOT_CHAR}
          placeholder={DATA_LIBERACAO_PLACEHOLDER}
          showButtonBar
          className="pacientes-calendar-filter"
          inputClassName="pacientes-calendar-filter-input"
        />
      </span>
    </>
  );
}
