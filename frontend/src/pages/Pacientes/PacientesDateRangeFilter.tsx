import { Calendar } from "primereact/calendar";
import {
  localDateToDateBR,
  parseDateBRToLocalDate,
} from "../../utils/dateUtils";

const DATE_FILTER_MASK = "99/99/9999";
const DATE_FILTER_PLACEHOLDER = "dd/mm/aaaa";
const MASK_SLOT_CHAR = "_";
/** Em PrimeReact, `yy` em dupla exibe o ano com 4 dígitos. */
const CALENDAR_DATE_FORMAT = "dd/mm/yy";

export interface PacientesDateRangeFilterProps {
  tituloGrupo: string;
  /** Texto auxiliar abaixo do título do grupo. */
  hintGrupo?: string;
  labelInicio?: string;
  labelFim?: string;
  idPrefix: string;
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
 * Filtro por intervalo de datas (calendário + máscara dd/mm/aaaa),
 * agrupado sob um título para desambiguar intervalos distintos na barra.
 */
export function PacientesDateRangeFilter({
  tituloGrupo,
  hintGrupo,
  labelInicio = "De",
  labelFim = "Até",
  idPrefix,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
}: PacientesDateRangeFilterProps) {
  const idInicio = `${idPrefix}-inicio`;
  const idFim = `${idPrefix}-fim`;

  return (
    <div className="pacientes-filter-date-group" role="group" aria-label={tituloGrupo}>
      <span className="pacientes-filter-date-group-title">{tituloGrupo}</span>
      {hintGrupo ? (
        <span className="pacientes-filter-date-group-hint">{hintGrupo}</span>
      ) : null}
      <div className="pacientes-filter-date-group-fields">
        <span className="pacientes-filter-data-wrap">
          <label className="pacientes-filter-data-label" htmlFor={idInicio}>
            {labelInicio}
          </label>
          <Calendar
            inputId={idInicio}
            name={idInicio}
            value={parseDateBRToLocalDate(dataInicio)}
            onChange={(e) => onDataInicioChange(calendarValueToFilterString(e))}
            dateFormat={CALENDAR_DATE_FORMAT}
            showIcon
            icon="pi pi-calendar"
            mask={DATE_FILTER_MASK}
            maskSlotChar={MASK_SLOT_CHAR}
            placeholder={DATE_FILTER_PLACEHOLDER}
            showButtonBar
            className="pacientes-calendar-filter"
            inputClassName="pacientes-calendar-filter-input"
          />
        </span>
        <span className="pacientes-filter-data-wrap">
          <label className="pacientes-filter-data-label" htmlFor={idFim}>
            {labelFim}
          </label>
          <Calendar
            inputId={idFim}
            name={idFim}
            value={parseDateBRToLocalDate(dataFim)}
            onChange={(e) => onDataFimChange(calendarValueToFilterString(e))}
            dateFormat={CALENDAR_DATE_FORMAT}
            showIcon
            icon="pi pi-calendar"
            mask={DATE_FILTER_MASK}
            maskSlotChar={MASK_SLOT_CHAR}
            placeholder={DATE_FILTER_PLACEHOLDER}
            showButtonBar
            className="pacientes-calendar-filter"
            inputClassName="pacientes-calendar-filter-input"
          />
        </span>
      </div>
    </div>
  );
}
