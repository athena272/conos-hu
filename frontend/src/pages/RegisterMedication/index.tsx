import { useRef, useState, useCallback } from "react";
import LabelInput from "../../components/LabelInput";
import DropdownInput, { DropdownOption } from "../../components/DropdownInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Dropdown } from "primereact/dropdown";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import { Toast } from "primereact/toast";
import { api } from "../../api/client";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR } from "../../utils/dateUtils";
import FullScreenLoader from "../../components/FullScreenLoader";
import { useApiQuery } from "../../hooks/useApiQuery";
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

function RegisterMedication() {
  const toast = useRef<Toast>(null);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchMedicationsList = useCallback(async () => {
    const res = await api.get<MedicationWithStatus[]>("/medications");
    return res.data ?? [];
  }, []);

  const {
    data: medications,
    loading: loadingMedications,
    reload: reloadMedications,
  } = useApiQuery(fetchMedicationsList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const pharmaceuticalForms: DropdownOption[] = [
    { name: "Comprimido", code: 1 },
    { name: "Injetável", code: 2 },
    { name: "Gotas", code: 3 },
    { name: "Outros", code: 4 },
  ];

  const newLoteSchema = yup.object().shape({
    entryType: yup.string().oneOf(["new", "existing"]).required(),
    name: yup.string().when("entryType", {
      is: "new",
      then: (s) => s.required("O nome do medicamento é obrigatório").trim(),
      otherwise: (s) => s.nullable(),
    }),
    batch: yup.string().when("entryType", {
      is: "new",
      then: (s) => s.required("O lote é obrigatório").trim(),
      otherwise: (s) => s.nullable(),
    }),
    quantity: yup
      .string()
      .required("A quantidade é obrigatória")
      .test("min", "Informe uma quantidade válida (maior que 0)", (val) => {
        if (val == null || val === "") return false;
        const n = parseInt(val, 10);
        return !isNaN(n) && n > 0;
      }),
    classification: yup.string().when("entryType", {
      is: "new",
      then: (s) => s.required("A classificação é obrigatória").trim(),
      otherwise: (s) => s.nullable(),
    }),
    concentration: yup.string().when("entryType", {
      is: "new",
      then: (s) => s.required("A concentração é obrigatória").trim(),
      otherwise: (s) => s.nullable(),
    }),
    pharmaceuticalForm: yup.object().nullable().when("entryType", {
      is: "new",
      then: (s) => s.required("Selecione a forma farmacêutica"),
      otherwise: (s) => s.nullable(),
    }),
    expiryDate: yup.string().when("entryType", {
      is: "new",
      then: (s) => s.required("A data de validade é obrigatória"),
      otherwise: (s) => s.nullable(),
    }),
    existingMedicationId: yup.number().nullable().when("entryType", {
      is: "existing",
      then: (s) => s.required("Selecione um medicamento/lote"),
      otherwise: (s) => s.nullable(),
    }),
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
      api
        .post("/medications/add-quantity", {
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
          void reloadMedications({ silent: true });
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

    api
      .post("/medications", {
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
          detail: "Medicamento registrado com sucesso!",
          life: 3000,
        });
        resetForm();
        void reloadMedications({ silent: true });
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
        <h2>Registrar Medicamento</h2>
        <p>Preencha os dados abaixo para registrar um novo medicamento.</p>
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
                active={isSubmitting || loadingMedications}
                message={
                  isSubmitting
                    ? values.entryType === "existing"
                      ? "Adicionando quantidade..."
                      : "Salvando..."
                    : "Carregando..."
                }
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
                        label: `${m.nome} - Lote ${m.lote} - Validade ${formatDateBR(m.data_validade)}`,
                        value: m.id,
                      }))}
                      onChange={(e) => setFieldValue("existingMedicationId", e.value)}
                      placeholder={
                        loadingMedications
                          ? "Carregando medicamentos..."
                          : "Selecione o medicamento"
                      }
                      disabled={loadingMedications}
                      className="w-full"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="quantity"
                      label="Quantidade"
                      placeholder="Quantidade a adicionar"
                      type="number"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <LabelInput
                      name="name"
                      label="Nome do medicamento"
                      placeholder="Digite o nome do medicamento"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="batch"
                      label="Lote"
                      placeholder="Digite o nome do lote"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="quantity"
                      label="Quantidade"
                      type="number"
                      placeholder="Digite a quantidade do medicamento"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="classification"
                      label="Classificação"
                      placeholder="Digite a classificação do medicamento"
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="concentration"
                      label="Concentração"
                      placeholder="Ex.: 500mg, 250mg"
                    />
                  </div>
                  <div className="form-group">
                    <DropdownInput
                      name="pharmaceuticalForm"
                      label="Forma Farmacêutica"
                      options={pharmaceuticalForms}
                    />
                  </div>
                  <div className="form-group">
                    <LabelInput
                      name="expiryDate"
                      label="Validade"
                      placeholder="Validade"
                      type="date"
                    />
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
