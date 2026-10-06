import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { AppDropdown } from "../../components/forms/AppDropdown";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { Boxes } from "lucide-react";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import FullScreenLoader from "../../components/FullScreenLoader";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  PaginationBar,
  PaginationSummary,
  useClientPagination,
} from "../../components/pagination";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import { normalizeResumoPorMedicamentoLista } from "../../utils/normalizeResumoPorMedicamento";
import {
  formatarMgPtBr,
  normalizePacienteLista,
  parseMgPorUnidadeFromConcentracao,
} from "../../utils/pacienteMedicamentoDisplay";
import type { Paciente, ResumoPorMedicamento } from "../../types";
import { PeriodoCalculoSelector } from "../Pacientes/PeriodoCalculoSelector";
import {
  CelulaMesesEstoqueResumo,
  CelulaPrevisaoMgResumo,
} from "../Pacientes/ResumoAuditoriaCelulas";
import { enrichResumoPorMedicamento } from "./enrichResumoPorMedicamento";
import {
  areResumoFiltersActive,
  DEFAULT_RESUMO_SORT,
  filterResumoPorMedicamento,
  RESUMO_SORT_OPTIONS,
  sortResumoPorMedicamento,
  type ResumoSortKey,
} from "./estoqueComprometidoFilters";
import "../Pacientes/styles.css";
import "./styles.css";

function PrevisaoMgColunaHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <span className="pacientes-mg-col-header">
      <span className="pacientes-mg-col-header-label">Previsão (mg)</span>
      <button
        type="button"
        className="pacientes-mg-info-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        aria-label="Explicar previsão em mg"
        title="O que significa esta coluna"
      >
        <i className="pi pi-info-circle" aria-hidden />
      </button>
    </span>
  );
}

