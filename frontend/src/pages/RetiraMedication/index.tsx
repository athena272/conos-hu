import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LabelInput from "../../components/LabelInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Dropdown } from "primereact/dropdown";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { Toast } from "primereact/toast";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

interface RetiraMedicationValues {
  name: string;
  concentration: string;
  selectedMedicationId: number | null;
  quantity: number;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("pt-BR");
}

interface AxiosErrorLike {
  code?: string;
  response?: {
    status?: number;
    data?: { error?: string };
  };
}

function RetiraMedication() {
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();
  const [lots, setLots] = useState<MedicationWithStatus[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"filter" | "all" | null>(null);

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

      const medicationId = values.selectedMedicationId ?? null;
      if (!medicationId) {
        if (lots.length === 0) {
          toast.current?.show({
            severity: "warn",
            summary: "Atenção!",
            detail: "Clique em 'Buscar lotes' ou 'Ver todos os lotes' e selecione um lote.",
            life: 5000,
          });
        } else {
          toast.current?.show({
            severity: "warn",
            summary: "Atenção!",
            detail: "Selecione um lote na lista.",
            life: 5000,
          });
        }
        return;
      }

      const retiradaData = {
        medication_id: medicationId,
        usuario_id: parseInt(usuarioId),
        quantidade: parseInt(String(values.quantity)),
      };

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
      setLots([]);
      navigate("/home");
    } catch (error) {
      const err = error as AxiosErrorLike;
      console.error("❌ Erro completo:", err);

      const severity =
        err.response?.status === 400 &&
        err.response?.data?.error === "Quantidade insuficiente em estoque"
          ? "warn"
          : "error";

      toast.current?.show({
        severity,
        summary: severity === "warn" ? "Aviso!" : "Erro!",
        detail: normalizeErrorMessage(error),
        life: 5000,
      });
    }
  };

  const retireSchema = yup.object().shape({
    name: yup.string().trim(),
    concentration: yup.string().trim(),
    selectedMedicationId: yup.number().nullable(),
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
            selectedMedicationId: null as number | null,
            quantity: 0,
          }}
          validationSchema={retireSchema}
          onSubmit={handleRetireMedication}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {({ errors, touched, isSubmitting, values, setFieldValue }) => (
            <>
              <FullScreenLoader active={isSubmitting} message="Processando retirada..." />
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

              <div className="form-group retire-form-actions">
                <Button
                  type="button"
                  disabled={isSubmitting || loadingLots || !values.name.trim() || !values.concentration.trim()}
                  onClick={async () => {
                    setLoadingLots(true);
                    setLoadingMode("filter");
                    setFieldValue("selectedMedicationId", null);
                    try {
                      const res = await Axios.get<MedicationWithStatus[]>(
                        `${API_BASE_URL}/medications/by-name-concentration`,
                        {
                          params: {
                            nome: values.name.trim(),
                            concentracao: values.concentration.trim(),
                          },
                        }
                      );
                      setLots(res.data ?? []);
                      if (!res.data?.length) {
                        toast.current?.show({
                          severity: "info",
                          summary: "Busca",
                          detail: "Nenhum lote encontrado com esse nome e concentração.",
                          life: 4000,
                        });
                      }
                    } catch (e) {
                      setLots([]);
                      toast.current?.show({
                        severity: "error",
                        summary: "Erro!",
                        detail: normalizeErrorMessage(e),
                        life: 5000,
                      });
                    } finally {
                      setLoadingLots(false);
                      setLoadingMode(null);
                    }
                  }}
                >
                  {loadingLots && loadingMode === "filter" ? "Buscando..." : "Buscar lotes"}
                </Button>
                <Button
                  type="button"
                  className="p-button-outlined"
                  disabled={isSubmitting || loadingLots}
                  onClick={async () => {
                    setLoadingLots(true);
                    setLoadingMode("all");
                    setFieldValue("selectedMedicationId", null);
                    try {
                      const res = await Axios.get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`);
                      setLots(res.data ?? []);
                      if (!res.data?.length) {
                        toast.current?.show({
                          severity: "info",
                          summary: "Busca",
                          detail: "Nenhum lote cadastrado.",
                          life: 4000,
                        });
                      }
                    } catch (e) {
                      setLots([]);
                      toast.current?.show({
                        severity: "error",
                        summary: "Erro!",
                        detail: normalizeErrorMessage(e),
                        life: 5000,
                      });
                    } finally {
                      setLoadingLots(false);
                      setLoadingMode(null);
                    }
                  }}
                >
                  {loadingLots && loadingMode === "all" ? "Carregando..." : "Ver todos os lotes"}
                </Button>
              </div>

              {lots.length > 0 && (
                <div className="form-group">
                  <label htmlFor="lot">Lote</label>
                  <Dropdown
                    id="lot"
                    value={values.selectedMedicationId}
                    options={lots.map((m) => ({
                      label: `${m.nome} - Lote ${m.lote} - Validade ${formatDate(m.data_validade)} - Qtd ${m.quantidade}`,
                      value: m.id,
                    }))}
                    onChange={(e) => setFieldValue("selectedMedicationId", e.value)}
                    placeholder="Selecione o lote"
                    className="w-full"
                    disabled={isSubmitting}
                  />
                </div>
              )}

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
            </>
          )}
        </Formik>
      </div>
    </div>
  );
}

export default RetiraMedication;
