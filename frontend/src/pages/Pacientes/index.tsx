import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { sessionCanWritePacientes } from "../../auth/session";
import { FormikHelpers } from "formik";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { Tooltip } from "primereact/tooltip";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { PageHeader } from "../../components/layout/PageHeader";
import { Users } from "lucide-react";
import FullScreenLoader from "../../components/FullScreenLoader";
import {
  PaginationBar,
  PaginationSummary,
  useClientPagination,
} from "../../components/pagination";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import { useApiQuery } from "../../hooks/useApiQuery";
import { formatDateBR } from "../../utils/dateUtils";

import type {
  Paciente,
  PacienteRetorno,
  ImpactoEstoque,
  MedicamentoDistinto,
  RegimeConsumoMedicamento,
} from "../../types";
import { normalizePacienteLista } from "../../utils/pacienteMedicamentoDisplay";
import {
  filterPacientesByDataCadastroRange,
  filterPacientesByDataLiberacaoRange,
  filterPacientesByProximaDataRetornoRange,
  parsePacientesSortKey,
} from "./pacientesFilters";
import { CelulaPrevisaoMg } from "./PrevisaoMgCelula";
import {
  PrevisaoMgColunaHeader,
  PrevisaoMgInfoDialog,
} from "./PrevisaoMgInfoDialog";
import { PacienteFormDialog } from "./PacienteFormDialog";
import { PacientesFiltersBar } from "./PacientesFiltersBar";
import { HistoricoRetornosDialog } from "./HistoricoRetornosDialog";
import { ConfirmarCadastroPacienteDialog } from "./ConfirmarCadastroPacienteDialog";
import {
  initialFormValues,
  buildImpactoEstoquePath,
  formatTipoRetorno,
  buildPayload,
  buildEditFormInitialValues,
  type FormValues,
} from "./pacienteFormModel";
import "./styles.css";

const TOOLTIP_IDENTIFICACAO_REDACT =
  "Somente usuários administradores do Conos visualizam nome e prontuário completos.";

