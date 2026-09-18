import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import FullScreenLoader from "../../components/FullScreenLoader";
import {
  PaginationBar,
  PaginationSummary,
} from "../../components/pagination";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import {
  EVENTO_ACAO_FILTER_OPTIONS,
  EVENTO_ENTIDADE_FILTER_OPTIONS,
  formatEventoDateTime,
  formatEventoResponsavel,
  getEventoAcaoLabel,
  getEventoEntidadeLabel,
} from "../../utils/eventoLabels";
import type { Evento, EventosListResponse } from "../../types/evento";
import { normalizeEventosListResponse } from "../../utils/normalizeEventosListResponse";
import EventoDetalhesCell from "./EventoDetalhesCell";
import { areHistoricoContentFiltersActive } from "./historicoFilters";
import "./styles.css";

const PAGE_SIZE_OPTIONS = [
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const EMPTY_PAGE: EventosListResponse = {
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
  limit: 20,
};

export default function Historico() {
  const toast = useRef<Toast>(null);
  const [acaoFilter, setAcaoFilter] = useState<string | null>(null);
  const [entidadeFilter, setEntidadeFilter] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(20);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchEventos = useCallback(async () => {
    const params: Record<string, string | number> = {
      page,
      limit: rows,
    };
    if (typeof acaoFilter === "string") params.acao = acaoFilter;
    if (typeof entidadeFilter === "string") params.entidade_tipo = entidadeFilter;
    if (dataInicio.trim()) params.data_inicio = dataInicio.trim();
    if (dataFim.trim()) params.data_fim = dataFim.trim();
    if (searchQuery.trim()) params.q = searchQuery.trim();
    const response = await api.get<EventosListResponse | Evento[]>("/eventos", { params });
    return normalizeEventosListResponse(response.data, { page, limit: rows });
  }, [acaoFilter, entidadeFilter, dataInicio, dataFim, searchQuery, page, rows]);

  const {
    data: eventosPage,
    loading,
    error,
  } = useApiQuery(fetchEventos, [acaoFilter, entidadeFilter, dataInicio, dataFim, searchQuery, page, rows], {
    initialData: EMPTY_PAGE,
    onError: (message) => showFetchError(message),
  });

  const items = eventosPage.items ?? [];
  const total = eventosPage.total ?? 0;
  const currentPage = eventosPage.page ?? page;
  const totalPages = eventosPage.totalPages ?? 1;

  const filtrosAtivos = areHistoricoContentFiltersActive({
    acaoFilter,
    entidadeFilter,
    dataInicio,
    dataFim,
    searchInput,
  });

  const limparFiltros = () => {
    setAcaoFilter(null);
    setEntidadeFilter(null);
    setDataInicio("");
    setDataFim("");
    setSearchInput("");
    setSearchQuery("");
    setPage(1);
  };

  return (
    <div>
      <Toast ref={toast} position="top-right" />
      <FullScreenLoader active={loading} message="Carregando histórico..." />
      <Header />
      <Menu />
      <div className="historico-container">
        <div className="historico-header">
          <h2>Histórico de ações</h2>
          <p className="historico-subtitle">
            Registro das ações de escrita no sistema e seus responsáveis.
          </p>
        </div>

        <div className="historico-filters">
          <div className="historico-filter-field historico-filter-search">
            <label htmlFor="historico-busca">Busca</label>
            <span className="p-input-icon-left historico-search-wrap">
              <i className="pi pi-search" />
              <InputText
                id="historico-busca"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Responsável, detalhes, ação..."
                className="historico-search-input"
              />
            </span>
          </div>

          <div className="historico-filters-secondary">
            <div className="historico-filter-field">
              <label htmlFor="historico-acao-filter">Ação</label>
              <Dropdown
                id="historico-acao-filter"
                value={acaoFilter}
                options={EVENTO_ACAO_FILTER_OPTIONS}
                onChange={(e) => {
                  setAcaoFilter(asStringOrNull(e.value));
                  setPage(1);
                }}
                placeholder="Todas as ações"
                className="historico-filter-dropdown"
                showClear
              />
            </div>

            <div className="historico-filter-field">
              <label htmlFor="historico-entidade-filter">Entidade</label>
              <Dropdown
                id="historico-entidade-filter"
                value={entidadeFilter}
                options={EVENTO_ENTIDADE_FILTER_OPTIONS}
                onChange={(e) => {
                  setEntidadeFilter(asStringOrNull(e.value));
                  setPage(1);
                }}
                placeholder="Todas as entidades"
                className="historico-filter-dropdown"
                showClear
              />
            </div>

            <div className="historico-filter-field">
              <label htmlFor="historico-data-inicio">Data início</label>
              <input
                id="historico-data-inicio"
                type="date"
                className="historico-date-input"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="historico-filter-field">
              <label htmlFor="historico-data-fim">Data fim</label>
              <input
                id="historico-data-fim"
                type="date"
                className="historico-date-input"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="historico-filter-field">
              <label htmlFor="historico-page-size">Por página</label>
              <Dropdown
                inputId="historico-page-size"
                value={rows}
                options={PAGE_SIZE_OPTIONS}
                onChange={(e) => {
                  setRows(typeof e.value === "number" ? e.value : 20);
                  setPage(1);
                }}
                className="historico-filter-dropdown historico-page-size"
              />
            </div>

            <Button
              type="button"
              label="Limpar filtros"
              icon="pi pi-filter-slash"
              outlined
              className="historico-filter-clear-btn"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
              aria-label="Limpar filtros"
            />
          </div>
        </div>

        <div className="pagination-table-block">
          <div className="pagination-toolbar">
            <PaginationSummary
              page={currentPage}
              totalPages={totalPages}
              total={total}
              summaryLabel="registro(s)"
            />
          </div>

          <DataTable
            value={items}
            size="small"
            emptyMessage={getDataTableEmptyMessage({
              loading,
              error,
              emptyLabel: searchQuery.trim()
                ? "Nenhum evento corresponde à busca."
                : "Nenhum evento registrado.",
            })}
            className="historico-table"
            stripedRows
          >
            <Column
              header="Data/Hora"
              style={{ minWidth: "10rem" }}
              body={(row: Evento) => formatEventoDateTime(row.created_at)}
            />
            <Column
              header="Ação"
              style={{ minWidth: "12rem" }}
              body={(row: Evento) => getEventoAcaoLabel(row.acao)}
            />
            <Column
              header="Entidade"
              style={{ minWidth: "8rem" }}
              body={(row: Evento) => {
                const label = getEventoEntidadeLabel(row.entidade_tipo);
                return row.entidade_id != null ? `${label} #${row.entidade_id}` : label;
              }}
            />
            <Column
              header="Responsável"
              style={{ minWidth: "12rem" }}
              body={(row: Evento) => formatEventoResponsavel(row)}
            />
            <Column
              header="Detalhes"
              style={{ minWidth: "18rem", maxWidth: "28rem" }}
              body={(row: Evento) => <EventoDetalhesCell detalhes={row.detalhes} />}
            />
          </DataTable>

          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={total}
            summaryLabel="registro(s)"
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );
}
