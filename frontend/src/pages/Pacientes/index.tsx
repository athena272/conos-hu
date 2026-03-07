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
import { ErrorMessage } from "formik";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import LabelInput from "../../components/LabelInput";
import ButtonSubmit from "../../components/ButtonSubmit";
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

interface FormValues {
  nome: string;
  prontuario: string;
  apac: string;
  diagnostico: string;
  medicamento: MedicamentoDistinto | null;
  consumo_diario: string;
  observacoes: string;
  telefone: string;
  data_liberacao: string;
  retorna_servico: boolean;
  tipo_retorno: string;
}

const initialFormValues: FormValues = {
  nome: "",
  prontuario: "",
  apac: "",
  diagnostico: "",
  medicamento: null,
  consumo_diario: "",
  observacoes: "",
  telefone: "",
  data_liberacao: "",
  retorna_servico: false,
  tipo_retorno: "",
};

const schema = yup.object().shape({
  nome: yup.string().required("Nome é obrigatório").trim(),
  prontuario: yup
    .string()
    .required("Prontuário é obrigatório")
    .test("valid", "Prontuário deve ser um número inteiro não negativo", (v) => {
      const n = parseInt(String(v ?? ""), 10);
      return !isNaN(n) && n >= 0 && String(n) === String(v?.trim());
    }),
  apac: yup.string().required("APAC é obrigatória").trim(),
  diagnostico: yup.string().required("Diagnóstico é obrigatório").trim(),
  medicamento: yup
    .object()
    .nullable()
    .required("Selecione o medicamento")
    .test("hasNome", "Selecione o medicamento", (v) => v != null && !!v.nome),
  consumo_diario: yup
    .string()
    .required("Consumo diário é obrigatório")
    .test("positive", "Consumo diário deve ser maior que zero", (v) => {
      const n = parseFloat(String(v ?? "").replace(",", "."));
      return !isNaN(n) && n > 0;
    }),
  observacoes: yup.string().nullable(),
  telefone: yup.string().required("Telefone é obrigatório").trim(),
  data_liberacao: yup.string().required("Data de liberação é obrigatória").trim(),
  retorna_servico: yup.boolean().required(),
  tipo_retorno: yup.string().when("retorna_servico", {
    is: true,
    then: (s) => s.required("Selecione o tipo de retorno").oneOf(["farmacia_medico", "somente_farmacia", "farmacia_enfermagem"]),
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
  const [medicamentosDistintos, setMedicamentosDistintos] = useState<MedicamentoDistinto[]>([]);
  const [resumoPorMedicamento, setResumoPorMedicamento] = useState<ResumoPorMedicamento[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [impactData, setImpactData] = useState<ImpactoEstoque | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);
  const [deletingPaciente, setDeletingPaciente] = useState<Paciente | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);

  const fetchPacientes = () => {
    axios.get<Paciente[]>(`${API_BASE_URL}/pacientes`).then((res) => setPacientes(res.data ?? [])).catch(() => setPacientes([]));
  };

  const fetchMedicamentosDistintos = () => {
    axios
      .get<MedicamentoDistinto[]>(`${API_BASE_URL}/medications/distinct-nome-concentration`)
      .then((res) => setMedicamentosDistintos(res.data ?? []))
      .catch(() => setMedicamentosDistintos([]));
  };

  const fetchResumoPorMedicamento = () => {
    setLoadingResumo(true);
    axios
      .get<ResumoPorMedicamento[]>(`${API_BASE_URL}/pacientes/resumo-por-medicamento`)
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
    setImpactData(null);
  };

  const buildPayload = (values: FormValues): Record<string, unknown> => ({
    nome: values.nome.trim(),
    prontuario: parseInt(values.prontuario.trim(), 10),
    apac: values.apac.trim(),
    diagnostico: values.diagnostico.trim(),
    medicamento_nome: values.medicamento!.nome,
    medicamento_concentracao: values.medicamento!.concentracao,
    consumo_diario: parseFloat(String(values.consumo_diario).replace(",", ".")),
    observacoes: values.observacoes?.trim() || null,
    telefone: values.telefone.trim(),
    data_liberacao: values.data_liberacao.trim(),
    retorna_servico: values.retorna_servico,
    tipo_retorno: values.retorna_servico ? values.tipo_retorno : null,
  });

  const handleSubmit = (values: FormValues, helpers: FormikHelpers<FormValues>) => {
    if (!values.medicamento) {
      toast.current?.show({ severity: "warn", summary: "Atenção", detail: "Selecione o medicamento.", life: 4000 });
      helpers.setSubmitting(false);
      return;
    }
    const payload = buildPayload(values);
    if (editingPaciente) {
      setFormVisible(false);
      axios
        .put(`${API_BASE_URL}/pacientes/${editingPaciente.id}`, payload)
        .then(() => {
          toast.current?.show({ severity: "success", summary: "Sucesso", detail: "Paciente atualizado com sucesso.", life: 3000 });
          fetchPacientes();
          fetchResumoPorMedicamento();
        })
        .catch((err: unknown) => {
          toast.current?.show({ severity: "error", summary: "Erro", detail: normalizeErrorMessage(err), life: 4000 });
        })
        .finally(() => helpers.setSubmitting(false));
      return;
    }
    setPendingPayload(payload);
    setConfirmModalVisible(true);
    setImpactData(null);
    setLoadingImpact(true);
    const nome = encodeURIComponent(values.medicamento.nome);
    const conc = encodeURIComponent(values.medicamento.concentracao);
    const consumo = parseFloat(String(values.consumo_diario).replace(",", "."));
    axios
      .get<ImpactoEstoque>(
        `${API_BASE_URL}/pacientes/impacto-estoque?medicamento_nome=${nome}&medicamento_concentracao=${conc}&consumo_diario=${consumo}`
      )
      .then((res) => setImpactData(res.data))
      .catch(() => setImpactData(null))
      .finally(() => setLoadingImpact(false));
    helpers.setSubmitting(false);
  };

  const handleConfirmarCadastro = () => {
    if (!pendingPayload) return;
    setSubmittingConfirm(true);
    axios
      .post(`${API_BASE_URL}/pacientes`, pendingPayload)
      .then(() => {
        toast.current?.show({ severity: "success", summary: "Sucesso", detail: "Paciente cadastrado com sucesso.", life: 3000 });
        closeForm();
        fetchPacientes();
        fetchResumoPorMedicamento();
      })
      .catch((err: unknown) => {
        toast.current?.show({ severity: "error", summary: "Erro", detail: normalizeErrorMessage(err), life: 4000 });
      })
      .finally(() => setSubmittingConfirm(false));
  };

  const handleCancelarConfirm = () => {
    setConfirmModalVisible(false);
    setPendingPayload(null);
    setImpactData(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPaciente) return;
    setDeletingInProgress(true);
    try {
      await axios.delete(`${API_BASE_URL}/pacientes/${deletingPaciente.id}`);
      toast.current?.show({ severity: "success", summary: "Sucesso", detail: "Paciente excluído com sucesso.", life: 3000 });
      setDeletingPaciente(null);
      fetchPacientes();
      fetchResumoPorMedicamento();
    } catch (err: unknown) {
      toast.current?.show({ severity: "error", summary: "Erro", detail: normalizeErrorMessage(err), life: 4000 });
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
        medicamento: (() => {
          if (!editingPaciente.medicamento_nome || !editingPaciente.medicamento_concentracao) return null;
          const found = medicamentosDistintos.find(
            (m) => m.nome === editingPaciente.medicamento_nome && m.concentracao === editingPaciente.medicamento_concentracao
          );
          return found ?? { nome: editingPaciente.medicamento_nome, concentracao: editingPaciente.medicamento_concentracao };
        })(),
        consumo_diario: String(editingPaciente.consumo_diario ?? ""),
        observacoes: editingPaciente.observacoes ?? "",
        telefone: editingPaciente.telefone ?? "",
        data_liberacao: toInputDateValue(editingPaciente.data_liberacao ?? ""),
        retorna_servico: Boolean(editingPaciente.retorna_servico),
        tipo_retorno: editingPaciente.tipo_retorno ?? "",
      }
    : initialFormValues;

  return (
    <div className="pacientes-container">
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
        <Button label="Novo paciente" icon="pi pi-plus" onClick={openCreate} className="p-button-primary" />
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
              <Column field="medicamento_nome" header="Medicamento" body={(r: ResumoPorMedicamento) => `${r.medicamento_nome} - ${r.medicamento_concentracao}`} />
              <Column field="estoqueTotal" header="Estoque total" />
              <Column field="qtdPacientes" header="Pacientes" />
              <Column field="consumoDiarioTotal" header="Consumo diário total" />
              <Column
                header="Estoque dá para (meses)"
                body={(r: ResumoPorMedicamento) => (r.mesesEstoque != null ? `${r.mesesEstoque}` : "—")}
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
        <Column field="prontuario" header="Prontuário" style={{ minWidth: "8rem" }} />
        <Column field="apac" header="APAC" style={{ minWidth: "10rem" }} />
        <Column field="diagnostico" header="Diagnóstico" style={{ minWidth: "12rem" }} />
        <Column
          header="Medicamento"
          body={(r: Paciente) => `${r.medicamento_nome} - ${r.medicamento_concentracao}`}
          style={{ minWidth: "14rem" }}
        />
        <Column field="consumo_diario" header="Consumo diário" style={{ minWidth: "8rem" }} />
        <Column field="telefone" header="Telefone" style={{ minWidth: "10rem" }} />
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
              <Button label="Editar" icon="pi pi-pencil" className="p-button-sm" onClick={() => openEdit(r)} />
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
          initialValues={editFormInitialValues}
          validationSchema={schema}
          enableReinitialize
          onSubmit={handleSubmit}
        >
          {({ values, setFieldValue, setFieldTouched, isSubmitting, errors, touched }) => (
            <Form>
              <div className="pacientes-form-fields">
                <LabelInput name="nome" label="Nome" placeholder="Nome do paciente" />
                <LabelInput name="prontuario" label="Prontuário" placeholder="Número do prontuário" type="number" />
                <LabelInput name="apac" label="APAC" placeholder="APAC (texto)" />
                <LabelInput name="diagnostico" label="Diagnóstico" placeholder="Diagnóstico" />
                <div className="campo-dropdown">
                  <label htmlFor="medicamento" className="input-label">Medicamento</label>
                  <Field name="medicamento">
                    {({ form }: { form: { setFieldValue: (n: string, v: unknown) => void; setFieldTouched: (n: string, t: boolean) => void; errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
                      <Dropdown
                        id="medicamento"
                        value={values.medicamento}
                        options={medicamentoDropdownOptions}
                        optionLabel="label"
                        optionValue="value"
                        onChange={(e: { value: MedicamentoDistinto | null }) => {
                          setFieldValue("medicamento", e.value);
                          form.setFieldTouched("medicamento", true);
                        }}
                        onBlur={() => setFieldTouched("medicamento", true)}
                        placeholder="Selecione o medicamento"
                        className={`w-full ${errors.medicamento && touched.medicamento ? "p-invalid" : ""}`}
                      />
                    )}
                  </Field>
                  <ErrorMessage component="span" name="medicamento" className="form-error" />
                </div>
                <LabelInput name="consumo_diario" label="Consumo diário" placeholder="Ex.: 2" type="number" />
                <LabelInput name="observacoes" label="Observações (opcional)" placeholder="Observações" />
                <LabelInput name="telefone" label="Telefone" placeholder="Telefone" />
                <LabelInput name="data_liberacao" label="Data de liberação" type="date" />
                <div className="campo-dropdown">
                  <label htmlFor="retorna_servico" className="input-label">O paciente vai retornar para o serviço?</label>
                  <Dropdown
                    id="retorna_servico"
                    value={values.retorna_servico}
                    options={RETORNA_SERVICO_OPTIONS}
                    onChange={(e: { value: boolean }) => setFieldValue("retorna_servico", e.value)}
                    placeholder="Sim ou Não"
                    className="w-full"
                  />
                </div>
                {values.retorna_servico && (
                  <div className="campo-dropdown">
                    <label htmlFor="tipo_retorno" className="input-label">Tipo de retorno</label>
                    <Field name="tipo_retorno">
                      {({ form }: { form: { setFieldValue: (n: string, v: unknown) => void; setFieldTouched: (n: string, t: boolean) => void; errors: Record<string, unknown>; touched: Record<string, unknown> } }) => (
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
                    <ErrorMessage component="span" name="tipo_retorno" className="form-error" />
                  </div>
                )}
              </div>
              <div className="pacientes-form-footer">
                <Button type="button" label="Cancelar" className="p-button-text" onClick={closeForm} />
                <ButtonSubmit type="submit" loading={isSubmitting} disabled={isSubmitting}>
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
            <Button label="Cancelar" className="p-button-text" onClick={handleCancelarConfirm} disabled={submittingConfirm} />
            <Button label="Confirmar cadastro" onClick={handleConfirmarCadastro} loading={submittingConfirm} disabled={submittingConfirm || loadingImpact} />
          </div>
        }
      >
        {pendingPayload && (
          <div className="pacientes-confirm-content">
            <p><strong>Resumo:</strong> {String(pendingPayload.nome)} — Pront. {String(pendingPayload.prontuario)} — Medicamento: {String(pendingPayload.medicamento_nome)} ({String(pendingPayload.medicamento_concentracao)}). Consumo diário: {String(pendingPayload.consumo_diario)}.</p>
            <h4>Impacto no estoque</h4>
            {loadingImpact ? (
              <p>Carregando...</p>
            ) : impactData ? (
              <ul className="pacientes-impact-list">
                <li>Estoque total do medicamento: <strong>{impactData.estoqueTotal}</strong> unidades</li>
                <li>Pacientes já vinculados a este medicamento: <strong>{impactData.pacientesVinculados}</strong></li>
                <li>Consumo diário atual (todos os pacientes): <strong>{impactData.consumoDiarioAtual.toFixed(2)}</strong></li>
                <li>Consumo diário com este paciente: <strong>{impactData.consumoDiarioComNovo.toFixed(2)}</strong></li>
                <li>Estoque atual dá para: <strong>{impactData.mesesEstoqueAtual != null ? `${impactData.mesesEstoqueAtual} meses` : "—"}</strong></li>
                <li>Com este paciente, o estoque daria para: <strong>{impactData.mesesEstoqueComNovo != null ? `${impactData.mesesEstoqueComNovo} meses` : "—"}</strong></li>
              </ul>
            ) : (
              <p>Não foi possível carregar o impacto no estoque.</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
