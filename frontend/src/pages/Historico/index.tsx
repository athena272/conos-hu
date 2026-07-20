import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import FullScreenLoader from "../../components/FullScreenLoader";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import {
  EVENTO_ACAO_FILTER_OPTIONS,
  EVENTO_ENTIDADE_FILTER_OPTIONS,
  eventMatchesSearch,
  formatEventoDateTime,
  getEventoAcaoLabel,
  getEventoEntidadeLabel,
} from "../../utils/eventoLabels";
import type { Evento } from "../../types/evento";
import EventoDetalhesCell from "./EventoDetalhesCell";
import "./styles.css";

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default function Historico() {
  const toast = useRef<Toast>(null);
  const [acaoFilter, setAcaoFilter] = useState<string | null>(null);
  const [entidadeFilter, setEntidadeFilter] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(searchInput), 300);
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
    const params: Record<string, string | number> = { limit: 200 };
    if (typeof acaoFilter === "string") params.acao = acaoFilter;
    if (typeof entidadeFilter === "string") params.entidade_tipo = entidadeFilter;
    if (dataInicio.trim()) params.data_inicio = dataInicio.trim();
    if (dataFim.trim()) params.data_fim = dataFim.trim();
    const response = await api.get<Evento[]>("/eventos", { params });
    return response.data ?? [];
  }, [acaoFilter, entidadeFilter, dataInicio, dataFim]);

  const {
    data: eventos,
    loading,
    error,
  } = useApiQuery(fetchEventos, [acaoFilter, entidadeFilter, dataInicio, dataFim], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const rows = useMemo(
    () => eventos.filter((e) => eventMatchesSearch(e, searchQuery)),
    [eventos, searchQuery],
  );

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
          <div className="historico-filter-field">
            <label htmlFor="historico-acao-filter">Ação</label>
            <Dropdown
              id="historico-acao-filter"
              value={acaoFilter}
              options={EVENTO_ACAO_FILTER_OPTIONS}
              onChange={(e) => setAcaoFilter(asStringOrNull(e.value))}
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
              onChange={(e) => setEntidadeFilter(asStringOrNull(e.value))}
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
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div className="historico-filter-field">
            <label htmlFor="historico-data-fim">Data fim</label>
            <input
              id="historico-data-fim"
              type="date"
              className="historico-date-input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

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
        </div>

        <DataTable
          value={rows}
          size="small"
          paginator
          rows={20}
          rowsPerPageOptions={[10, 20, 50]}
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
            body={(row: Evento) => row.usuario_email ?? `Usuário #${row.usuario_id}`}
          />
          <Column
            header="Detalhes"
            style={{ minWidth: "18rem", maxWidth: "28rem" }}
            body={(row: Evento) => <EventoDetalhesCell detalhes={row.detalhes} />}
          />
        </DataTable>
      </div>
    </div>
  );
}
