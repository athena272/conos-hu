import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { api } from "../../api/client";
import { sessionCanWritePacientes } from "../../auth/session";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { Tooltip } from "primereact/tooltip";
import { Dropdown } from "primereact/dropdown";
import { Field } from "formik";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { ErrorMessage } from "formik";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import LabelInput from "../../components/LabelInput";
import ButtonSubmit from "../../components/ButtonSubmit";
import FullScreenLoader from "../../components/FullScreenLoader";
import {
  PaginationBar,
  PaginationSummary,
  useClientPagination,
} from "../../components/pagination";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import { useApiQuery } from "../../hooks/useApiQuery";
import { formatDateBR, toInputDateValue } from "../../utils/dateUtils";
import type {
  Paciente,
  PacienteRetorno,
  ImpactoEstoque,
  MedicamentoDistinto,
  ResumoPorMedicamento,
  RegimeConsumoMedicamento,
} from "../../types";
import {
  formatarNumeroTaxaPtBr,
  formatarMgPtBr,
  inferResumoTaxaMetaFromMedicamentos,
  normalizeRegimeConsumo,
  normalizePacienteLista,
  agregarPrevisaoMgMedicamentos,
  previsaoMgTemValor,
  mesesEstoqueFromMgFrontend,
  parseMgPorUnidadeFromConcentracao,
} from "../../utils/pacienteMedicamentoDisplay";
import { PacientesDateRangeFilter } from "./PacientesDateRangeFilter";
import {
  filterPacientesByDataCadastroRange,
  filterPacientesByDataLiberacaoRange,
  filterPacientesByProximaDataRetornoRange,
  parsePacientesSortKey,
} from "./pacientesFilters";
import { buildMedicamentoDropdownOptions } from "./medicamentoDropdownOptions";
import { DispensaDoDiaPaciente } from "./DispensaDoDiaPaciente";
import type { DispensaDoDiaMedicamentoOption } from "./DispensaDoDiaPaciente";
import { normalizeResumoPorMedicamentoLista } from "../../utils/normalizeResumoPorMedicamento";
import { CelulaPrevisaoMg } from "./PrevisaoMgCelula";
import { CelulaPrevisaoMgResumo, CelulaMesesEstoqueResumo } from "./ResumoAuditoriaCelulas";
import { PeriodoCalculoSelector } from "./PeriodoCalculoSelector";
import "./styles.css";

const TOOLTIP_IDENTIFICACAO_REDACT =
  "Somente usuários administradores do Conos visualizam nome e prontuário completos.";

/** Cabeçalho da coluna Previsão (mg) com botão que abre o diálogo explicativo */
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

const RETORNA_SERVICO_OPTIONS = [
  { label: "Sim", value: true },
  { label: "Não", value: false },
];

const TIPO_RETORNO_OPTIONS = [
  { label: "Farmácia e médico", value: "farmacia_medico" },
  { label: "Somente farmácia", value: "somente_farmacia" },
  { label: "Farmácia e enfermagem", value: "farmacia_enfermagem" },
];

const SORT_OPTIONS = [
  { label: "Data de retorno (mais perto)", value: "proxima_data_retorno_asc" },
  { label: "Data de retorno (mais distante)", value: "proxima_data_retorno_desc" },
  { label: "Nome (A–Z)", value: "nome_asc" },
  { label: "Nome (Z–A)", value: "nome_desc" },
  { label: "Data liberação (mais recente)", value: "data_liberacao_desc" },
  { label: "Data liberação (mais antiga)", value: "data_liberacao_asc" },
  { label: "Prontuário (crescente)", value: "prontuario_asc" },
  { label: "Prontuário (decrescente)", value: "prontuario_desc" },
];

const REGIME_MEDICAMENTO_OPTIONS: {
  label: string;
  value: RegimeConsumoMedicamento;
}[] = [
  { label: "Consumo diário", value: "diario" },
  { label: "Por ciclo", value: "por_ciclo" },
  { label: "Consumo por miligrama", value: "por_miligrama" },
];

interface MedicamentoFormItem {
  medicamento: MedicamentoDistinto | null;
  regime_consumo: RegimeConsumoMedicamento;
  consumo_diario: string;
  unidades_por_ciclo: string;
  intervalo_ciclo_dias: string;
  consumo_mg_diario: string;
}

interface FormValues {
  nome: string;
  prontuario: string;
  apac: string;
  diagnostico: string;
  medicamentos: MedicamentoFormItem[];
  observacoes: string;
  telefone: string;
  data_liberacao: string;
  retorna_servico: boolean;
  tipo_retorno: string;
  data_retorno: string;
}

const initialMedicamentoItem: MedicamentoFormItem = {
  medicamento: null,
  regime_consumo: "diario",
  consumo_diario: "",
  unidades_por_ciclo: "",
  intervalo_ciclo_dias: "",
  consumo_mg_diario: "",
};

const initialFormValues: FormValues = {
  nome: "",
  prontuario: "",
  apac: "",
  diagnostico: "",
  medicamentos: [{ ...initialMedicamentoItem }],
  observacoes: "",
  telefone: "",
  data_liberacao: "",
  retorna_servico: false,
  tipo_retorno: "",
  data_retorno: "",
};