export default function Pacientes() {
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchPacientesList = useCallback(async () => {
    const res = await api.get<Paciente[]>("/pacientes");
    return normalizePacienteLista(res.data);
  }, []);

  const fetchMedicamentosDistintosList = useCallback(async () => {
    const res = await api.get<MedicamentoDistinto[]>(
      "/medications/distinct-nome-concentration",
    );
    return res.data ?? [];
  }, []);

  const {
    data: pacientes,
    loading: loadingPacientes,
    error: pacientesError,
    reload: reloadPacientes,
  } = useApiQuery(fetchPacientesList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const {
    data: medicamentosDistintos,
    loading: loadingMedicamentosDistintos,
  } = useApiQuery(fetchMedicamentosDistintosList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });
  const [formVisible, setFormVisible] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [impactDataList, setImpactDataList] = useState<ImpactoEstoque[]>([]);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [deletingPaciente, setDeletingPaciente] = useState<Paciente | null>(
    null,
  );
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [historicoPaciente, setHistoricoPaciente] = useState<Paciente | null>(
    null,
  );

  const historicoPacienteId = historicoPaciente?.id;
  const fetchHistoricoRetornos = useCallback(async () => {
    if (historicoPacienteId == null) return [];
    const res = await api.get<PacienteRetorno[]>(
      `/pacientes/${historicoPacienteId}/retornos`,
    );
    return res.data ?? [];
  }, [historicoPacienteId]);

  const {
    data: historicoRetornos,
    loading: loadingHistorico,
    reload: reloadHistorico,
  } = useApiQuery(fetchHistoricoRetornos, [historicoPaciente?.id], {
    enabled: !!historicoPaciente,
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const [previsaoMgInfoVisible, setPrevisaoMgInfoVisible] = useState(false);
  const [novaDataRetorno, setNovaDataRetorno] = useState("");
  const [novoTipoRetorno, setNovoTipoRetorno] = useState("");
  const [addingRetorno, setAddingRetorno] = useState(false);
  const [showAddRetornoForm, setShowAddRetornoForm] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroDataLiberacaoInicio, setFiltroDataLiberacaoInicio] =
    useState("");
  const [filtroDataLiberacaoFim, setFiltroDataLiberacaoFim] = useState("");
  const [filtroDataRetornoInicio, setFiltroDataRetornoInicio] = useState("");
  const [filtroDataRetornoFim, setFiltroDataRetornoFim] = useState("");
  const [filtroDataCadastroInicio, setFiltroDataCadastroInicio] = useState("");
  const [filtroDataCadastroFim, setFiltroDataCadastroFim] = useState("");
  const [sortKey, setSortKey] = useState("proxima_data_retorno_asc");

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(busca), 300);
    return () => window.clearTimeout(t);
  }, [busca]);

  const filtrosAtivos = Boolean(
    busca.trim() ||
      filtroLote.trim() ||
      filtroDataLiberacaoInicio ||
      filtroDataLiberacaoFim ||
      filtroDataRetornoInicio ||
      filtroDataRetornoFim ||
      filtroDataCadastroInicio ||
      filtroDataCadastroFim ||
      sortKey !== "proxima_data_retorno_asc",
  );

  const limparFiltros = () => {
    setBusca("");
    setBuscaDebounced("");
    setFiltroLote("");
    setFiltroDataLiberacaoInicio("");
    setFiltroDataLiberacaoFim("");
    setFiltroDataRetornoInicio("");
    setFiltroDataRetornoFim("");
    setFiltroDataCadastroInicio("");
    setFiltroDataCadastroFim("");
    setSortKey("proxima_data_retorno_asc");
  };

  const filteredAndSortedPacientes = useMemo(() => {
    let list = pacientes;
    const buscaNorm = buscaDebounced.trim().toLowerCase();
    if (buscaNorm) {
      list = list.filter((p) => {
        if (p.nome.toLowerCase().includes(buscaNorm)) return true;
        const meds = p.medicamentos ?? [];
        return meds.some(
          (m) =>
            m.medicamento_nome.toLowerCase().includes(buscaNorm) ||
            (m.medicamento_concentracao ?? "").toLowerCase().includes(buscaNorm)
        );
      });
    }
    const loteNorm = filtroLote.trim().toLowerCase();
    if (loteNorm) {
      list = list.filter((p) =>
        (p.lotes ?? []).some((l) => l.toLowerCase().includes(loteNorm))
      );
    }
    list = filterPacientesByDataLiberacaoRange(
      list,
      filtroDataLiberacaoInicio,
      filtroDataLiberacaoFim,
    );
    list = filterPacientesByProximaDataRetornoRange(
      list,
      filtroDataRetornoInicio,
      filtroDataRetornoFim,
    );
    list = filterPacientesByDataCadastroRange(
      list,
      filtroDataCadastroInicio,
      filtroDataCadastroFim,
    );
    const { field, dir } = parsePacientesSortKey(sortKey);
    const asc = dir === "asc";
    return [...list].sort((a, b) => {
      if (field === "proxima_data_retorno") {
        const da = a.proxima_data_retorno ?? null;
        const db = b.proxima_data_retorno ?? null;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return asc ? da.localeCompare(db) : db.localeCompare(da);
      }
      if (field === "nome") {
        if (a.identificadoresRedatados && b.identificadoresRedatados) {
          return asc ? a.id - b.id : b.id - a.id;
        }
        return asc
          ? a.nome.localeCompare(b.nome)
          : b.nome.localeCompare(a.nome);
      }
      if (field === "data_liberacao")
        return asc
          ? a.data_liberacao.localeCompare(b.data_liberacao)
          : b.data_liberacao.localeCompare(a.data_liberacao);
      if (field === "prontuario") {
        const ar =
          a.identificadoresRedatados === true ? a.id : a.prontuario;
        const br =
          b.identificadoresRedatados === true ? b.id : b.prontuario;
        return asc ? ar - br : br - ar;
      }
      return 0;
    });
  }, [
    pacientes,
    buscaDebounced,
    filtroLote,
    filtroDataLiberacaoInicio,
    filtroDataLiberacaoFim,
    filtroDataRetornoInicio,
    filtroDataRetornoFim,
    filtroDataCadastroInicio,
    filtroDataCadastroFim,
    sortKey,
  ]);

  const pacientesPaging = useClientPagination({
    rows: 10,
    total: filteredAndSortedPacientes.length,
  });
  const pagedPacientes = pacientesPaging.slice(filteredAndSortedPacientes);

  useEffect(() => {
    pacientesPaging.resetPage();
    // Reset only when filter/sort inputs change, not when page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps
  }, [
    buscaDebounced,
    filtroLote,
    filtroDataLiberacaoInicio,
    filtroDataLiberacaoFim,
    filtroDataRetornoInicio,
    filtroDataRetornoFim,
    filtroDataCadastroInicio,
    filtroDataCadastroFim,
    sortKey,
  ]);

  useEffect(() => {
    if (!historicoPaciente) {
      setShowAddRetornoForm(false);
      setNovaDataRetorno("");
      setNovoTipoRetorno("");
    }
  }, [historicoPaciente]);

  const openCreate = () => {
    setEditingPaciente(null);
    setFormVisible(true);
  };

  const openEdit = (p: Paciente) => {
    setEditingPaciente(p);
    setFormVisible(true);
  };

  const handleAddRetorno = () => {
    if (!historicoPaciente || !novaDataRetorno.trim()) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Informe a data de retorno.",
        life: 3000,
      });
      return;
    }
    setAddingRetorno(true);
    api
      .post(`/pacientes/${historicoPaciente.id}/retornos`, {
        data_retorno: novaDataRetorno.trim(),
        tipo_retorno: novoTipoRetorno.trim() || undefined,
      })
      .then(() => {
        toast.current?.show({
          severity: "success",
          summary: "Sucesso",
          detail: "Data de retorno adicionada.",
          life: 3000,
        });
        setNovaDataRetorno("");
        setNovoTipoRetorno("");
        setShowAddRetornoForm(false);
        return reloadHistorico({ silent: true });
      })
      .catch((err: unknown) => {
        toast.current?.show({
          severity: "error",
          summary: "Erro",
          detail: normalizeErrorMessage(err),
          life: 4000,
        });
      })
      .finally(() => setAddingRetorno(false));
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingPaciente(null);
    setConfirmModalVisible(false);
    setPendingPayload(null);
    setImpactDataList([]);
  };

  const handleSubmit = (
    values: FormValues,
    helpers: FormikHelpers<FormValues>,
  ) => {
    const hasInvalidMedicamento = values.medicamentos.some((item) => {
      if (!item.medicamento) return true;
      if (item.regime_consumo === "por_ciclo") {
        return (
          !String(item.unidades_por_ciclo ?? "").trim() ||
          !String(item.intervalo_ciclo_dias ?? "").trim()
        );
      }
      if (item.regime_consumo === "por_miligrama") {
        return !String(item.consumo_mg_diario ?? "").trim();
      }
      return !String(item.consumo_diario ?? "").trim();
    });
    if (hasInvalidMedicamento) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail:
          "Preencha medicamento e uso (consumo diário ou ciclo) em todos os itens.",
        life: 4000,
      });
      helpers.setSubmitting(false);
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = buildPayload(
        values,
        editingPaciente
          ? {
              proximaDataRetornoInicial:
                editingPaciente.proxima_data_retorno ?? null,
            }
          : undefined,
      );
    } catch (e) {
      console.log("🚀 ~ handleSubmit ~ e:", e);
      toast.current?.show({
        severity: "error",
        summary: "Erro",
        detail: "Verifique os dados do formulário.",
        life: 4000,
      });
      helpers.setSubmitting(false);
      return;
    }
    setFormSubmitting(true);
    if (editingPaciente) {
      setFormVisible(false);
      api
        .put(`/pacientes/${editingPaciente.id}`, payload)
        .then(() => {
          toast.current?.show({
            severity: "success",
            summary: "Sucesso",
            detail: "Paciente atualizado com sucesso.",
            life: 3000,
          });
          void reloadPacientes({ silent: true });
        })
        .catch((err: unknown) => {
          toast.current?.show({
            severity: "error",
            summary: "Erro",
            detail: normalizeErrorMessage(err),
            life: 4000,
          });
        })
        .finally(() => {
          helpers.setSubmitting(false);
          setFormSubmitting(false);
        });
      return;
    }
    setPendingPayload(payload);
    setConfirmModalVisible(true);
    setImpactDataList([]);
    setLoadingImpact(true);
    helpers.setSubmitting(false);
    setFormSubmitting(false);
    const medicamentosPayload = payload.medicamentos as Array<{
      medicamento_nome: string;
      medicamento_concentracao: string;
      consumo_diario: number;
      regime_consumo?: RegimeConsumoMedicamento;
      unidades_por_ciclo?: number | null;
      intervalo_ciclo_dias?: number | null;
      consumo_mg_diario?: number | null;
    }>;
    Promise.all(
      medicamentosPayload.map((m) =>
        api.get<ImpactoEstoque>(buildImpactoEstoquePath(m)),
      ),
    )
      .then((responses) => setImpactDataList(responses.map((r) => r.data)))
      .catch(() => setImpactDataList([]))
      .finally(() => setLoadingImpact(false));
  };

  const handleConfirmarCadastro = () => {
    if (!pendingPayload) return;
    setSubmittingConfirm(true);
    api
      .post("/pacientes", pendingPayload)
      .then(() => {
        toast.current?.show({
          severity: "success",
          summary: "Sucesso",
          detail: "Paciente cadastrado com sucesso.",
          life: 3000,
        });
        closeForm();
        void reloadPacientes({ silent: true });
      })
      .catch((err: unknown) => {
        toast.current?.show({
          severity: "error",
          summary: "Erro",
          detail: normalizeErrorMessage(err),
          life: 4000,
        });
      })
      .finally(() => setSubmittingConfirm(false));
  };

  const handleCancelarConfirm = () => {
    setConfirmModalVisible(false);
    setPendingPayload(null);
    setImpactDataList([]);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPaciente) return;
    setDeletingInProgress(true);
    try {
      await api.delete(`/pacientes/${deletingPaciente.id}`);
      toast.current?.show({
        severity: "success",
        summary: "Sucesso",
        detail: "Paciente excluído com sucesso.",
        life: 3000,
      });
      setDeletingPaciente(null);
      void reloadPacientes({ silent: true });
    } catch (err: unknown) {
      toast.current?.show({
        severity: "error",
        summary: "Erro",
        detail: normalizeErrorMessage(err),
        life: 4000,
      });
    } finally {
      setDeletingInProgress(false);
    }
  };

  const editFormInitialValues: FormValues = editingPaciente
    ? buildEditFormInitialValues(editingPaciente, medicamentosDistintos)
    : initialFormValues;

  const canWritePacientes = sessionCanWritePacientes();

  const isPageDataLoading =
    loadingPacientes || loadingMedicamentosDistintos;
  const isHistoricoLoading = !!historicoPaciente && loadingHistorico;
  const fullscreenLoaderActive =
    formSubmitting ||
    submittingConfirm ||
    isPageDataLoading ||
    isHistoricoLoading;
  const fullscreenLoaderMessage = submittingConfirm
    ? "Cadastrando paciente..."
    : formSubmitting
      ? "Salvando..."
      : "Carregando...";

  return (
    <div className="pacientes-container">
      <FullScreenLoader
        active={fullscreenLoaderActive}
        message={fullscreenLoaderMessage}
      />
      <Toast ref={toast} position="top-right" />
      <Tooltip
        key={`pac-tooltip-${pacientes.length}-${pacientes[0]?.id ?? 0}`}
        target=".pacientes-ident-redacted"
        appendTo={typeof document !== "undefined" ? document.body : undefined}
      />
      <PrevisaoMgInfoDialog
        visible={previsaoMgInfoVisible}
        onHide={() => setPrevisaoMgInfoVisible(false)}
      />
      <ConfirmDialog
        visible={canWritePacientes && !!deletingPaciente}
        onHide={() => !deletingInProgress && setDeletingPaciente(null)}
        header="Excluir paciente"
        message="Deseja realmente excluir este paciente? Esta ação não pode ser desfeita."
        acceptLabel="Excluir"
        rejectLabel="Cancelar"
        acceptClassName="p-button-danger"
        accept={handleConfirmDelete}
        reject={() => setDeletingPaciente(null)}
      />
      <Header />
      <Menu />
      <div className="pacientes-title">
        <PageHeader
          title="Pacientes"
          description="Cadastro, consumo diário e acompanhamento de retorno ao serviço."
          icon={Users}
        />
        <div className="pacientes-title-actions">
          <Button
            label="Estoque comprometido"
            icon="pi pi-box"
            className="p-button-outlined"
            onClick={() => navigate("/estoque-comprometido")}
          />
          {canWritePacientes && (
            <Button
              label="Novo paciente"
              icon="pi pi-plus"
              onClick={openCreate}
              className="p-button-primary"
            />
          )}
        </div>
      </div>

      <PacientesFiltersBar
        busca={busca}
        onBuscaChange={setBusca}
        filtroLote={filtroLote}
        onFiltroLoteChange={setFiltroLote}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        filtrosAtivos={filtrosAtivos}
        onLimparFiltros={limparFiltros}
        filtroDataLiberacaoInicio={filtroDataLiberacaoInicio}
        filtroDataLiberacaoFim={filtroDataLiberacaoFim}
        onFiltroDataLiberacaoInicioChange={setFiltroDataLiberacaoInicio}
        onFiltroDataLiberacaoFimChange={setFiltroDataLiberacaoFim}
        filtroDataRetornoInicio={filtroDataRetornoInicio}
        filtroDataRetornoFim={filtroDataRetornoFim}
        onFiltroDataRetornoInicioChange={setFiltroDataRetornoInicio}
        onFiltroDataRetornoFimChange={setFiltroDataRetornoFim}
        filtroDataCadastroInicio={filtroDataCadastroInicio}
        filtroDataCadastroFim={filtroDataCadastroFim}
        onFiltroDataCadastroInicioChange={setFiltroDataCadastroInicio}
        onFiltroDataCadastroFimChange={setFiltroDataCadastroFim}
      />

      <div className="pagination-table-block">
        <div className="pagination-toolbar">
          <PaginationSummary
            page={pacientesPaging.page}
            totalPages={pacientesPaging.totalPages}
            total={filteredAndSortedPacientes.length}
            summaryLabel="paciente(s)"
          />
        </div>
        <DataTable
          value={pagedPacientes}
          emptyMessage={getDataTableEmptyMessage({
            loading: false,
            error: pacientesError,
            emptyLabel: "Nenhum paciente cadastrado.",
          })}
          className="pacientes-table pacientes-table-custom"
          stripedRows
          rowHover
          responsiveLayout="scroll"
        >
        <Column
          header="Nome"
          style={{ minWidth: "12rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-nome"
          body={(r: Paciente) => (
            <span
              className={
                r.identificadoresRedatados
                  ? "pacientes-ident-redacted pacientes-ident-redacted--blur"
                  : undefined
              }
              title={
                r.identificadoresRedatados ? TOOLTIP_IDENTIFICACAO_REDACT : undefined
              }
              data-pr-tooltip={
                r.identificadoresRedatados ? TOOLTIP_IDENTIFICACAO_REDACT : undefined
              }
            >
              {r.nome}
            </span>
          )}
        />
        <Column
          header="Prontuário"
          style={{ minWidth: "8rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-prontuario"
          body={(r: Paciente) => (
            <span
              className={
                r.identificadoresRedatados
                  ? "pacientes-ident-redacted pacientes-ident-redacted--blur"
                  : undefined
              }
              title={
                r.identificadoresRedatados ? TOOLTIP_IDENTIFICACAO_REDACT : undefined
              }
              data-pr-tooltip={
                r.identificadoresRedatados ? TOOLTIP_IDENTIFICACAO_REDACT : undefined
              }
            >
              {r.identificadoresRedatados
                ? "—"
                : String(r.prontuario)}
            </span>
          )}
        />
        <Column
          field="apac"
          header="APAC"
          style={{ minWidth: "10rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-apac"
        />
        <Column
          field="diagnostico"
          header="Diagnóstico"
          style={{ minWidth: "12rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-diagnostico"
        />
        <Column
          header="Medicamento"
          body={(r: Paciente) => {
            const meds = r.medicamentos ?? [];
            if (!meds.length) return "—";

            return (
              <div className="pacientes-medicamentos-list">
                {meds.map((m, index) => (
                  <div
                    key={`${m.medicamento_nome}-${m.medicamento_concentracao}-${index}`}
                  >
                    {m.medicamento_nome} {m.medicamento_concentracao}
                  </div>
                ))}
              </div>
            );
          }}
          style={{ minWidth: "16rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-medicamento"
        />
        <Column
          header={() => (
            <PrevisaoMgColunaHeader
              onOpen={() => setPrevisaoMgInfoVisible(true)}
            />
          )}
          body={(r: Paciente) => {
            const meds = r.medicamentos ?? [];
            if (!meds.length) return "—";
            return (
              <div className="pacientes-taxa-lista">
                {meds.map((m, index) => (
                  <CelulaPrevisaoMg
                    key={`${m.medicamento_nome}-${m.medicamento_concentracao}-mg-${index}`}
                    previsao={m.previsao_mg}
                    medicamento={m}
                    mostrarAuditoria
                  />
                ))}
              </div>
            );
          }}
          style={{ minWidth: "14rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-consumo"
        />
        <Column
          field="telefone"
          header="Telefone"
          body={(r: Paciente) => (r.telefone?.trim() ? r.telefone : "—")}
          style={{ minWidth: "10rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-telefone"
        />
        <Column
          field="observacoes"
          header="Observações"
          body={(r: Paciente) => (r.observacoes?.trim() ? r.observacoes : "—")}
          style={{ minWidth: "14rem", maxWidth: "18rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-observacoes"
        />
        <Column
          field="data_liberacao"
          header="Data liberação"
          body={(r: Paciente) => formatDateBR(r.data_liberacao)}
          style={{ minWidth: "10rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-data"
        />
        <Column
          header="Próx. retorno"
          body={(r: Paciente) =>
            r.proxima_data_retorno
              ? formatDateBR(r.proxima_data_retorno)
              : "—"
          }
          style={{ minWidth: "10rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-prox-retorno"
        />
        <Column
          field="retorna_servico"
          header="Retorna?"
          body={(r: Paciente) => (
            <span
              className={
                r.retorna_servico
                  ? "pacientes-status pacientes-status--yes"
                  : "pacientes-status pacientes-status--no"
              }
            >
              {r.retorna_servico ? "Sim" : "Não"}
            </span>
          )}
          style={{ minWidth: "7rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-retorna"
        />
        <Column
          field="tipo_retorno"
          header="Tipo retorno"
          body={(r: Paciente) => formatTipoRetorno(r.tipo_retorno)}
          style={{ minWidth: "12rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-tipo-retorno"
        />
        <Column
          header="Ações"
          body={(r: Paciente) => (
            <div className="pacientes-actions">
              {r.retorna_servico ? (
                <Button
                  label="Histórico"
                  icon="pi pi-calendar"
                  className="p-button-sm p-button-secondary"
                  onClick={() => setHistoricoPaciente(r)}
                  title="Histórico de retornos"
                />
              ) : null}
              {canWritePacientes && (
                <>
                  <Button
                    label="Editar"
                    icon="pi pi-pencil"
                    className="p-button-sm pacientes-btn-editar"
                    onClick={() => openEdit(r)}
                  />
                  <Button
                    label="Excluir"
                    icon="pi pi-trash"
                    className="p-button-sm p-button-danger pacientes-btn-excluir"
                    onClick={() => setDeletingPaciente(r)}
                    disabled={deletingInProgress}
                  />
                </>
              )}
            </div>
          )}
          style={{ minWidth: "11rem" }}
          headerClassName="pacientes-col-header"
          bodyClassName="pacientes-col-acoes"
        />
        </DataTable>
        <PaginationBar
          page={pacientesPaging.page}
          totalPages={pacientesPaging.totalPages}
          total={filteredAndSortedPacientes.length}
          summaryLabel="paciente(s)"
          onPageChange={pacientesPaging.setPage}
        />
      </div>

      <PacienteFormDialog
        visible={formVisible && !confirmModalVisible}
        editingPaciente={editingPaciente}
        initialValues={editFormInitialValues}
        medicamentosDistintos={medicamentosDistintos}
        loadingMedicamentosDistintos={loadingMedicamentosDistintos}
        onHide={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmarCadastroPacienteDialog
        visible={confirmModalVisible}
        pendingPayload={pendingPayload}
        impactDataList={impactDataList}
        loadingImpact={loadingImpact}
        submittingConfirm={submittingConfirm}
        onCancel={handleCancelarConfirm}
        onConfirm={handleConfirmarCadastro}
      />

      <HistoricoRetornosDialog
        paciente={historicoPaciente}
        retornos={historicoRetornos}
        loading={loadingHistorico}
        canWrite={canWritePacientes}
        showAddForm={showAddRetornoForm}
        novaDataRetorno={novaDataRetorno}
        novoTipoRetorno={novoTipoRetorno}
        addingRetorno={addingRetorno}
        onClose={() => setHistoricoPaciente(null)}
        onShowAddForm={() => setShowAddRetornoForm(true)}
        onCancelAddForm={() => {
          setShowAddRetornoForm(false);
          setNovaDataRetorno("");
          setNovoTipoRetorno("");
        }}
        onNovaDataRetornoChange={setNovaDataRetorno}
        onNovoTipoRetornoChange={setNovoTipoRetorno}
        onAddRetorno={handleAddRetorno}
      />
    </div>
  );
}
