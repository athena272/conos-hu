import { useRef, useEffect, useState } from "react";
import LabelInput from "../../components/LabelInput";
import DropdownInput, { DropdownOption } from "../../components/DropdownInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Dropdown } from "primereact/dropdown";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";
import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

type EntryType = "new" | "existing";

interface RegisterMedicationValues {
  entryType: EntryType;
  name: string;
  batch: string;
  quantity: string;
  classification: string;
  concentration: string;
  pharmaceuticalForm: DropdownOption | null;
  expiryDate: string;
  existingMedicationId: number | null;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

function RegisterMedication() {
  const toast = useRef<Toast>(null);
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);

  const pharmaceuticalForms: DropdownOption[] = [
    { name: "Comprimido", code: 1 },
    { name: "Injetável", code: 2 },
    { name: "Gotas", code: 3 },
    { name: "Outros", code: 4 },
  ];

  useEffect(() => {
    Axios.get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`)
      .then((res) => setMedications(res.data ?? []))
      .catch(() => setMedications([]));
  }, []);

  const newLoteSchema = yup.object().shape({
    entryType: yup.string().oneOf(["new", "existing"]).required(),
    name: yup.string(),
    batch: yup.string(),
    quantity: yup.string().required("A quantidade é obrigatória"),
    classification: yup.string(),
    concentration: yup.string(),
    pharmaceuticalForm: yup.object().nullable(),
    expiryDate: yup.string(),
    existingMedicationId: yup.number().nullable(),
  });

  const handleRegisterMedication = (
    values: RegisterMedicationValues,
    { resetForm, setSubmitting }: FormikHelpers<RegisterMedicationValues>
  ) => {
    if (values.entryType === "existing") {
      const medicationId = values.existingMedicationId;
      if (!medicationId) {
        toast.current?.show({
          severity: "warn",
          summary: "Atenção!",
          detail: "Selecione um medicamento/lote.",
          life: 4000,
        });
        setSubmitting(false);
        return;
      }
      const qty = parseInt(values.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        toast.current?.show({
          severity: "warn",
          summary: "Atenção!",
          detail: "Informe uma quantidade válida.",
          life: 4000,
        });
        setSubmitting(false);
        return;
      }
      Axios.post(`${API_BASE_URL}/medications/add-quantity`, {
        medication_id: medicationId,
        quantidade: qty,
      })
        .then(() => {
          toast.current?.show({
            severity: "success",
            summary: "Sucesso!",
            detail: "Quantidade adicionada ao lote com sucesso!",
            life: 3000,
          });
          resetForm();
        })
        .catch((error: unknown) => {
          toast.current?.show({
            severity: "error",
            summary: "Erro!",
            detail: normalizeErrorMessage(error),
            life: 3000,
          });
        })
        .finally(() => setSubmitting(false));
      return;
    }

    if (
      !values.name?.trim() ||
      !values.batch?.trim() ||
      !values.quantity ||
      !values.classification?.trim() ||
      !values.concentration?.trim() ||
      !values.pharmaceuticalForm ||
      !values.expiryDate
    ) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: "Preencha todos os campos obrigatórios do novo lote.",
        life: 4000,
      });
      setSubmitting(false);
      return;
    }

    Axios.post(`${API_BASE_URL}/medications`, {
      nome: values.name,
      lote: values.batch,
      quantidade: values.quantity,
      classificacao: values.classification,
      concentracao: values.concentration,
      forma: values.pharmaceuticalForm?.code,
      data_validade: values.expiryDate,
    })
      .then(() => {
        toast.current?.show({
          severity: "success",
          summary: "Sucesso!",
          detail: "Medicação registrada com sucesso!",
          life: 3000,
        });
        resetForm();
      })
      .catch((error: unknown) => {
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: normalizeErrorMessage(error),
          life: 3000,
        });
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-register-medication">
        <h2>Registrar Medicação</h2>
        <p>Preencha os dados abaixo para registrar uma nova medicação.</p>
        <Toast ref={toast} position="top-right" />

        <Formik
          initialValues={{
            entryType: "new" as EntryType,
            name: "",
            batch: "",
            quantity: "",
            classification: "",
            concentration: "",
            pharmaceuticalForm: null as DropdownOption | null,
            expiryDate: "",
            existingMedicationId: null as number | null,
          }}
          validationSchema={newLoteSchema}
          onSubmit={handleRegisterMedication}
        >
          {({ values, setFieldValue, isSubmitting }) => (
            <>
              <FullScreenLoader
                active={isSubmitting}
                message={values.entryType === "existing" ? "Adicionando quantidade..." : "Salvando..."}
              />
              <Form className="register-form">
              <div className="form-group">
                <label>Tipo de entrada</label>
                <Dropdown
                  value={values.entryType}
                  options={[
                    { label: "Novo lote", value: "new" },
                    { label: "Adicionar a lote existente", value: "existing" },
                  ]}
                  onChange={(e) => {
                    setFieldValue("entryType", e.value);
                    if (e.value === "existing") setFieldValue("existingMedicationId", null);
                  }}
                  placeholder="Selecione"
                  className="w-full"
                />
              </div>

              {values.entryType === "existing" ? (
                <>
                  <div className="form-group">
                    <label>Medicamento / Lote</label>
                    <Dropdown
                      value={values.existingMedicationId}
                      options={medications.map((m) => ({
                        label: `${m.nome} - Lote ${m.lote} - Validade ${formatDate(m.data_validade)}`,
                        value: m.id,
                      }))}
                      onChange={(e) => setFieldValue("existingMedicationId", e.value)}
                      placeholder="Selecione o medicamento"
                      className="w-full"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="quantity"
                      type="number"
                      placeholder="Quantidade a adicionar"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <LabelInput name="name" placeholder="Nome do Medicamento" />
                  </div>
                  <div className="form-group">
                    <LabelInput name="batch" placeholder="Lote" />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="quantity"
                      type="number"
                      placeholder="Quantidade"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput name="classification" placeholder="Classificação" />
                  </div>
                  <div className="form-group">
                    <LabelInput name="concentration" placeholder="Concentração" />
                  </div>
                  <div className="form-group">
                    <DropdownInput
                      name="pharmaceuticalForm"
                      label="Forma Farmacêutica"
                      options={pharmaceuticalForms}
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput name="expiryDate" placeholder="Validade" type="date" />
                  </div>
                </>
              )}

              <Button type="submit" disabled={isSubmitting}>
                {values.entryType === "existing" ? "Adicionar quantidade" : "Registrar"}
              </Button>
            </Form>
            </>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default RegisterMedication;