const medicamentoItemSchema = yup.object().shape({
  medicamento: yup
    .object()
    .nullable()
    .required("Selecione o medicamento")
    .test(
      "hasNome",
      "Selecione o medicamento",
      (v) => v != null && !!(v as MedicamentoDistinto).nome,
    ),
  regime_consumo: yup
    .string()
    .oneOf(["diario", "por_ciclo", "por_miligrama"])
    .required(),
  consumo_diario: yup.string().when("regime_consumo", {
    is: "diario",
    then: (s) =>
      s
        .required("Consumo diário é obrigatório")
        .test("positive", "Consumo diário deve ser maior que zero", (v) => {
          const n = parseFloat(String(v ?? "").replace(",", "."));
          return !isNaN(n) && n > 0;
        }),
    otherwise: (s) => s.notRequired(),
  }),
  unidades_por_ciclo: yup.string().when("regime_consumo", {
    is: "por_ciclo",
    then: (s) =>
      s
        .required("Unidades por ciclo é obrigatório")
        .test(
          "positive-u",
          "Unidades por ciclo deve ser maior que zero",
          (v) => {
            const n = parseFloat(String(v ?? "").replace(",", "."));
            return !isNaN(n) && n > 0;
          },
        ),
    otherwise: (s) => s.notRequired(),
  }),
  intervalo_ciclo_dias: yup
    .string()
    .when("regime_consumo", {
      is: "por_ciclo",
      then: (s) =>
        s
          .required("Intervalo do ciclo (dias) é obrigatório")
          .test(
            "int-pos",
            "Informe um número inteiro de dias ≥ 1",
            (v) => {
              const n = parseInt(String(v ?? "").trim(), 10);
              return !isNaN(n) && n >= 1 && String(n) === String(v?.trim());
            },
          ),
      otherwise: (s) => s.notRequired(),
    })
    .when("regime_consumo", {
      is: "por_miligrama",
      // Opcional no regime por miligrama; se informado, deve ser inteiro ≥ 1.
      then: (s) =>
        s.test(
          "int-pos-mg-opt",
          "Informe um número inteiro de dias ≥ 1",
          (v) => {
            const raw = String(v ?? "").trim();
            if (raw === "") return true;
            const n = parseInt(raw, 10);
            return !isNaN(n) && n >= 1 && String(n) === raw;
          },
        ),
      otherwise: (s) => s,
    }),
  consumo_mg_diario: yup.string().when("regime_consumo", {
    is: "por_miligrama",
    then: (s) =>
      s
        .required("Consumo em mg é obrigatório")
        .test("positive-mg", "Consumo em mg deve ser maior que zero", (v) => {
          const n = parseFloat(String(v ?? "").replace(",", "."));
          return !isNaN(n) && n > 0;
        }),
    otherwise: (s) => s.notRequired(),
  }),
});

const baseSchema = {
  nome: yup.string().required("Nome é obrigatório").trim(),
  prontuario: yup
    .string()
    .required("Prontuário é obrigatório")
    .test(
      "valid",
      "Prontuário deve ser um número inteiro não negativo",
      (v) => {
        const n = parseInt(String(v ?? ""), 10);
        return !isNaN(n) && n >= 0 && String(n) === String(v?.trim());
      },
    ),
  apac: yup.string().required("APAC é obrigatória").trim(),
  diagnostico: yup.string().required("Diagnóstico é obrigatório").trim(),
  medicamentos: yup
    .array()
    .of(medicamentoItemSchema)
    .min(1, "Informe ao menos um medicamento")
    .required(),
  observacoes: yup.string().nullable(),
  telefone: yup.string().nullable().trim(),
  data_liberacao: yup
    .string()
    .required("Data de liberação é obrigatória")
    .trim(),
  retorna_servico: yup.boolean().required(),
  tipo_retorno: yup.string().when("retorna_servico", {
    is: true,
    then: (s) =>
      s
        .required("Selecione o tipo de retorno")
        .oneOf(["farmacia_medico", "somente_farmacia", "farmacia_enfermagem"]),
    otherwise: (s) => s.nullable(),
  }),
};

