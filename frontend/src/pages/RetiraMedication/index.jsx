import { useRef, useEffect } from "react";
import LabelInput from "../../components/LabelInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Formik, Form } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";
import "./styles.css";

function RetiraMedication() {
  const toast = useRef(null);

  // Verificar se usuário está logado
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

  const handleRetireMedication = async (values, { resetForm }) => {
    try {

      // Verificar se usuário está logado
      const usuarioId = localStorage.getItem("userId");
      if (!usuarioId) {
        toast.current.show({
          severity: "error",
          summary: "Erro!",
          detail: "Usuário não está logado. Faça login novamente.",
          life: 5000,
        });
        return;
      }

      const medResponse = await Axios.post(
        "http://localhost:3001/medications/search",
        {
          nome: values.name.trim(),
          concentracao: values.concentration.trim(),
        }
      );

      const medication = medResponse.data;

      if (!medication || !medication.id) {
        console.error("❌ Medicação não encontrada no banco");
        toast.current.show({
          severity: "error",
          summary: "Erro!",
          detail: "Medicação não encontrada! Verifique o nome e concentração.",
          life: 5000,
        });
        return;
      }

      // Preparar dados para retirada
      const retiradaData = {
        medication_id: medication.id,
        usuario_id: parseInt(usuarioId),
        quantidade: parseInt(values.quantity),
      };

      console.log("🔄 Enviando requisição de retirada:", retiradaData);

      // Fazer a retirada
      const retiradaResponse = await Axios.post(
        "http://localhost:3001/retira",
        retiradaData,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log("✅ Resposta da retirada:", retiradaResponse.data);

      toast.current.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Retirada realizada com sucesso!",
        life: 3000,
      });

      resetForm();
      
    } catch (error) {
      console.error("❌ Erro completo:", error);
      console.error("📊 Dados da resposta de erro:", error.response?.data);
      console.error("🔢 Status do erro:", error.response?.status);

      let errorMessage = "Falha ao retirar medicação. Tente novamente.";
      let severity = "error";

      // Tratamento específico de erros
      if (error.code === 'ERR_NETWORK') {
        errorMessage = "Erro de conexão. Verifique se o servidor está rodando.";
      } else if (error.response?.status === 400) {
        if (error.response.data?.error === "Quantidade insuficiente em estoque") {
          errorMessage = "Quantidade insuficiente em estoque!";
          severity = "warn";
        } else if (error.response.data?.error === "Todos os campos são obrigatórios e quantidade deve ser numérica") {
          errorMessage = "Dados inválidos. Verifique os campos preenchidos.";
        } else {
          errorMessage = error.response.data?.error || "Dados inválidos enviados ao servidor.";
        }
      } else if (error.response?.status === 404) {
        if (error.response.data?.error === "Medicação não encontrada") {
          errorMessage = "Medicação não encontrada no estoque.";
        } else {
          errorMessage = "Recurso não encontrado.";
        }
      } else if (error.response?.status === 500) {
        errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      console.log(`🎯 Exibindo toast: ${severity} - ${errorMessage}`);

      toast.current.show({
        severity: severity,
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
        <Toast 
          ref={toast} 
          position="top-right"
        />

        <Formik
          initialValues={{
            name: "",
            concentration: "",
            quantity: "",
          }}
          validationSchema={retireSchema}
          onSubmit={handleRetireMedication}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {({ errors, touched, isSubmitting, values }) => (
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
                  min="1"
                  step="1"
                  disabled={isSubmitting}
                />
                {touched.quantity && errors.quantity && (
                  <div className="error-message">{errors.quantity}</div>
                )}
              </div>

              <Button 
                disabled={isSubmitting}
                type="submit"
              >
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