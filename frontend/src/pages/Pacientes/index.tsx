import { useRef, useEffect, useState } from "react";
import axios from "axios";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
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
import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR, toInputDateValue } from "../../utils/dateUtils";
import type {
  Paciente,
  ImpactoEstoque,
  MedicamentoDistinto,
  ResumoPorMedicamento,
} from "../../types";
import "./styles.css";

const RETORNA_SERVICO_OPTIONS = [
  { label: "Sim", value: true },
  { label: "Não", value: false },
];

const TIPO_RETORNO_OPTIONS = [
  { label: "Farmácia e médico", value: "farmacia_medico" },
  { label: "Somente farmácia", value: "somente_farmacia" },
  { label: "Farmácia e enfermagem", value: "farmacia_enfermagem" },
];

interface MedicamentoFormItem {
  medicamento: MedicamentoDistinto | null;
  consumo_diario: string;
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
}

const initialMedicamentoItem: MedicamentoFormItem = {
  medicamento: null,
  consumo_diario: "",
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
  consumo_diario: yup
    .string()
    .required("Consumo diário é obrigatório")
    .test("positive", "Consumo diário deve ser maior que zero", (v) => {
      const n = parseFloat(String(v ?? "").replace(",", "."));
      return !isNaN(n) && n > 0;
    }),
});

const schema = yup.object().shape({
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
});