const schemaDataRetornoObrigatoria = yup.string().when("retorna_servico", {
  is: true,
  then: (s) =>
    s
      .required(
        "Data de retorno é obrigatória quando o paciente retorna ao serviço",
      )
      .trim()
      .matches(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida (YYYY-MM-DD)"),
  otherwise: (s) => s.nullable(),
});

const schemaDataRetornoOpcional = yup
  .string()
  .nullable()
  .trim()
  .test(
    "valid-date-optional",
    "Informe uma data válida (YYYY-MM-DD)",
    function (value) {
      if (!this.parent.retorna_servico) return true;
      if (!value || value.trim() === "") return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    },
  );

const schemaCreate = yup.object().shape({
  ...baseSchema,
  data_retorno: schemaDataRetornoObrigatoria,
});

const schemaEdit = yup.object().shape({
  ...baseSchema,
  data_retorno: schemaDataRetornoOpcional,
});

function buildImpactoEstoquePath(m: {
  medicamento_nome: string;
  medicamento_concentracao: string;
  regime_consumo?: RegimeConsumoMedicamento;
  consumo_diario: number;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
  consumo_mg_diario?: number | null;
}): string {
  const q = new URLSearchParams();
  q.set("medicamento_nome", m.medicamento_nome);
  q.set("medicamento_concentracao", m.medicamento_concentracao);
  if (m.regime_consumo === "por_ciclo") {
    q.set("regime_consumo", "por_ciclo");
    q.set("unidades_por_ciclo", String(m.unidades_por_ciclo ?? ""));
    q.set("intervalo_ciclo_dias", String(m.intervalo_ciclo_dias ?? ""));
  } else if (m.regime_consumo === "por_miligrama") {
    q.set("regime_consumo", "por_miligrama");
    q.set("consumo_mg_diario", String(m.consumo_mg_diario ?? ""));
    if (m.intervalo_ciclo_dias != null) {
      q.set("intervalo_ciclo_dias", String(m.intervalo_ciclo_dias));
    }
  } else {
    q.set("regime_consumo", "diario");
    q.set("consumo_diario", String(m.consumo_diario));
  }
  return `/pacientes/impacto-estoque?${q.toString()}`;
}

function resumoMedicamentoNoPayload(m: {
  medicamento_nome: string;
  medicamento_concentracao: string;
  regime_consumo?: RegimeConsumoMedicamento;
  consumo_diario: number;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
  consumo_mg_diario?: number | null;
}): string {
  if (m.regime_consumo === "por_ciclo") {
    return `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.unidades_por_ciclo} unid. / ${m.intervalo_ciclo_dias} dias)`;
  }
  if (m.regime_consumo === "por_miligrama") {
    const dias = Number(m.intervalo_ciclo_dias);
    const sufixo = Number.isInteger(dias) && dias > 1 ? `mg / ${dias} dias` : "mg/dia";
    return `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.consumo_mg_diario} ${sufixo})`;
  }
  return `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.consumo_diario}/dia)`;
}

function formatTipoRetorno(tipo: string | null): string {
  if (!tipo) return "—";
  const o = TIPO_RETORNO_OPTIONS.find((x) => x.value === tipo);
  return o?.label ?? tipo;
}

export default function Pacientes() {
  const toast = useRef<Toast>(null);

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

  const fetchResumoList = useCallback(async () => {
    const res = await api.get<ResumoPorMedicamento[]>(
      "/pacientes/resumo-por-medicamento",
    );
    return normalizeResumoPorMedicamentoLista(res.data);
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

  const {
    data: resumoPorMedicamento,
    loading: loadingResumo,
    reload: reloadResumo,
  } = useApiQuery(fetchResumoList, [], {
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
  const [diasPeriodo, setDiasPeriodo] = useState(30);
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

  const resumoPorMedicamentoParaExibir = useMemo(() => {
    return resumoPorMedicamento.map((row) => {
      const meds = pacientes
        .flatMap((p) => p.medicamentos ?? [])
        .filter(
          (m) =>
            m.medicamento_nome === row.medicamento_nome &&
            m.medicamento_concentracao === row.medicamento_concentracao,
        );

      let enriched = row;
      if (row.resumoTaxaTipo == null || row.resumoTaxaTipo === "") {
        const inferred = inferResumoTaxaMetaFromMedicamentos(meds);
        if (inferred) enriched = { ...enriched, ...inferred };
      }

      const previsaoMgTotal =
        enriched.previsaoMgTotal && previsaoMgTemValor(enriched.previsaoMgTotal)
          ? enriched.previsaoMgTotal
          : meds.length > 0
            ? agregarPrevisaoMgMedicamentos(meds)
            : enriched.previsaoMgTotal;

      const mgDia = previsaoMgTotal?.mg_dia_previsto ?? null;
      const mesesEstoqueMg =
        enriched.mesesEstoqueMg != null
          ? enriched.mesesEstoqueMg
          : mesesEstoqueFromMgFrontend(
              enriched.estoqueTotal,
              mgDia,
              row.medicamento_concentracao,
            );

      return {
        ...enriched,
        ...(previsaoMgTotal && previsaoMgTemValor(previsaoMgTotal)
          ? { previsaoMgTotal }
          : {}),
        ...(mesesEstoqueMg !== undefined ? { mesesEstoqueMg } : {}),
      };
    });
  }, [resumoPorMedicamento, pacientes]);

  useEffect(() => {
    if (!historicoPaciente) {
      setShowAddRetornoForm(false);
      setNovaDataRetorno("");
      setNovoTipoRetorno("");
    }
  }, [historicoPaciente]);

  const medicamentoDropdownOptions = buildMedicamentoDropdownOptions(
    medicamentosDistintos,
  );

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

  const buildPayload = (values: FormValues): Record<string, unknown> => ({
    nome: String(values.nome ?? "").trim(),
    prontuario: parseInt(String(values.prontuario ?? "").trim(), 10),
    apac: String(values.apac ?? "").trim(),
    diagnostico: String(values.diagnostico ?? "").trim(),
    medicamentos: values.medicamentos.map((item) => {
      if (item.regime_consumo === "por_ciclo") {
        return {
          medicamento_nome: item.medicamento!.nome,
          medicamento_concentracao: item.medicamento!.concentracao,
          consumo_diario: 0,
          regime_consumo: "por_ciclo" as const,
          unidades_por_ciclo: parseFloat(
            String(item.unidades_por_ciclo ?? "").replace(",", "."),
          ),
          intervalo_ciclo_dias: parseInt(
            String(item.intervalo_ciclo_dias ?? "").trim(),
            10,
          ),
        };
      }
      if (item.regime_consumo === "por_miligrama") {
        const intervaloRaw = String(item.intervalo_ciclo_dias ?? "").trim();
        const intervaloParsed = parseInt(intervaloRaw, 10);
        return {
          medicamento_nome: item.medicamento!.nome,
          medicamento_concentracao: item.medicamento!.concentracao,
          consumo_diario: 0,
          regime_consumo: "por_miligrama" as const,
          unidades_por_ciclo: null,
          intervalo_ciclo_dias:
            Number.isInteger(intervaloParsed) && intervaloParsed >= 1
              ? intervaloParsed
              : 1,
          consumo_mg_diario: parseFloat(
            String(item.consumo_mg_diario ?? "").replace(",", "."),
          ),
        };
      }
      return {
        medicamento_nome: item.medicamento!.nome,
        medicamento_concentracao: item.medicamento!.concentracao,
        consumo_diario: parseFloat(
          String(item.consumo_diario ?? "").replace(",", "."),
        ),
        regime_consumo: "diario" as const,
        unidades_por_ciclo: null,
        intervalo_ciclo_dias: null,
      };
    }),
    observacoes:
      values.observacoes != null && values.observacoes !== ""
        ? String(values.observacoes).trim() || null
        : null,
    telefone: values.telefone != null ? String(values.telefone).trim() : "",
    data_liberacao: String(values.data_liberacao ?? "").trim(),
    retorna_servico: values.retorna_servico,
    tipo_retorno: values.retorna_servico ? values.tipo_retorno : null,
    data_retorno:
      values.retorna_servico && values.data_retorno?.trim()
        ? String(values.data_retorno).trim()
        : undefined,
  });

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
      payload = buildPayload(values);
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
          void reloadResumo({ silent: true });
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
        void reloadResumo({ silent: true });
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
      void reloadResumo({ silent: true });
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
    ? {
        nome: editingPaciente.nome ?? "",
        prontuario: String(editingPaciente.prontuario ?? ""),
        apac: editingPaciente.apac ?? "",
        diagnostico: editingPaciente.diagnostico ?? "",
        medicamentos: (() => {
          const list = editingPaciente.medicamentos ?? [];
          if (list.length === 0) return [{ ...initialMedicamentoItem }];
          return list.map((m) => {
            const found = medicamentosDistintos.find(
              (md) =>
                md.nome === m.medicamento_nome &&
                md.concentracao === m.medicamento_concentracao,
            );
            const regime = normalizeRegimeConsumo(m);
            return {
              medicamento: found ?? {
                nome: m.medicamento_nome,
                concentracao: m.medicamento_concentracao,
              },
              regime_consumo: regime,
              consumo_diario:
                regime === "diario" ? String(m.consumo_diario ?? "") : "",
              unidades_por_ciclo:
                regime === "por_ciclo" && m.unidades_por_ciclo != null
                  ? String(m.unidades_por_ciclo)
                  : "",
              intervalo_ciclo_dias:
                (regime === "por_ciclo" || regime === "por_miligrama") &&
                m.intervalo_ciclo_dias != null
                  ? String(m.intervalo_ciclo_dias)
                  : "",
              consumo_mg_diario:
                regime === "por_miligrama" && m.consumo_mg_diario != null
                  ? String(m.consumo_mg_diario)
                  : "",
            };
          });
        })(),
        observacoes: editingPaciente.observacoes ?? "",
        telefone: editingPaciente.telefone ?? "",
        data_liberacao: toInputDateValue(editingPaciente.data_liberacao ?? ""),
        retorna_servico: Boolean(editingPaciente.retorna_servico),
        tipo_retorno: editingPaciente.tipo_retorno ?? "",
        data_retorno: "",
      }
    : initialFormValues;

  const canWritePacientes = sessionCanWritePacientes();

  const isPageDataLoading =
    loadingPacientes || loadingResumo || loadingMedicamentosDistintos;
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
            type="button"
            label="Fechar"
            className="p-button-secondary"
            onClick={() => setPrevisaoMgInfoVisible(false)}
          />
        </div>
      </Dialog>
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
        <h2>Pacientes</h2>
        {canWritePacientes && (
          <Button
            label="Novo paciente"
            icon="pi pi-plus"
            onClick={openCreate}
            className="p-button-primary"
            style={{ marginTop: "20px" }}
          />
        )}
      </div>

      {(loadingResumo || resumoPorMedicamentoParaExibir.length > 0) && (
        <div className="pacientes-resumo-section">
          <h3>Estoque por medicamento (comprometido)</h3>
          <p className="pacientes-field-hint">
            Contagem por nome e concentração (todos os lotes desse medicamento).
          </p>
          <PeriodoCalculoSelector
            diasPeriodo={diasPeriodo}
            onChange={setDiasPeriodo}
            idPrefix="pacientes-resumo-periodo"
            nota={
              diasPeriodo !== 30 ? (
                <span className="pacientes-periodo-hint">
                  Simulação para {diasPeriodo} dias — não altera os dados salvos.
                </span>
              ) : null
            }
          />
          <DataTable
            key={`resumo-periodo-${diasPeriodo}`}
            value={resumoPorMedicamentoParaExibir}
            size="small"
            emptyMessage={getDataTableEmptyMessage({
              loading: false,
              error: null,
              emptyLabel: "Nenhum medicamento com pacientes vinculados.",
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
        </div>
      )}

      <div className="pacientes-filters-bar">
        <span className="p-input-icon-left pacientes-filter-busca">
          <i className="pi pi-search" />
          <InputText
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou medicamento"
            className="pacientes-input-busca"
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
              value={filtroLote}
              onChange={(e) => setFiltroLote(e.target.value)}
              placeholder="Filtrar por lote"
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
              value={sortKey}
              options={SORT_OPTIONS}
              onChange={(e) => setSortKey(e.value ?? "proxima_data_retorno_asc")}
              placeholder="Selecione"
              className="pacientes-dropdown-sort"
            />
          </div>
          <Button
            type="button"
            label="Limpar filtros"
            icon="pi pi-filter-slash"
            outlined
            className="pacientes-filter-clear-btn"
            onClick={limparFiltros}
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
            onDataInicioChange={setFiltroDataLiberacaoInicio}
            onDataFimChange={setFiltroDataLiberacaoFim}
          />
          <PacientesDateRangeFilter
            tituloGrupo="Retorno"
            hintGrupo="Qualquer retorno no período"
            idPrefix="pacientes-filtro-retorno"
            dataInicio={filtroDataRetornoInicio}
            dataFim={filtroDataRetornoFim}
            onDataInicioChange={setFiltroDataRetornoInicio}
            onDataFimChange={setFiltroDataRetornoFim}
          />
          <PacientesDateRangeFilter
            tituloGrupo="Cadastro"
            idPrefix="pacientes-filtro-cadastro"
            dataInicio={filtroDataCadastroInicio}
            dataFim={filtroDataCadastroFim}
            onDataInicioChange={setFiltroDataCadastroInicio}
            onDataFimChange={setFiltroDataCadastroFim}
          />
        </div>
      </div>

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

      <Dialog
        header={editingPaciente ? "Editar paciente" : "Novo paciente"}
        visible={formVisible && !confirmModalVisible}
        onHide={closeForm}
        draggable={false}
        style={{ width: "92vw", maxWidth: "560px" }}
        className="pacientes-form-dialog"
      >
        <Formik
          key={editingPaciente?.id ?? "new"}
          initialValues={editFormInitialValues}
          validationSchema={editingPaciente ? schemaEdit : schemaCreate}
          enableReinitialize
          onSubmit={handleSubmit}
        >
          {({
            values,
            setFieldValue,
            setFieldTouched,
            isSubmitting,
            errors,
            touched,
          }) => (
            <Form>
              <div className="pacientes-form-fields">
                <LabelInput
                  name="nome"
                  label="Nome"
                  placeholder="Nome do paciente"
                />
                <LabelInput
                  name="prontuario"
                  label="Prontuário"
                  placeholder="Número do prontuário"
                  type="number"
                />
                <LabelInput
                  name="apac"
                  label="APAC"
                  placeholder="APAC (texto)"
                />
                <div className="campo-texto">
                  <Field name="diagnostico">
                    {({
                      field,
                      form,
                    }: {
                      field: Record<string, unknown>;
                      form: {
                        errors: Record<string, unknown>;
                        touched: Record<string, unknown>;
                      };
                    }) => (
                      <div className="input-container">
                        <label htmlFor="diagnostico" className="input-label">
                          Diagnóstico
                        </label>
                        <InputTextarea
                          id="diagnostico"
                          {...field}
                          placeholder="Digite o diagnóstico"
                          rows={3}
                          className={`w-full form-field ${form.errors.diagnostico && form.touched.diagnostico ? "p-invalid" : ""}`}
                        />
                      </div>
                    )}
                  </Field>
                  <ErrorMessage
                    component="span"
                    name="diagnostico"
                    className="form-error"
                  />
                </div>
                <div className="campo-lista-medicamentos">
                  <label className="input-label">
                    Medicamentos (nome, concentração e regime de uso)
                  </label>
                  <p className="pacientes-field-hint">
                    Selecione pelo nome e concentração. O paciente fica
                    vinculado ao medicamento, não a um lote específico; o
                    estoque considera todos os lotes desse medicamento.
                  </p>
                  {(values.medicamentos ?? []).map((_, index) => {
                    const itemError = Array.isArray(errors.medicamentos)
                      ? (errors.medicamentos[index] as
                          | {
                              medicamento?: string;
                              consumo_diario?: string;
                              unidades_por_ciclo?: string;
                              intervalo_ciclo_dias?: string;
                            }
                          | undefined)
                      : undefined;
                    const itemTouched =
                      Array.isArray(touched.medicamentos) &&
                      touched.medicamentos[index] &&
                      typeof touched.medicamentos[index] === "object"
                        ? (touched.medicamentos[index] as {
                            medicamento?: boolean;
                            consumo_diario?: boolean;
                            unidades_por_ciclo?: boolean;
                            intervalo_ciclo_dias?: boolean;
                          })
                        : undefined;
                    const regimeAtual =
                      values.medicamentos[index]?.regime_consumo ?? "diario";
                    return (
                    <div key={index} className="pacientes-medicamento-row">
                      <Button
                        type="button"
                        icon="pi pi-trash"
                        className="p-button-text p-button-sm pacientes-remove-med-icon"
                        disabled={(values.medicamentos?.length ?? 0) <= 1}
                        onClick={() => {
                          const next = (values.medicamentos ?? []).filter(
                            (_, i) => i !== index,
                          );
                          if (next.length >= 1)
                            setFieldValue("medicamentos", next);
                        }}
                        title="Remover medicamento"
                        aria-label="Remover medicamento"
                      />

                      <div className="pacientes-medicamento-main">
                        <div className="campo-dropdown pacientes-medicamento-campo">
                          <Field name={`medicamentos.${index}.medicamento`}>
                            {({
                              form,
                            }: {
                              form: {
                                setFieldValue: (
                                  _field: string,
                                  _value: unknown,
                                ) => void;
                                setFieldTouched: (
                                  field: string,
                                  touched: boolean,
                                ) => void;
                                errors: Record<string, unknown>;
                                touched: Record<string, unknown>;
                              };
                            }) => {
                              const med =
                                values.medicamentos[index]?.medicamento ?? null;
                              const dropdownValue =
                                med == null
                                  ? null
                                  : (medicamentoDropdownOptions.find(
                                      (o) =>
                                        o.value &&
                                        o.value.nome === med.nome &&
                                        o.value.concentracao ===
                                          med.concentracao,
                                    )?.value ?? null);

                              const hasMedicamentoError =
                                !!itemError?.medicamento &&
                                !!itemTouched?.medicamento;

                              return (
                                <div className="input-container">
                                  <label
                                    htmlFor={`medicamento-${index}`}
                                    className="input-label"
                                  >
                                    Medicamento
                                  </label>
                                  <Dropdown
                                    id={`medicamento-${index}`}
                                    value={dropdownValue}
                                    options={medicamentoDropdownOptions}
                                    disabled={loadingMedicamentosDistintos}
                                    placeholder={
                                      loadingMedicamentosDistintos
                                        ? "Carregando medicamentos..."
                                        : "Selecione o medicamento"
                                    }
                                    optionLabel="label"
                                    optionValue="value"
                                    filter
                                    filterBy="label"
                                    filterPlaceholder="Buscar medicamento..."
                                    showClear
                                    onChange={(e: {
                                      value: MedicamentoDistinto | null;
                                    }) => {
                                      setFieldValue(
                                        `medicamentos.${index}.medicamento`,
                                        e.value,
                                      );
                                      form.setFieldTouched(
                                        `medicamentos.${index}.medicamento`,
                                        true,
                                      );
                                    }}
                                    onBlur={() =>
                                      setFieldTouched(
                                        `medicamentos.${index}.medicamento`,
                                        true,
                                      )
                                    }
                                    className={`w-full ${hasMedicamentoError ? "p-invalid" : ""}`}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.medicamento`}
                            className="form-error"
                          />
                        </div>

                        <div className="campo-dropdown pacientes-medicamento-campo">
                          <label
                            className="input-label"
                            htmlFor={`regime-${index}`}
                          >
                            Regime de uso
                          </label>
                          <Dropdown
                            inputId={`regime-${index}`}
                            value={regimeAtual}
                            options={REGIME_MEDICAMENTO_OPTIONS}
                            onChange={(e: { value: RegimeConsumoMedicamento }) => {
                              setFieldValue(
                                `medicamentos.${index}.regime_consumo`,
                                e.value,
                              );
                              setFieldTouched(
                                `medicamentos.${index}.regime_consumo`,
                                true,
                              );
                            }}
                            onBlur={() =>
                              setFieldTouched(
                                `medicamentos.${index}.regime_consumo`,
                                true,
                              )
                            }
                            placeholder="Selecione"
                            className="w-full"
                          />
                        </div>

                        {regimeAtual === "diario" ? (
                          <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo">
                            <Field name={`medicamentos.${index}.consumo_diario`}>
                              {({
                                field,
                              }: {
                                field: Record<string, unknown>;
                              }) => {
                                const hasConsumoError =
                                  !!itemError?.consumo_diario &&
                                  !!itemTouched?.consumo_diario;
                                return (
                                  <div className="input-container">
                                    <label
                                      htmlFor={`consumo-${index}`}
                                      className="input-label"
                                    >
                                      Consumo/dia
                                    </label>
                                    <InputText
                                      id={`consumo-${index}`}
                                      {...field}
                                      placeholder="Ex.: 2"
                                      type="number"
                                      className={`form-field ${hasConsumoError ? "p-invalid" : ""}`}
                                    />
                                  </div>
                                );
                              }}
                            </Field>
                            <ErrorMessage
                              component="span"
                              name={`medicamentos.${index}.consumo_diario`}
                              className="form-error"
                            />
                          </div>
                        ) : regimeAtual === "por_miligrama" ? (
                          <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo pacientes-medicamento-ciclo">
                            <Field name={`medicamentos.${index}.consumo_mg_diario`}>
                              {({
                                field,
                              }: {
                                field: Record<string, unknown>;
                              }) => {
                                const hasErr =
                                  !!itemError?.consumo_mg_diario &&
                                  !!itemTouched?.consumo_mg_diario;
                                return (
                                  <div className="input-container">
                                    <label
                                      htmlFor={`consumo-mg-${index}`}
                                      className="input-label"
                                    >
                                      Consumo (mg)
                                    </label>
                                    <InputText
                                      id={`consumo-mg-${index}`}
                                      {...field}
                                      placeholder="Ex.: 750"
                                      type="number"
                                      className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                      tooltip="Quantidade total em miligramas administrada no intervalo informado ao lado. Com intervalo = 1, equivale a mg/dia."
                                      tooltipOptions={{
                                        position: "top",
                                        className: "pacientes-ciclo-tooltip",
                                      }}
                                    />
                                  </div>
                                );
                              }}
                            </Field>
                            <ErrorMessage
                              component="span"
                              name={`medicamentos.${index}.consumo_mg_diario`}
                              className="form-error"
                            />
                            <Field
                              name={`medicamentos.${index}.intervalo_ciclo_dias`}
                            >
                              {({
                                field,
                              }: {
                                field: Record<string, unknown>;
                              }) => {
                                const hasErr =
                                  !!itemError?.intervalo_ciclo_dias &&
                                  !!itemTouched?.intervalo_ciclo_dias;
                                return (
                                  <div className="input-container">
                                    <label
                                      htmlFor={`mg-intervalo-${index}`}
                                      className="input-label"
                                    >
                                      a cada (dias)
                                    </label>
                                    <InputText
                                      id={`mg-intervalo-${index}`}
                                      {...field}
                                      placeholder="Ex.: 28"
                                      type="number"
                                      className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                      tooltip="Em quantos dias a quantidade de mg ao lado é consumida (ex.: 750 mg a cada 28 dias). Deixe 1 para informar mg/dia."
                                      tooltipOptions={{
                                        position: "top",
                                        className: "pacientes-ciclo-tooltip",
                                      }}
                                    />
                                  </div>
                                );
                              }}
                            </Field>
                            <ErrorMessage
                              component="span"
                              name={`medicamentos.${index}.intervalo_ciclo_dias`}
                              className="form-error"
                            />
                          </div>
                        ) : (
                          <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo pacientes-medicamento-ciclo">
                            <Field
                              name={`medicamentos.${index}.unidades_por_ciclo`}
                            >
                              {({
                                field,
                              }: {
                                field: Record<string, unknown>;
                              }) => {
                                const hasErr =
                                  !!itemError?.unidades_por_ciclo &&
                                  !!itemTouched?.unidades_por_ciclo;
                                return (
                                  <div className="input-container">
                                    <label
                                      htmlFor={`unidades-ciclo-${index}`}
                                      className="input-label"
                                    >
                                      Unidades por ciclo
                                    </label>
                                    <InputText
                                      id={`unidades-ciclo-${index}`}
                                      {...field}
                                      placeholder="Ex.: 1"
                                      type="number"
                                      className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                      tooltip="Quantas unidades de estoque (comprimidos, seringas, etc., conforme o cadastro) são dispensadas de uma vez para cobrir até a próxima retirada."
                                      tooltipOptions={{
                                        position: "top",
                                        className: "pacientes-ciclo-tooltip",
                                      }}
                                    />
                                  </div>
                                );
                              }}
                            </Field>
                            <ErrorMessage
                              component="span"
                              name={`medicamentos.${index}.unidades_por_ciclo`}
                              className="form-error"
                            />
                            <Field
                              name={`medicamentos.${index}.intervalo_ciclo_dias`}
                            >
                              {({
                                field,
                              }: {
                                field: Record<string, unknown>;
                              }) => {
                                const hasErr =
                                  !!itemError?.intervalo_ciclo_dias &&
                                  !!itemTouched?.intervalo_ciclo_dias;
                                return (
                                  <div className="input-container">
                                    <label
                                      htmlFor={`intervalo-ciclo-${index}`}
                                      className="input-label"
                                    >
                                      Intervalo (dias)
                                    </label>
                                    <InputText
                                      id={`intervalo-ciclo-${index}`}
                                      {...field}
                                      placeholder="Ex.: 45"
                                      type="number"
                                      className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                      tooltip="Quantos dias, em média, entre uma dispensação deste medicamento e a próxima (ex.: até o retorno agendado). Usado para calcular o consumo médio por dia no estoque."
                                      tooltipOptions={{
                                        position: "top",
                                        className: "pacientes-ciclo-tooltip",
                                      }}
                                    />
                                  </div>
                                );
                              }}
                            </Field>
                            <ErrorMessage
                              component="span"
                              name={`medicamentos.${index}.intervalo_ciclo_dias`}
                              className="form-error"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                  <Button
                    type="button"
                    label="Adicionar medicamento"
                    icon="pi pi-plus"
                    className="p-button-outlined p-button-sm"
                    onClick={() =>
                      setFieldValue("medicamentos", [
                        ...(values.medicamentos ?? []),
                        { ...initialMedicamentoItem },
                      ])
                    }
                  />
                  <ErrorMessage name="medicamentos">
                    {(msg) => {
                      const text =
                        typeof msg === "string"
                          ? msg
                          : Array.isArray(msg) ||
                              (msg && typeof msg === "object")
                            ? "Verifique os itens da lista de medicamentos."
                            : "";
                      return text ? (
                        <span className="form-error">{text}</span>
                      ) : null;
                    }}
                  </ErrorMessage>
                </div>
                <div className="campo-texto">
                  <Field name="observacoes">
                    {({
                      field,
                      form,
                    }: {
                      field: Record<string, unknown>;
                      form: {
                        errors: Record<string, unknown>;
                        touched: Record<string, unknown>;
                      };
                    }) => (
                      <div className="input-container">
                        <label htmlFor="observacoes" className="input-label">
                          Observações (opcional)
                        </label>
                        <InputTextarea
                          id="observacoes"
                          {...field}
                          placeholder="Digite as observações"
                          rows={3}
                          className={`w-full form-field ${form.errors.observacoes && form.touched.observacoes ? "p-invalid" : ""}`}
                        />
                      </div>
                    )}
                  </Field>
                  <ErrorMessage
                    component="span"
                    name="observacoes"
                    className="form-error"
                  />
                </div>
                <LabelInput
                  name="telefone"
                  label="Telefone (opcional)"
                  placeholder="Telefone"
                />
                <LabelInput
                  name="data_liberacao"
                  label="Data de liberação"
                  type="date"
                />
                <div className="campo-dropdown">
                  <label htmlFor="retorna_servico" className="input-label">
                    O paciente vai retornar para o serviço?
                  </label>
                  <Dropdown
                    id="retorna_servico"
                    value={values.retorna_servico}
                    options={RETORNA_SERVICO_OPTIONS}
                    onChange={(e: { value: boolean }) =>
                      setFieldValue("retorna_servico", e.value)
                    }
                    placeholder="Sim ou Não"
                    className="w-full"
                  />
                </div>
                {values.retorna_servico && (
                  <div className="campo-dropdown">
                    <label htmlFor="tipo_retorno" className="input-label">
                      Tipo de retorno
                    </label>
                    <Field name="tipo_retorno">
                      {({
                        form,
                      }: {
                        form: {
                          setFieldValue: (
                            _field: string,
                            _value: unknown,
                          ) => void;
                          setFieldTouched: (
                            field: string,
                            touched: boolean,
                          ) => void;
                          errors: Record<string, unknown>;
                          touched: Record<string, unknown>;
                        };
                      }) => (
                        <Dropdown
                          id="tipo_retorno"
                          value={values.tipo_retorno}
                          options={TIPO_RETORNO_OPTIONS}
                          onChange={(e: { value: string }) => {
                            setFieldValue("tipo_retorno", e.value);
                            form.setFieldTouched("tipo_retorno", true);
                          }}
                          onBlur={() => setFieldTouched("tipo_retorno", true)}
                          placeholder="Selecione"
                          className={`w-full ${errors.tipo_retorno && touched.tipo_retorno ? "p-invalid" : ""}`}
                        />
                      )}
                    </Field>
                    <ErrorMessage
                      component="span"
                      name="tipo_retorno"
                      className="form-error"
                    />
                  </div>
                )}
                {values.retorna_servico && (
                  <>
                    <LabelInput
                      name="data_retorno"
                      label="Data de retorno"
                      type="date"
                    />
                  </>
                )}
                {editingPaciente && (
                  <DispensaDoDiaPaciente
                    pacienteId={editingPaciente.id}
                    medicamentos={values.medicamentos
                      .filter(
                        (m): m is MedicamentoFormItem & { medicamento: MedicamentoDistinto } =>
                          Boolean(m.medicamento?.nome && m.medicamento?.concentracao),
                      )
                      .map((m, idx): DispensaDoDiaMedicamentoOption => ({
                        key: `${m.medicamento.nome}\0${m.medicamento.concentracao}\0${idx}`,
                        label: `${m.medicamento.nome} - ${m.medicamento.concentracao}`,
                        nome: m.medicamento.nome,
                        concentracao: m.medicamento.concentracao,
                        regime_consumo: m.regime_consumo,
                        unidades_por_ciclo: m.unidades_por_ciclo,
                      }))}
                    onSuccess={(detail) => {
                      toast.current?.show({
                        severity: "success",
                        summary: "Sucesso",
                        detail,
                        life: 4000,
                      });
                    }}
                    onError={(detail) => {
                      toast.current?.show({
                        severity: "error",
                        summary: "Erro",
                        detail,
                        life: 4000,
                      });
                    }}
                  />
                )}
              </div>
              <div className="pacientes-form-footer">
                <Button
                  type="button"
                  label="Cancelar"
                  className="p-button-text"
                  onClick={closeForm}
                />
                <ButtonSubmit type="submit" disabled={isSubmitting}>
                  {editingPaciente ? "Salvar" : "Salvar e confirmar"}
                </ButtonSubmit>
              </div>
            </Form>
          )}
        </Formik>
      </Dialog>

      <Dialog
        header="Confirmar cadastro do paciente"
        visible={confirmModalVisible}
        onHide={handleCancelarConfirm}
        draggable={false}
        style={{ width: "92vw", maxWidth: "520px" }}
        footer={
          <div>
            <Button
              label="Cancelar"
              className="p-button-text"
              onClick={handleCancelarConfirm}
              disabled={submittingConfirm}
            />
            <Button
              label="Confirmar cadastro"
              onClick={handleConfirmarCadastro}
              disabled={submittingConfirm || loadingImpact}
            />
          </div>
        }
      >
        {pendingPayload && (
          <div className="pacientes-confirm-content">
            <p>
              <strong>Resumo:</strong> {String(pendingPayload.nome)} — Pront.{" "}
              {String(pendingPayload.prontuario)} — Medicamentos:{" "}
              {(
                pendingPayload.medicamentos as Array<{
                  medicamento_nome: string;
                  medicamento_concentracao: string;
                  consumo_diario: number;
                  regime_consumo?: RegimeConsumoMedicamento;
                  unidades_por_ciclo?: number | null;
                  intervalo_ciclo_dias?: number | null;
                }>
              )
                ?.map((m) => resumoMedicamentoNoPayload(m))
                .join(", ") ?? "—"}
            </p>
            <h4>Impacto no estoque</h4>
            {loadingImpact ? (
              <p>Carregando...</p>
            ) : (
              <>
                {(
                  pendingPayload.medicamentos as Array<{
                    medicamento_nome: string;
                    medicamento_concentracao: string;
                    consumo_diario: number;
                    regime_consumo?: RegimeConsumoMedicamento;
                    unidades_por_ciclo?: number | null;
                    intervalo_ciclo_dias?: number | null;
                  }>
                )?.map((m, idx) => {
                  const impact = impactDataList[idx];
                  return (
                    <div key={idx} className="pacientes-impact-block">
                      <p className="pacientes-impact-med-label">
                        <strong>
                          {m.medicamento_nome} {m.medicamento_concentracao}
                        </strong>{" "}
                        ({resumoMedicamentoNoPayload(m)})
                      </p>
                      {impact ? (
                        <>
                          <ul className="pacientes-impact-list">
                            <li>
                              Estoque total:{" "}
                              <strong>{impact.estoqueTotal}</strong> unidades
                            </li>
                            <li>
                              Pacientes vinculados:{" "}
                              <strong>{impact.pacientesVinculados}</strong>
                            </li>
                            <li>
                              Total equivalente atual:{" "}
                              <strong>
                                {formatarNumeroTaxaPtBr(
                                  impact.consumoDiarioAtual,
                                )}
                              </strong>{" "}
                              unid./dia
                            </li>
                            <li>
                              Com este paciente:{" "}
                              <strong>
                                {formatarNumeroTaxaPtBr(
                                  impact.consumoDiarioComNovo,
                                )}
                              </strong>{" "}
                              unid./dia
                            </li>
                            <li>
                              Estoque dá para (unid.):{" "}
                              <strong>
                                {impact.mesesEstoqueAtual != null
                                  ? `${impact.mesesEstoqueAtual} meses`
                                  : "—"}
                              </strong>
                              {" → "}
                              <strong>
                                {impact.mesesEstoqueComNovo != null
                                  ? `${impact.mesesEstoqueComNovo} meses`
                                  : "—"}
                              </strong>
                            </li>
                            {impact.consumoMgDiarioComNovo != null ? (
                              <>
                                <li>
                                  Consumo previsto (mg/dia):{" "}
                                  <strong>
                                    {formatarMgPtBr(impact.consumoMgDiarioAtual ?? 0)}
                                    /dia
                                  </strong>
                                  {" → "}
                                  <strong>
                                    {formatarMgPtBr(impact.consumoMgDiarioComNovo)}
                                    /dia
                                  </strong>
                                </li>
                                {impact.consumoMgMesComNovo != null ? (
                                  <li>
                                    Projeção mensal (mg):{" "}
                                    <strong>
                                      {formatarMgPtBr(impact.consumoMgMesComNovo)}
                                    </strong>
                                  </li>
                                ) : null}
                                <li>
                                  Estoque dá para (mg):{" "}
                                  <strong>
                                    {impact.mesesEstoqueMgAtual != null
                                      ? `${impact.mesesEstoqueMgAtual} meses`
                                      : "—"}
                                  </strong>
                                  {" → "}
                                  <strong>
                                    {impact.mesesEstoqueMgComNovo != null
                                      ? `${impact.mesesEstoqueMgComNovo} meses`
                                      : "—"}
                                  </strong>
                                </li>
                              </>
                            ) : null}
                          </ul>
                          <p className="pacientes-taxa-linha-secundaria pacientes-impact-taxa-nota">
                            Valores são soma das taxas equivalentes (consumo
                            diário e por ciclo já convertidos).
                          </p>
                        </>
                      ) : (
                        <p>Não foi possível carregar o impacto.</p>
                      )}
                    </div>
                  );
                }) ?? null}
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        header={
          historicoPaciente
            ? `Histórico de retornos — ${historicoPaciente.nome}`
            : "Histórico de retornos"
        }
        visible={!!historicoPaciente}
        onHide={() => setHistoricoPaciente(null)}
        draggable={false}
        style={{ width: "92vw", maxWidth: "520px" }}
        className="pacientes-form-dialog"
        footer={
          <Button label="Fechar" onClick={() => setHistoricoPaciente(null)} />
        }
      >
        {!loadingHistorico && (
          <>
            {historicoRetornos.length === 0 && !showAddRetornoForm ? (
              <p className="pacientes-field-hint">
                Nenhuma data de retorno cadastrada.
              </p>
            ) : (
              <DataTable
                value={historicoRetornos}
                size="small"
                emptyMessage={getDataTableEmptyMessage({
                  loading: false,
                  error: null,
                  emptyLabel: "Nenhuma data de retorno",
                })}
                className="pacientes-table pacientes-table-custom"
                style={{ marginBottom: "1rem" }}
              >
                <Column
                  field="data_retorno"
                  header="Data"
                  body={(row: PacienteRetorno) =>
                    formatDateBR(row.data_retorno)
                  }
                />
                <Column
                  field="tipo_retorno"
                  header="Tipo"
                  body={(row: PacienteRetorno) =>
                    formatTipoRetorno(row.tipo_retorno)
                  }
                />
              </DataTable>
            )}
            {!showAddRetornoForm ? (
              canWritePacientes ? (
                <Button
                  label="Adicionar data de retorno"
                  icon="pi pi-plus"
                  className="p-button-sm p-button-secondary"
                  onClick={() => setShowAddRetornoForm(true)}
                />
              ) : null
            ) : (
              <div
                className="pacientes-form-fields"
                style={{ marginTop: "1rem" }}
              >
                <div className="campo-texto">
                  <div className="input-container">
                    <label htmlFor="nova-data-retorno" className="input-label">
                      Data de retorno
                    </label>
                    <input
                      id="nova-data-retorno"
                      type="date"
                      value={novaDataRetorno}
                      onChange={(e) => setNovaDataRetorno(e.target.value)}
                      className="p-inputtext p-component w-full form-field"
                    />
                  </div>
                </div>
                <div className="campo-dropdown" style={{ marginTop: "0.5rem" }}>
                  <label className="input-label">
                    Tipo de retorno (opcional)
                  </label>
                  <Dropdown
                    value={novoTipoRetorno}
                    options={TIPO_RETORNO_OPTIONS}
                    onChange={(e: { value: string }) =>
                      setNovoTipoRetorno(e.value ?? "")
                    }
                    placeholder="Selecione"
                    className="w-full"
                  />
                </div>
                <div
                  style={{
                    marginTop: "0.75rem",
                    display: "flex",
                    gap: "0.5rem",
                  }}
                >
                  <Button
                    label="Adicionar"
                    onClick={handleAddRetorno}
                    disabled={addingRetorno || !novaDataRetorno.trim()}
                  />
                  <Button
                    label="Cancelar"
                    className="p-button-text"
                    onClick={() => {
                      setShowAddRetornoForm(false);
                      setNovaDataRetorno("");
                      setNovoTipoRetorno("");
                    }}
                    disabled={addingRetorno}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
