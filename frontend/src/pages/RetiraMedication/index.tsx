import { useRef, useEffect } from "react";
import LabelInput from "../../components/LabelInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { Toast } from "primereact/toast";
import "./styles.css";
import type { Medication } from "../../types";

interface RetiraMedicationValues {
  name: string;
  concentration: string;
  quantity: number;
}

interface AxiosError {
  code?: string;
  response?: {
    status?: number;
    data?: { error?: string };
  };
}

function RetiraMedication() {
  const toast = useRef<Toast>(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    console.log("🔐 ID do usuário no localStorage:", userId);

    if (!userId) {
      console.warn("⚠️ Usuário não está logado!");
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: "Você precisa estar logado para retirar medicamentos.",
        life: 5000,
      });
    }
  }, []);

  const handleRetireMedication = async (
    values: RetiraMedicationValues,
    { resetForm }: FormikHelpers<RetiraMedicationValues>
  ) => {
    try {
      const usuarioId = localStorage.getItem("userId");
      if (!usuarioId) {
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: "Usuário não está logado. Faça login novamente.",
          life: 5000,
        });
        return;
      }

      const medResponse = await Axios.post<Medication>(
        `${API_BASE_URL}/medications/search`,
        {
          nome: values.name.trim(),
          concentracao: values.concentration.trim(),
        }
      );

      const medication = medResponse.data;

      if (!medication || !medication.id) {
        console.error("❌ Medicação não encontrada no banco");
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: "Medicação não encontrada! Verifique o nome e concentração.",
          life: 5000,
        });
        return;
      }

      const retiradaData = {
        medication_id: medication.id,
        usuario_id: parseInt(usuarioId),
        quantidade: parseInt(String(values.quantity)),
      };

      console.log("🔄 Enviando requisição de retirada:", retiradaData);

      await Axios.post(`${API_BASE_URL}/retira`, retiradaData, {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Retirada realizada com sucesso!",
        life: 3000,
      });

      resetForm();
    } catch (error) {
      const err = error as AxiosError;
      console.error("❌ Erro completo:", err);
      console.error("📊 Dados da resposta de erro:", err.response?.data);
      console.error("🔢 Status do erro:", err.response?.status);

      let errorMessage = "Falha ao retirar medicação. Tente novamente.";
      let severity: "error" | "warn" = "error";

      if (err.code === "ERR_NETWORK") {
        errorMessage = "Erro de conexão. Verifique se o servidor está rodando.";
      } else if (err.response?.status === 400) {
        if (
          err.response.data?.error === "Quantidade insuficiente em estoque"
        ) {
          errorMessage = "Quantidade insuficiente em estoque!";
          severity = "warn";
        } else if (
          err.response.data?.error ===
          "Todos os campos são obrigatórios e quantidade deve ser numérica"
        ) {
          errorMessage = "Dados inválidos. Verifique os campos preenchidos.";
        } else {
          errorMessage =
            err.response.data?.error ||
            "Dados inválidos enviados ao servidor.";
        }
      } else if (err.response?.status === 404) {
        if (err.response.data?.error === "Medicação não encontrada") {
          errorMessage = "Medicação não encontrada no estoque.";
        } else {
          errorMessage = "Recurso não encontrado.";
        }
      } else if (err.response?.status === 500) {
        errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      toast.current?.show({
        severity,
        summary: severity === "warn" ? "Aviso!" : "Erro!",
        detail: errorMessage,
        life: 5000,
      });
    }
  };

  const retireSchema = yup.object().shape({
    name: yup
      .string()
      .required("O nome do medicamento é obrigatório")
      .min(2, "O nome deve ter pelo menos 2 caracteres")
      .trim(),
    concentration: yup
      .string()
      .required("A concentração é obrigatória")
      .min(1, "A concentração é obrigatória")
      .trim(),
    quantity: yup
      .number()
      .typeError("A quantidade deve ser um número")
      .min(1, "A quantidade deve ser maior que 0")
      .integer("A quantidade deve ser um número inteiro")
      .required("A quantidade é obrigatória"),
  });

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-retire-medication">
        <h2>Retirar Medicação</h2>
        <p>Preencha os dados abaixo para retirar uma medicação.</p>
        <Toast ref={toast} position="top-right" />

        <Formik
          initialValues={{
            name: "",
            concentration: "",
            quantity: 0,
          }}
          validationSchema={retireSchema}
          onSubmit={handleRetireMedication}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form className="retire-form">
              <div className="form-group">
                <LabelInput
                  name="name"
                  placeholder="Nome do Medicamento"
                  disabled={isSubmitting}
                />
                {touched.name && errors.name && (
                  <div className="error-message">{errors.name}</div>
                )}
              </div>

              <div className="form-group">
                <LabelInput
                  name="concentration"
                  placeholder="Concentração (ex: 500mg, 250mg)"
                  disabled={isSubmitting}
                />
                {touched.concentration && errors.concentration && (
                  <div className="error-message">{errors.concentration}</div>
                )}
              </div>

              <div className="form-group">
                <LabelInput
                  name="quantity"
                  placeholder="Quantidade"
                  type="number"
                  disabled={isSubmitting}
                />
                {touched.quantity && errors.quantity && (
                  <div className="error-message">{errors.quantity}</div>
                )}
              </div>

              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Processando..." : "Retirar"}
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default RetiraMedication;