export default function EstoqueComprometido() {
  const toast = useRef<Toast>(null);
  const [diasPeriodo, setDiasPeriodo] = useState(30);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [sortKey, setSortKey] = useState<ResumoSortKey>(DEFAULT_RESUMO_SORT);
  const [previsaoMgInfoVisible, setPrevisaoMgInfoVisible] = useState(false);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchResumoList = useCallback(async () => {
    const res = await api.get<ResumoPorMedicamento[]>(
      "/pacientes/resumo-por-medicamento",
    );
    return normalizeResumoPorMedicamentoLista(res.data);
  }, []);

  const fetchPacientesList = useCallback(async () => {
    const res = await api.get<Paciente[]>("/pacientes");
    return normalizePacienteLista(res.data ?? []);
  }, []);

  const {
    data: resumoPorMedicamento,
    loading: loadingResumo,
  } = useApiQuery(fetchResumoList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const {
    data: pacientes,
    loading: loadingPacientes,
  } = useApiQuery(fetchPacientesList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(busca), 300);
    return () => window.clearTimeout(t);
  }, [busca]);

  const resumoEnriquecido = useMemo(
    () => enrichResumoPorMedicamento(resumoPorMedicamento, pacientes),
    [resumoPorMedicamento, pacientes],
  );

  const filteredAndSorted = useMemo(() => {
    const filtered = filterResumoPorMedicamento(resumoEnriquecido, buscaDebounced);
    return sortResumoPorMedicamento(filtered, sortKey);
  }, [resumoEnriquecido, buscaDebounced, sortKey]);

  const paging = useClientPagination({
    rows: 10,
    total: filteredAndSorted.length,
  });
  const pagedRows = paging.slice(filteredAndSorted);

  useEffect(() => {
    paging.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on filter/sort
  }, [buscaDebounced, sortKey]);

  const filtrosAtivos = areResumoFiltersActive(busca, sortKey);
  const loading = loadingResumo || loadingPacientes;

  const limparFiltros = () => {
    setBusca("");
    setBuscaDebounced("");
    setSortKey(DEFAULT_RESUMO_SORT);
  };

  return (
    <div>
      <Toast ref={toast} position="top-right" />
      <FullScreenLoader active={loading} message="Carregando..." />
      <Header />
      <Menu />

      <div className="estoque-comprometido-page">
        <PageHeader
          title="Estoque por medicamento (comprometido)"
          description="Contagem por nome e concentração (todos os lotes desse medicamento)."
          icon={Boxes}
        />

        <PeriodoCalculoSelector
          diasPeriodo={diasPeriodo}
          onChange={setDiasPeriodo}
          idPrefix="estoque-comprometido-periodo"
          nota={
            diasPeriodo !== 30 ? (
              <span className="pacientes-periodo-hint">
                Simulação para {diasPeriodo} dias — não altera os dados salvos.
              </span>
            ) : null
          }
        />

        <div className="estoque-comprometido-filters">
          <div className="estoque-comprometido-busca">
            <i className="pi pi-search" aria-hidden />
            <InputText
              id="estoque-comprometido-busca"
              name="estoque-comprometido-busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o medicamento ou a concentração"
              aria-label="Buscar medicamento ou concentração"
              className="w-full estoque-comprometido-busca-input"
            />
          </div>
          <div className="estoque-comprometido-filters-secondary">
            <AppDropdown
              inputId="estoque-comprometido-ordenacao"
              name="estoque-comprometido-ordenacao"
              value={sortKey}
              options={RESUMO_SORT_OPTIONS}
              onChange={(e) => setSortKey(e.value as ResumoSortKey)}
              placeholder="Selecione a ordenação"
              aria-label="Ordenar estoque comprometido"
              className="estoque-comprometido-sort"
            />
            <Button
              type="button"
              label="Limpar filtros"
              icon="pi pi-filter-slash"
              className="p-button-outlined p-button-secondary"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            />
          </div>
        </div>

        <PaginationSummary
          page={paging.page}
          totalPages={paging.totalPages}
          total={filteredAndSorted.length}
          summaryLabel="medicamento(s)"
        />

        <DataTable
          key={`resumo-periodo-${diasPeriodo}`}
          value={pagedRows}
          size="small"
          emptyMessage={getDataTableEmptyMessage({
            loading: false,
            error: null,
            emptyLabel: filtrosAtivos
              ? "Nenhum medicamento corresponde aos filtros."
              : "Nenhum medicamento com pacientes vinculados.",
          })}
          className="pacientes-resumo-table"
        >
          <Column
            field="medicamento_nome"
            header="Medicamento"
            body={(r: ResumoPorMedicamento) =>
              `${r.medicamento_nome} - ${r.medicamento_concentracao}`
            }
          />
          <Column
            field="estoqueTotal"
            header="Estoque total"
            body={(r: ResumoPorMedicamento) => {
              const mgPorUnidade = parseMgPorUnidadeFromConcentracao(
                r.medicamento_concentracao,
              );
              const mgTotais =
                mgPorUnidade != null ? r.estoqueTotal * mgPorUnidade : null;
              return (
                <div className="pacientes-resumo-estoque-total">
                  <span>{r.estoqueTotal} unid.</span>
                  {mgTotais != null && (
                    <span className="pacientes-resumo-estoque-mg">
                      {formatarMgPtBr(mgTotais)}
                    </span>
                  )}
                </div>
              );
            }}
          />
          <Column field="qtdPacientes" header="Pacientes" />
          <Column
            header={() => (
              <PrevisaoMgColunaHeader
                onOpen={() => setPrevisaoMgInfoVisible(true)}
              />
            )}
            body={(r: ResumoPorMedicamento) => (
              <CelulaPrevisaoMgResumo
                row={r}
                pacientes={pacientes}
                diasPeriodo={diasPeriodo}
              />
            )}
          />
          <Column
            header={
              diasPeriodo === 30
                ? "Estoque dá para (meses)"
                : `Estoque dá para (períodos de ${diasPeriodo} dias)`
            }
            body={(r: ResumoPorMedicamento) => (
              <CelulaMesesEstoqueResumo
                row={r}
                pacientes={pacientes}
                diasPeriodo={diasPeriodo}
              />
            )}
          />
        </DataTable>

        <PaginationBar
          page={paging.page}
          totalPages={paging.totalPages}
          total={filteredAndSorted.length}
          summaryLabel="medicamento(s)"
          onPageChange={paging.setPage}
        />
      </div>

      <Dialog
        header="Previsão (mg)"
        visible={previsaoMgInfoVisible}
        onHide={() => setPrevisaoMgInfoVisible(false)}
        draggable={false}
        dismissableMask
        style={{ width: "min(92vw, 32rem)" }}
        className="pacientes-mg-info-dialog"
      >
        <div className="pacientes-mg-info-body">
          <p>
            Os valores são <strong>previsões de consumo</strong> calculadas a
            partir do <strong>vínculo paciente–medicamento</strong>.{" "}
            <strong>Não dependem</strong> de retiradas ou dispensação.
          </p>
          <p>
            <strong>Mg/dia:</strong> taxa diária prevista.{" "}
            <strong>Mg/mês:</strong> projeção em 30 dias (mg/dia × 30).{" "}
            <strong>Contextual:</strong> mg/ciclo no regime por ciclo; mg/dia nos
            demais.
          </p>
          <p className="pacientes-mg-info-nota">
            Se aparecer &quot;—&quot;, a concentração não permitiu extrair mg
            (exceto no regime &quot;Consumo por miligrama&quot;).
          </p>
          <p className="pacientes-mg-info-nota">
            Em <strong>Estoque dá para (meses)</strong>, a primeira linha usa
            consumo em <strong>unidades/dia</strong>; a segunda, em{" "}
            <strong>mg/dia</strong> (requer previsão em mg).
          </p>
        </div>
        <div className="pacientes-mg-info-footer">
          <Button
            label="Fechar"
            onClick={() => setPrevisaoMgInfoVisible(false)}
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  );
}
