import * as yup from "yup";
import { shouldSendDataRetornoOnEdit, toInputDateValue } from "../../utils/dateUtils";
import { normalizeRegimeConsumo } from "../../utils/pacienteMedicamentoDisplay";
import type {
  MedicamentoDistinto,
  Paciente,
  RegimeConsumoMedicamento,
} from "../../types";

export const RETORNA_SERVICO_OPTIONS = [
  { label: "Sim", value: true },
  { label: "Não", value: false },
];

export const TIPO_RETORNO_OPTIONS = [
  { label: "Farmácia e médico", value: "farmacia_medico" },
  { label: "Somente farmácia", value: "somente_farmacia" },
  { label: "Farmácia e enfermagem", value: "farmacia_enfermagem" },
];

export const SORT_OPTIONS = [
  { label: "Data de retorno (mais perto)", value: "proxima_data_retorno_asc" },
  { label: "Data de retorno (mais distante)", value: "proxima_data_retorno_desc" },
  { label: "Nome (A–Z)", value: "nome_asc" },
  { label: "Nome (Z–A)", value: "nome_desc" },
  { label: "Data liberação (mais recente)", value: "data_liberacao_desc" },
  { label: "Data liberação (mais antiga)", value: "data_liberacao_asc" },
  { label: "Prontuário (crescente)", value: "prontuario_asc" },
  { label: "Prontuário (decrescente)", value: "prontuario_desc" },
];

export const REGIME_MEDICAMENTO_OPTIONS: {
  label: string;
  value: RegimeConsumoMedicamento;
}[] = [
  { label: "Consumo diário", value: "diario" },
  { label: "Por ciclo", value: "por_ciclo" },
  { label: "Consumo por miligrama", value: "por_miligrama" },
];

export interface MedicamentoFormItem {
  medicamento: MedicamentoDistinto | null;
  regime_consumo: RegimeConsumoMedicamento;
  consumo_diario: string;
  unidades_por_ciclo: string;
  intervalo_ciclo_dias: string;
  consumo_mg_diario: string;
}

export interface FormValues {
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

export const initialMedicamentoItem: MedicamentoFormItem = {
  medicamento: null,
  regime_consumo: "diario",
  consumo_diario: "",
  unidades_por_ciclo: "",
  intervalo_ciclo_dias: "",
  consumo_mg_diario: "",
};

export const initialFormValues: FormValues = {
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

export const schemaCreate = yup.object().shape({
  ...baseSchema,
  data_retorno: schemaDataRetornoObrigatoria,
});

export const schemaEdit = yup.object().shape({
  ...baseSchema,
  data_retorno: schemaDataRetornoOpcional,
});

export function buildImpactoEstoquePath(m: {
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

export function resumoMedicamentoNoPayload(m: {
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

export function formatTipoRetorno(tipo: string | null): string {
  if (!tipo) return "—";
  const o = TIPO_RETORNO_OPTIONS.find((x) => x.value === tipo);
  return o?.label ?? tipo;
}

export function buildPayload(
  values: FormValues,
  options?: { proximaDataRetornoInicial?: string | null },
): Record<string, unknown> {
  const dataRetornoTrim =
    values.retorna_servico && values.data_retorno?.trim()
      ? String(values.data_retorno).trim()
      : "";
  const isEdit = options != null && "proximaDataRetornoInicial" in options;
  const includeDataRetorno = isEdit
    ? shouldSendDataRetornoOnEdit(
        dataRetornoTrim,
        options?.proximaDataRetornoInicial,
      )
    : Boolean(dataRetornoTrim);

  return {
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
    data_retorno: includeDataRetorno ? dataRetornoTrim : undefined,
  };
}

export function buildEditFormInitialValues(
  editingPaciente: Paciente,
  medicamentosDistintos: MedicamentoDistinto[],
): FormValues {
  return {
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
    data_retorno: toInputDateValue(
      editingPaciente.proxima_data_retorno ?? "",
    ),
  };
}
