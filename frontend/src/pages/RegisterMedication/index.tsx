import { useRef } from "react";
import LabelInput from "../../components/LabelInput";
import DropdownInput, { DropdownOption } from "../../components/DropdownInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";
import { API_BASE_URL } from "../../config/api";
import "./styles.css";

interface RegisterMedicationValues {
  name: string;
  batch: string;
  quantity: string;
  classification: string;
  concentration: string;
  pharmaceuticalForm: DropdownOption | null;
  expiryDate: string;
}

function RegisterMedication() {
  const toast = useRef<Toast>(null);

  const pharmaceuticalForms: DropdownOption[] = [
    { name: "Comprimido", code: 1 },
    { name: "Injetável", code: 2 },
    { name: "Gotas", code: 3 },
    { name: "Outros", code: 4 },
  ];

  const medicationSchema = yup.object().shape({
    name: yup.string().required("O nome do medicamento é obrigatório"),
    batch: yup.string().required("O lote é obrigatório"),
    quantity: yup.string().required("A quantidade é obrigatória"),
    classification: yup.string().required("A classificação é obrigatória"),
    concentration: yup.string().required("A concentração é obrigatória"),
    pharmaceuticalForm: yup
      .object()
      .nullable()
      .required("A forma farmacêutica é obrigatória"),
    expiryDate: yup
      .date()
      .min(new Date(), "A validade deve ser uma data futura")
      .required("A validade é obrigatória"),
  });

  const handleRegisterMedication = (
    values: RegisterMedicationValues,
    { resetForm }: FormikHelpers<RegisterMedicationValues>
  ) => {
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
      .catch(() => {
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: "Falha ao registrar medicação. Tente novamente.",
          life: 3000,
        });
      });
  };

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-register-medication">
        <h2>Registrar Medicação</h2>
        <p>Preencha os dados abaixo para registrar uma nova medicação.</p>
        <Toast ref={toast} />

        <Formik
          initialValues={{
            name: "",
            batch: "",
            quantity: "",
            classification: "",
            concentration: "",
            pharmaceuticalForm: null as DropdownOption | null,
            expiryDate: "",
          }}
          validationSchema={medicationSchema}
          onSubmit={handleRegisterMedication}
        >
          <Form className="register-form">
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

            <Button>Registrar</Button>
          </Form>
        </Formik>
      </div>
    </div>
  );
}

export default RegisterMedication;
