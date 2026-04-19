import { useRef, useEffect, useState, useMemo, type ReactNode } from "react";
import { api } from "../../api/client";
import { isAdmin } from "../../auth/session";
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
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR, toInputDateValue } from "../../utils/dateUtils";
import type {
  Paciente,
  PacienteRetorno,
  ImpactoEstoque,
  MedicamentoDistinto,
  ResumoPorMedicamento,
  RegimeConsumoMedicamento,
} from "../../types";
import { PRONTUARIO_REDACT_SENTINEL } from "../../types";
import {
  formatarNumeroTaxaPtBr,
  formatarMgAcumuladoPtBr,
  inferResumoTaxaMetaFromMedicamentos,
  itensDetalheTaxaAgregada,
  normalizeRegimeConsumo,
} from "../../utils/pacienteMedicamentoDisplay";
import { PacientesDateRangeFilter } from "./PacientesDateRangeFilter";
import { filterPacientesByDataLiberacaoRange } from "./pacientesFilters";
import { normalizeResumoPorMedicamentoLista } from "../../utils/normalizeResumoPorMedicamento";
import "./styles.css";

const TOOLTIP_IDENTIFICACAO_REDACT =
  "Somente usuários administradores do Conos visualizam nome e prontuário completos.";

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
];

interface MedicamentoFormItem {
  medicamento: MedicamentoDistinto | null;
  regime_consumo: RegimeConsumoMedicamento;
  consumo_diario: string;
  unidades_por_ciclo: string;
  intervalo_ciclo_dias: string;
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
    .oneOf(["diario", "por_ciclo"])
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
  intervalo_ciclo_dias: yup.string().when("regime_consumo", {
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
}): string {
  const q = new URLSearchParams();
  q.set("medicamento_nome", m.medicamento_nome);
  q.set("medicamento_concentracao", m.medicamento_concentracao);
  if (m.regime_consumo === "por_ciclo") {
    q.set("regime_consumo", "por_ciclo");
    q.set("unidades_por_ciclo", String(m.unidades_por_ciclo ?? ""));
    q.set("intervalo_ciclo_dias", String(m.intervalo_ciclo_dias ?? ""));
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
}): string {
  if (m.regime_consumo === "por_ciclo") {
    return `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.unidades_por_ciclo} unid. / ${m.intervalo_ciclo_dias} dias)`;
  }
  return `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.consumo_diario}/dia)`;
}

function formatTipoRetorno(tipo: string | null): string {
  if (!tipo) return "—";
  const o = TIPO_RETORNO_OPTIONS.find((x) => x.value === tipo);
  return o?.label ?? tipo;
}

function TaxaAgregadaDetalheConteudo({
  row,
  pacientes,
}: {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
}): ReactNode {
  const itens = itensDetalheTaxaAgregada(
    row.medicamento_nome,
    row.medicamento_concentracao,
    pacientes,
  );
  if (itens.length === 0) {
    return (
      <p className="pacientes-taxa-detalhe-vazio">
        Não foi possível listar o detalhe. Atualize a página ou verifique se a
        lista de pacientes carregou.
      </p>
    );
  }
  return (
    <>
      <ul className="pacientes-taxa-detalhe-lista">
        {itens.map((item, idx) => (
          <li
            key={`${item.pacienteId}-${idx}`}
            className="pacientes-taxa-detalhe-item"
          >
            <div className="pacientes-taxa-detalhe-cabecalho">
              <strong>{item.pacienteNome}</strong>
              <span className="pacientes-taxa-detalhe-pront">
                {" "}
                · Pront.{" "}
                {item.prontuario === PRONTUARIO_REDACT_SENTINEL
                  ? "—"
                  : item.prontuario}
              </span>
            </div>
            {item.linhasRegime.map((linha, j) => (
              <div
                key={j}
                className={
                  j === 0
                    ? "pacientes-taxa-detalhe-regime-linha pacientes-taxa-detalhe-regime-linha--prim"
                    : "pacientes-taxa-detalhe-regime-linha pacientes-taxa-detalhe-regime-linha--sec"
                }
              >
                {linha}
              </div>
            ))}
            <div className="pacientes-taxa-detalhe-contrib">
              Contribuição na soma:{" "}
              <strong>
                {formatarNumeroTaxaPtBr(item.equivUnidDia)} unid./dia
              </strong>
            </div>
          </li>
        ))}
      </ul>
      <p className="pacientes-taxa-detalhe-total">
        <strong>Total equivalente:</strong>{" "}
        {formatarNumeroTaxaPtBr(row.consumoDiarioTotal)} unid./dia
      </p>
    </>
  );
}

export default function Pacientes() {
  const toast = useRef<Toast>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [medicamentosDistintos, setMedicamentosDistintos] = useState<
    MedicamentoDistinto[]
  >([]);
  const [resumoPorMedicamento, setResumoPorMedicamento] = useState<
    ResumoPorMedicamento[]
  >([]);
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
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [taxaDetalheRow, setTaxaDetalheRow] = useState<ResumoPorMedicamento | null>(
    null,
  );
  const [historicoPaciente, setHistoricoPaciente] = useState<Paciente | null>(
    null,
  );
  const [historicoRetornos, setHistoricoRetornos] = useState<PacienteRetorno[]>(
    [],
  );
  const [loadingHistorico, setLoadingHistorico] = useState(false);
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
  const [sortKey, setSortKey] = useState("proxima_data_retorno_asc");

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(busca), 300);
    return () => window.clearTimeout(t);
  }, [busca]);

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
    const [field, dir] = sortKey.split("_") as [string, "asc" | "desc"];
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
    sortKey,
  ]);

  const resumoPorMedicamentoParaExibir = useMemo(() => {
    return resumoPorMedicamento.map((row) => {
      if (row.resumoTaxaTipo != null && row.resumoTaxaTipo !== "") {
        return row;
      }
      const meds = pacientes
        .flatMap((p) => p.medicamentos ?? [])
        .filter(
          (m) =>
            m.medicamento_nome === row.medicamento_nome &&
            m.medicamento_concentracao === row.medicamento_concentracao,
        );
      const inferred = inferResumoTaxaMetaFromMedicamentos(meds);
      if (!inferred) return row;
      return { ...row, ...inferred };
    });
  }, [resumoPorMedicamento, pacientes]);

  const fetchPacientes = () => {
    api
      .get<Paciente[]>("/pacientes")
      .then((res) => setPacientes(res.data ?? []))
      .catch(() => setPacientes([]));
  };

  const fetchMedicamentosDistintos = () => {
    api
      .get<MedicamentoDistinto[]>("/medications/distinct-nome-concentration")
      .then((res) => setMedicamentosDistintos(res.data ?? []))
      .catch(() => setMedicamentosDistintos([]));
  };

  const fetchResumoPorMedicamento = () => {
    setLoadingResumo(true);
    api
      .get<ResumoPorMedicamento[]>("/pacientes/resumo-por-medicamento")
      .then((res) =>
        setResumoPorMedicamento(normalizeResumoPorMedicamentoLista(res.data)),
      )
      .catch(() => setResumoPorMedicamento([]))
      .finally(() => setLoadingResumo(false));
  };

  useEffect(() => {
    fetchPacientes();
    fetchMedicamentosDistintos();
    fetchResumoPorMedicamento();
  }, []);

  useEffect(() => {
    if (!historicoPaciente) {
      setHistoricoRetornos([]);
      setShowAddRetornoForm(false);
      setNovaDataRetorno("");
      setNovoTipoRetorno("");
      return;
    }
    setLoadingHistorico(true);
    api
      .get<PacienteRetorno[]>(`/pacientes/${historicoPaciente.id}/retornos`)
      .then((res) => setHistoricoRetornos(res.data ?? []))
      .catch(() => setHistoricoRetornos([]))
      .finally(() => setLoadingHistorico(false));
  }, [historicoPaciente]);

  const medicamentoDropdownOptions = medicamentosDistintos.map((m) => ({
    label: `${m.nome} - ${m.concentracao}`,
    value: m,
  }));

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
        return api.get<PacienteRetorno[]>(
          `/pacientes/${historicoPaciente.id}/retornos`,
        );
      })
      .then((res) => setHistoricoRetornos(res.data ?? []))
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
          fetchPacientes();
          fetchResumoPorMedicamento();
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
        fetchPacientes();
        fetchResumoPorMedicamento();
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
      fetchPacientes();
      fetchResumoPorMedicamento();
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
                regime === "por_ciclo" && m.intervalo_ciclo_dias != null
                  ? String(m.intervalo_ciclo_dias)
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

  const admin = isAdmin();

  return (
    <div className="pacientes-container">
      <FullScreenLoader
        active={formSubmitting || submittingConfirm}
        message={submittingConfirm ? "Cadastrando paciente..." : "Salvando..."}
      />
      <Toast ref={toast} position="top-right" />
      <Tooltip
        key={`pac-tooltip-${pacientes.length}-${pacientes[0]?.id ?? 0}`}
        target=".pacientes-ident-redacted"
        appendTo={typeof document !== "undefined" ? document.body : undefined}
      />
      <ConfirmDialog
        visible={admin && !!deletingPaciente}
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
        {admin && (
          <Button
            label="Novo paciente"
            icon="pi pi-plus"
            onClick={openCreate}
            className="p-button-primary"
            style={{ marginTop: "20px" }}
          />
        )}
      </div>

      {resumoPorMedicamentoParaExibir.length > 0 && (
        <div className="pacientes-resumo-section">
          <h3>Estoque por medicamento (comprometido)</h3>
          {loadingResumo ? (
            <p>Carregando...</p>
          ) : (
            <DataTable
              value={resumoPorMedicamentoParaExibir}
              size="small"
              emptyMessage="Nenhum medicamento com pacientes vinculados."
              className="pacientes-resumo-table"
            >
              <Column
                field="medicamento_nome"
                header="Medicamento"
                body={(r: ResumoPorMedicamento) =>
                  `${r.medicamento_nome} - ${r.medicamento_concentracao}`
                }
              />
              <Column field="estoqueTotal" header="Estoque total" />
              <Column field="qtdPacientes" header="Pacientes" />
              <Column
                header="Mg acumulados (dispensado)"
                body={(r: ResumoPorMedicamento) => {
                  const rawMg = r.mgAcumuladoDispensadoTotal;
                  const detalheItens = itensDetalheTaxaAgregada(
                    r.medicamento_nome,
                    r.medicamento_concentracao,
                    pacientes,
                  );
                  const linha =
                    rawMg === null || rawMg === undefined
                      ? "—"
                      : formatarMgAcumuladoPtBr(rawMg);
                  return (
                    <div className="pacientes-taxa-resumo-celula pacientes-taxa-resumo-celula--agregado">
                      <div className="pacientes-taxa-resumo-celula-texto">
                        <div className="pacientes-taxa-linha-principal">
                          {linha}
                        </div>
                        {rawMg === null ? (
                          <div className="pacientes-taxa-linha-secundaria">
                            Concentração sem mg no cadastro
                          </div>
                        ) : rawMg === undefined ? null : (
                          <div className="pacientes-taxa-linha-secundaria">
                            Soma das retiradas vinculadas a pacientes
                          </div>
                        )}
                      </div>
                      {r.resumoTaxaTipo === "agregado" &&
                      detalheItens.length > 0 ? (
                        <button
                          type="button"
                          className="pacientes-taxa-detalhe-btn"
                          aria-label="Ver consumo planejado equivalente em unid./dia"
                          title="Ver consumo planejado equivalente em unid./dia"
                          onClick={() => setTaxaDetalheRow(r)}
                        >
                          <i className="pi pi-info-circle" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Column
                header="Estoque dá para (meses)"
                body={(r: ResumoPorMedicamento) =>
                  r.mesesEstoque != null ? `${r.mesesEstoque}` : "—"
                }
              />
            </DataTable>
          )}
        </div>
      )}

      <Dialog
        header={
          taxaDetalheRow
            ? `Taxa agregada — ${taxaDetalheRow.medicamento_nome} ${taxaDetalheRow.medicamento_concentracao}`
            : "Taxa agregada"
        }
        visible={taxaDetalheRow !== null}
        onHide={() => setTaxaDetalheRow(null)}
        draggable={false}
        style={{ width: "min(92vw, 26rem)" }}
        className="pacientes-taxa-detalhe-dialog-wrap"
      >
        {taxaDetalheRow ? (
          <div className="pacientes-taxa-detalhe-dialog">
            <p className="pacientes-taxa-detalhe-intro">
              O valor em unid./dia é a soma das taxas equivalentes de cada
              paciente (consumo diário e/ou regime por ciclo).
            </p>
            <TaxaAgregadaDetalheConteudo
              row={taxaDetalheRow}
              pacientes={pacientes}
            />
          </div>
        ) : null}
      </Dialog>

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
          <PacientesDateRangeFilter
            dataInicio={filtroDataLiberacaoInicio}
            dataFim={filtroDataLiberacaoFim}
            onDataInicioChange={setFiltroDataLiberacaoInicio}
            onDataFimChange={setFiltroDataLiberacaoFim}
          />
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
        </div>
      </div>

      <DataTable
        value={filteredAndSortedPacientes}
        paginator
        rows={10}
        emptyMessage="Nenhum paciente cadastrado."
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
          header="Mg acumulados (dispensado)"
          body={(r: Paciente) => {
            const meds = r.medicamentos ?? [];
            if (!meds.length) return "—";
            return (
              <div className="pacientes-taxa-lista">
                {meds.map((m, index) => {
                  const mg =
                    m.mg_acumulado_dispensado === undefined
                      ? 0
                      : m.mg_acumulado_dispensado;
                  const linha =
                    mg === null
                      ? "—"
                      : formatarMgAcumuladoPtBr(mg);
                  return (
                    <div
                      key={`${m.medicamento_nome}-${m.medicamento_concentracao}-mg-${index}`}
                      className="pacientes-taxa-item"
                      title="Soma em mg das retiradas vinculadas a este paciente (mesmo nome e concentração). Retiradas sem paciente não entram."
                    >
                      <div className="pacientes-taxa-linha-principal">
                        {linha}
                      </div>
                      {mg === null ? (
                        <div className="pacientes-taxa-linha-secundaria">
                          Concentração sem mg no cadastro
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
              {admin && (
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
                                    optionLabel="label"
                                    optionValue="value"
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
                                    placeholder="Selecione nome e concentração"
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
                              Estoque dá para:{" "}
                              <strong>
                                {impact.mesesEstoqueAtual != null
                                  ? `${impact.mesesEstoqueAtual} meses`
                                  : "—"}
                              </strong>
                            </li>
                            <li>
                              Com este paciente:{" "}
                              <strong>
                                {impact.mesesEstoqueComNovo != null
                                  ? `${impact.mesesEstoqueComNovo} meses`
                                  : "—"}
                              </strong>
                            </li>
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
        {loadingHistorico ? (
          <p>Carregando...</p>
        ) : (
          <>
            {historicoRetornos.length === 0 && !showAddRetornoForm ? (
              <p className="pacientes-field-hint">
                Nenhuma data de retorno cadastrada.
              </p>
            ) : (
              <DataTable
                value={historicoRetornos}
                size="small"
                emptyMessage="Nenhuma data de retorno"
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
              admin ? (
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