function formatTipoRetorno(tipo: string | null): string {
  if (!tipo) return "—";
  const o = TIPO_RETORNO_OPTIONS.find((x) => x.value === tipo);
  return o?.label ?? tipo;
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

  const fetchPacientes = () => {
    axios
      .get<Paciente[]>(`${API_BASE_URL}/pacientes`)
      .then((res) => setPacientes(res.data ?? []))
      .catch(() => setPacientes([]));
  };

  const fetchMedicamentosDistintos = () => {
    axios
      .get<MedicamentoDistinto[]>(
        `${API_BASE_URL}/medications/distinct-nome-concentration`,
      )
      .then((res) => setMedicamentosDistintos(res.data ?? []))
      .catch(() => setMedicamentosDistintos([]));
  };

  const fetchResumoPorMedicamento = () => {
    setLoadingResumo(true);
    axios
      .get<ResumoPorMedicamento[]>(
        `${API_BASE_URL}/pacientes/resumo-por-medicamento`,
      )
      .then((res) => setResumoPorMedicamento(res.data ?? []))
      .catch(() => setResumoPorMedicamento([]))
      .finally(() => setLoadingResumo(false));
  };

  useEffect(() => {
    fetchPacientes();
    fetchMedicamentosDistintos();
    fetchResumoPorMedicamento();
  }, []);

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
    medicamentos: values.medicamentos.map((item) => ({
      medicamento_nome: item.medicamento!.nome,
      medicamento_concentracao: item.medicamento!.concentracao,
      consumo_diario: parseFloat(
        String(item.consumo_diario ?? "").replace(",", "."),
      ),
    })),
    observacoes:
      values.observacoes != null && values.observacoes !== ""
        ? String(values.observacoes).trim() || null
        : null,
    telefone: values.telefone != null ? String(values.telefone).trim() : "",
    data_liberacao: String(values.data_liberacao ?? "").trim(),
    retorna_servico: values.retorna_servico,
    tipo_retorno: values.retorna_servico ? values.tipo_retorno : null,
  });

  const handleSubmit = (
    values: FormValues,
    helpers: FormikHelpers<FormValues>,
  ) => {
    const hasInvalidMedicamento = values.medicamentos.some(
      (item) =>
        !item.medicamento ||
        !String(item.consumo_diario ?? "").trim(),
    );
    if (hasInvalidMedicamento) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Preencha medicamento e consumo diário em todos os itens.",
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
      axios
        .put(`${API_BASE_URL}/pacientes/${editingPaciente.id}`, payload)
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
    }>;
    Promise.all(
      medicamentosPayload.map((m) =>
        axios.get<ImpactoEstoque>(
          `${API_BASE_URL}/pacientes/impacto-estoque?medicamento_nome=${encodeURIComponent(m.medicamento_nome)}&medicamento_concentracao=${encodeURIComponent(m.medicamento_concentracao)}&consumo_diario=${m.consumo_diario}`,
        ),
      ),
    )
      .then((responses) => setImpactDataList(responses.map((r) => r.data)))
      .catch(() => setImpactDataList([]))
      .finally(() => setLoadingImpact(false));
  };

  const handleConfirmarCadastro = () => {
    if (!pendingPayload) return;
    setSubmittingConfirm(true);
    axios
      .post(`${API_BASE_URL}/pacientes`, pendingPayload)
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
      await axios.delete(`${API_BASE_URL}/pacientes/${deletingPaciente.id}`);
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
            return {
              medicamento: found ?? {
                nome: m.medicamento_nome,
                concentracao: m.medicamento_concentracao,
              },
              consumo_diario: String(m.consumo_diario ?? ""),
            };
          });
        })(),
        observacoes: editingPaciente.observacoes ?? "",
        telefone: editingPaciente.telefone ?? "",
        data_liberacao: toInputDateValue(editingPaciente.data_liberacao ?? ""),
        retorna_servico: Boolean(editingPaciente.retorna_servico),
        tipo_retorno: editingPaciente.tipo_retorno ?? "",
      }
    : initialFormValues;

  return (
    <div className="pacientes-container">
      <FullScreenLoader
        active={formSubmitting || submittingConfirm}
        message={submittingConfirm ? "Cadastrando paciente..." : "Salvando..."}
      />
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog
        visible={!!deletingPaciente}
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
        <Button
          label="Novo paciente"
          icon="pi pi-plus"
          onClick={openCreate}
          className="p-button-primary"
          style={{ marginTop: "20px" }}
        />
      </div>

      {resumoPorMedicamento.length > 0 && (
        <div className="pacientes-resumo-section">
          <h3>Estoque por medicamento (comprometido)</h3>
          {loadingResumo ? (
            <p>Carregando...</p>
          ) : (
            <DataTable
              value={resumoPorMedicamento}
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
                field="consumoDiarioTotal"
                header="Consumo diário total"
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

      <DataTable
        value={pacientes}
        paginator
        rows={10}
        emptyMessage="Nenhum paciente cadastrado."
        className="pacientes-table"
      >
        <Column field="nome" header="Nome" style={{ minWidth: "12rem" }} />
        <Column
          field="prontuario"
          header="Prontuário"
          style={{ minWidth: "8rem" }}
        />
        <Column field="apac" header="APAC" style={{ minWidth: "10rem" }} />
        <Column
          field="diagnostico"
          header="Diagnóstico"
          style={{ minWidth: "12rem" }}
        />
        <Column
          header="Medicamento"
          body={(r: Paciente) =>
            (r.medicamentos ?? [])
              .map(
                (m) =>
                  `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.consumo_diario}/dia)`,
              )
              .join(", ") || "—"
          }
          style={{ minWidth: "14rem" }}
        />
        <Column
          header="Consumo diário"
          body={(r: Paciente) =>
            (r.medicamentos?.length ?? 0) > 1
              ? "Vários"
              : (r.medicamentos?.[0]?.consumo_diario ?? "—")
          }
          style={{ minWidth: "8rem" }}
        />
        <Column
          field="telefone"
          header="Telefone"
          body={(r: Paciente) => (r.telefone?.trim() ? r.telefone : "—")}
          style={{ minWidth: "10rem" }}
        />
        <Column
          field="observacoes"
          header="Observações"
          body={(r: Paciente) => (r.observacoes?.trim() ? r.observacoes : "—")}
          style={{ minWidth: "12rem", maxWidth: "16rem" }}
        />
        <Column
          field="data_liberacao"
          header="Data liberação"
          body={(r: Paciente) => formatDateBR(r.data_liberacao)}
          style={{ minWidth: "10rem" }}
        />
        <Column
          field="retorna_servico"
          header="Retorna?"
          body={(r: Paciente) => (r.retorna_servico ? "Sim" : "Não")}
          style={{ minWidth: "6rem" }}
        />
        <Column
          field="tipo_retorno"
          header="Tipo retorno"
          body={(r: Paciente) => formatTipoRetorno(r.tipo_retorno)}
          style={{ minWidth: "12rem" }}
        />
        <Column
          header="Ações"
          body={(r: Paciente) => (
            <div className="pacientes-actions">
              <Button
                label="Editar"
                icon="pi pi-pencil"
                className="p-button-sm"
                onClick={() => openEdit(r)}
              />
              <Button
                label="Excluir"
                icon="pi pi-trash"
                className="p-button-sm p-button-danger"
                onClick={() => setDeletingPaciente(r)}
                disabled={deletingInProgress}
              />
            </div>
          )}
          style={{ minWidth: "10rem" }}
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
          validationSchema={schema}
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
                    Medicamentos (nome, concentração e consumo diário)
                  </label>
                  <p className="pacientes-field-hint">
                    Selecione pelo nome e concentração. O paciente fica
                    vinculado ao medicamento, não a um lote específico; o
                    estoque considera todos os lotes desse medicamento.
                  </p>
                  {(values.medicamentos ?? []).map((_, index) => (
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

                              const itemError = Array.isArray(
                                errors.medicamentos,
                              )
                                ? (errors.medicamentos[index] as
                                    | {
                                        medicamento?: string;
                                        consumo_diario?: string;
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
                                    })
                                  : undefined;

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

                        <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo">
                          <Field name={`medicamentos.${index}.consumo_diario`}>
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const itemError = Array.isArray(
                                errors.medicamentos,
                              )
                                ? (errors.medicamentos[index] as
                                    | {
                                        medicamento?: string;
                                        consumo_diario?: string;
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
                                    })
                                  : undefined;

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
                      </div>
                    </div>
                  ))}
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
                }>
              )
                ?.map(
                  (m) =>
                    `${m.medicamento_nome} ${m.medicamento_concentracao} (${m.consumo_diario}/dia)`,
                )
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
                  }>
                )?.map((m, idx) => {
                  const impact = impactDataList[idx];
                  return (
                    <div key={idx} className="pacientes-impact-block">
                      <p className="pacientes-impact-med-label">
                        <strong>
                          {m.medicamento_nome} {m.medicamento_concentracao}
                        </strong>{" "}
                        (consumo {m.consumo_diario}/dia)
                      </p>
                      {impact ? (
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
                            Consumo diário atual:{" "}
                            <strong>
                              {impact.consumoDiarioAtual.toFixed(2)}
                            </strong>
                          </li>
                          <li>
                            Com este paciente:{" "}
                            <strong>
                              {impact.consumoDiarioComNovo.toFixed(2)}
                            </strong>
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
    </div>
  );
}
