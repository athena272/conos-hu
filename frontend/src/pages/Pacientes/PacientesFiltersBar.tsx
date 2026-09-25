import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import {
  retornoFilterPresetHoje,
  retornoFilterPresetProximos7Dias,
} from "../../utils/dateUtils";
import { PacientesDateRangeFilter } from "./PacientesDateRangeFilter";
import { SORT_OPTIONS } from "./pacienteFormModel";

export interface PacientesFiltersBarProps {
  busca: string;
  onBuscaChange: (value: string) => void;
  filtroLote: string;
  onFiltroLoteChange: (value: string) => void;
  sortKey: string;
  onSortKeyChange: (value: string) => void;
  filtrosAtivos: boolean;
  onLimparFiltros: () => void;
  filtroDataLiberacaoInicio: string;
  filtroDataLiberacaoFim: string;
  onFiltroDataLiberacaoInicioChange: (value: string) => void;
  onFiltroDataLiberacaoFimChange: (value: string) => void;
  filtroDataRetornoInicio: string;
  filtroDataRetornoFim: string;
  onFiltroDataRetornoInicioChange: (value: string) => void;
  onFiltroDataRetornoFimChange: (value: string) => void;
  filtroDataCadastroInicio: string;
  filtroDataCadastroFim: string;
  onFiltroDataCadastroInicioChange: (value: string) => void;
  onFiltroDataCadastroFimChange: (value: string) => void;
}

export function PacientesFiltersBar({
  busca,
  onBuscaChange,
  filtroLote,
  onFiltroLoteChange,
  sortKey,
  onSortKeyChange,
  filtrosAtivos,
  onLimparFiltros,
  filtroDataLiberacaoInicio,
  filtroDataLiberacaoFim,
  onFiltroDataLiberacaoInicioChange,
  onFiltroDataLiberacaoFimChange,
  filtroDataRetornoInicio,
  filtroDataRetornoFim,
  onFiltroDataRetornoInicioChange,
  onFiltroDataRetornoFimChange,
  filtroDataCadastroInicio,
  filtroDataCadastroFim,
  onFiltroDataCadastroInicioChange,
  onFiltroDataCadastroFimChange,
}: PacientesFiltersBarProps) {
  const retornoPresetHoje = retornoFilterPresetHoje();
  const retornoPresetProximos7 = retornoFilterPresetProximos7Dias();
  const retornoFiltroIsHoje =
    filtroDataRetornoInicio === retornoPresetHoje.inicio &&
    filtroDataRetornoFim === retornoPresetHoje.fim;
  const retornoFiltroIsProximos7 =
    filtroDataRetornoInicio === retornoPresetProximos7.inicio &&
    filtroDataRetornoFim === retornoPresetProximos7.fim;

  return (
    <div className="pacientes-filters-bar">
      <span className="pacientes-filter-busca">
        <i className="pi pi-search" aria-hidden />
        <InputText
          id="pacientes-filtro-busca"
          name="pacientes-filtro-busca"
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Digite o nome ou o medicamento"
          className="pacientes-input-busca"
          aria-label="Buscar por nome ou medicamento"
        />
      </span>
      <div className="pacientes-filters-bar-secondary">
        <div className="pacientes-filter-lote-wrap">
          <label
            className="pacientes-filter-data-label"
            htmlFor="pacientes-filtro-lote"
          >
            Lote
          </label>
          <InputText
            id="pacientes-filtro-lote"
            name="pacientes-filtro-lote"
            value={filtroLote}
            onChange={(e) => onFiltroLoteChange(e.target.value)}
            placeholder="Digite o lote"
            className="pacientes-input-lote"
          />
        </div>
        <div className="pacientes-filter-sort-wrap">
          <label
            className="pacientes-filter-data-label"
            htmlFor="pacientes-filtro-ordenacao"
          >
            Ordenar por
          </label>
          <Dropdown
            inputId="pacientes-filtro-ordenacao"
            name="pacientes-filtro-ordenacao"
            value={sortKey}
            options={SORT_OPTIONS}
            onChange={(e) =>
              onSortKeyChange(e.value ?? "proxima_data_retorno_asc")
            }
            placeholder="Selecione a ordenação"
            className="pacientes-dropdown-sort"
          />
        </div>
        <Button
          type="button"
          label="Limpar filtros"
          icon="pi pi-filter-slash"
          outlined
          className="pacientes-filter-clear-btn"
          onClick={onLimparFiltros}
          disabled={!filtrosAtivos}
          aria-label="Limpar filtros"
        />
      </div>
      <div className="pacientes-filters-date-groups">
        <PacientesDateRangeFilter
          tituloGrupo="Liberação"
          idPrefix="pacientes-filtro-liberacao"
          dataInicio={filtroDataLiberacaoInicio}
          dataFim={filtroDataLiberacaoFim}
          onDataInicioChange={onFiltroDataLiberacaoInicioChange}
          onDataFimChange={onFiltroDataLiberacaoFimChange}
        />
        <PacientesDateRangeFilter
          tituloGrupo="Retorno"
          hintGrupo="Qualquer retorno no período"
          idPrefix="pacientes-filtro-retorno"
          dataInicio={filtroDataRetornoInicio}
          dataFim={filtroDataRetornoFim}
          onDataInicioChange={onFiltroDataRetornoInicioChange}
          onDataFimChange={onFiltroDataRetornoFimChange}
          presets={
            <>
              <button
                type="button"
                className={`pacientes-filter-preset-chip${retornoFiltroIsHoje ? " is-active" : ""}`}
                aria-pressed={retornoFiltroIsHoje}
                onClick={() => {
                  onFiltroDataRetornoInicioChange(retornoPresetHoje.inicio);
                  onFiltroDataRetornoFimChange(retornoPresetHoje.fim);
                }}
              >
                Hoje
              </button>
              <button
                type="button"
                className={`pacientes-filter-preset-chip${retornoFiltroIsProximos7 ? " is-active" : ""}`}
                aria-pressed={retornoFiltroIsProximos7}
                onClick={() => {
                  onFiltroDataRetornoInicioChange(retornoPresetProximos7.inicio);
                  onFiltroDataRetornoFimChange(retornoPresetProximos7.fim);
                }}
              >
                Próximos 7 dias
              </button>
            </>
          }
        />
        <PacientesDateRangeFilter
          tituloGrupo="Cadastro"
          idPrefix="pacientes-filtro-cadastro"
          dataInicio={filtroDataCadastroInicio}
          dataFim={filtroDataCadastroFim}
          onDataInicioChange={onFiltroDataCadastroInicioChange}
          onDataFimChange={onFiltroDataCadastroFimChange}
        />
      </div>
    </div>
  );
}
