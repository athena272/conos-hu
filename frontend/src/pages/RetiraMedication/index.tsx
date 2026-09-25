import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LabelInput from "../../components/LabelInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Dropdown } from "primereact/dropdown";
import { Formik, Form, FormikHelpers, FormikProps } from "formik";
import * as yup from "yup";
import { api } from "../../api/client";
import { getAuth } from "../../auth/session";
import { Toast } from "primereact/toast";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import { FieldLabel } from "../../components/forms/FieldLabel";
import { PageHeader } from "../../components/layout/PageHeader";
import { PackageMinus } from "lucide-react";
import { useApiQuery } from "../../hooks/useApiQuery";
import {
  formatLoteOptionLabel,
  isLoteDisponivelParaRetira,
  pickRecommendedLotId,
} from "./retiraLotes";
import "./styles.css";
import type { MedicationWithStatus, Paciente } from "../../types";

interface RetiraMedicationValues {
  name: string;
  concentration: string;
  selectedMedicationId: number | null;
  quantity: number;
  pacienteId: number | null;
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
  const [searchParams] = useSearchParams();
  const formikRef = useRef<FormikProps<RetiraMedicationValues>>(null);
  const [lots, setLots] = useState<MedicationWithStatus[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"filter" | "all" | null>(null);
  const [recommendedLotId, setRecommendedLotId] = useState<number | null>(null);
  const prefillDoneRef = useRef(false);

  const showFetchError = useCallback((message: string) => {
    toast.current?.show({
      severity: "error",
      summary: "Erro",
      detail: message,
      life: 5000,
    });
  }, []);

  const fetchPacientesList = useCallback(async () => {
    const res = await api.get<Paciente[]>("/pacientes");
    return res.data ?? [];
  }, []);

  const {
    data: pacientesOpcoes,
    loading: loadingPacientesOpcoes,
  } = useApiQuery(fetchPacientesList, [], {
    initialData: [],
    onError: (message) => showFetchError(message),
  });

  const applyLots = useCallback(
    (list: MedicationWithStatus[], setFieldValue: (field: string, value: unknown) => void) => {
      setLots(list);
      const recommended = pickRecommendedLotId(list);
      setRecommendedLotId(recommended);
      setFieldValue("selectedMedicationId", recommended);
      if (list.length > 0 && recommended == null) {
        toast.current?.show({
          severity: "warn",
          summary: "Atenção",
          detail: "Nenhum lote disponível (estoque ou validade). Verifique os lotes listados.",
          life: 5000,
        });
      }
    },
    [],
  );

  const buscarLotesPorNomeConc = useCallback(
    async (
      nome: string,
      concentracao: string,
      setFieldValue: (field: string, value: unknown) => void,
    ) => {
      setLoadingLots(true);
      setLoadingMode("filter");
      setFieldValue("selectedMedicationId", null);
      try {
        const res = await api.get<MedicationWithStatus[]>(
          "/medications/by-name-concentration",
          {
            params: {
              nome: nome.trim(),
              concentracao: concentracao.trim(),
            },
          },
        );
        const list = res.data ?? [];
        applyLots(list, setFieldValue);
        if (!list.length) {
          toast.current?.show({
            severity: "info",
            summary: "Busca",
            detail: "Nenhum lote encontrado com esse nome e concentração.",
            life: 4000,
          });
        }
      } catch (e) {
        setLots([]);
        setRecommendedLotId(null);
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
    },
    [applyLots],
  );

  useEffect(() => {
    const session = getAuth();
    if (!session) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: "Você precisa estar logado para retirar medicamentos.",
        life: 5000,
      });
    }
  }, []);

  useEffect(() => {
    if (prefillDoneRef.current) return;
    const nome = searchParams.get("nome")?.trim() ?? "";
    const concentracao = searchParams.get("concentracao")?.trim() ?? "";
    const quantidadeRaw = searchParams.get("quantidade");
    const pacienteIdRaw = searchParams.get("pacienteId");
    if (!nome && !concentracao && !quantidadeRaw && !pacienteIdRaw) return;

    const formik = formikRef.current;
    if (!formik) return;
    prefillDoneRef.current = true;

    if (nome) formik.setFieldValue("name", nome);
    if (concentracao) formik.setFieldValue("concentration", concentracao);
    const qtd = quantidadeRaw != null ? parseInt(quantidadeRaw, 10) : NaN;
    if (Number.isFinite(qtd) && qtd > 0) {
      formik.setFieldValue("quantity", qtd);
    }
    const pid = pacienteIdRaw != null ? parseInt(pacienteIdRaw, 10) : NaN;
    if (Number.isFinite(pid) && pid > 0) {
      formik.setFieldValue("pacienteId", pid);
    }
    if (nome && concentracao) {
      void buscarLotesPorNomeConc(nome, concentracao, formik.setFieldValue);
    }
  }, [searchParams, buscarLotesPorNomeConc, loadingPacientesOpcoes]);

  const handleRetireMedication = async (
    values: RetiraMedicationValues,
    { resetForm }: FormikHelpers<RetiraMedicationValues>
  ) => {
    try {
      if (!getAuth()) {
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

      const selected = lots.find((m) => m.id === medicationId);
      if (selected && !isLoteDisponivelParaRetira(selected)) {
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: "Lote indisponível (vencido ou sem estoque).",
          life: 5000,
        });
        return;
      }

      const retiradaData: Record<string, unknown> = {
        medication_id: medicationId,
        quantidade: parseInt(String(values.quantity), 10),
      };
      if (values.pacienteId != null && values.pacienteId > 0) {
        retiradaData.paciente_id = values.pacienteId;
      }

      await api.post("/retira", retiradaData, { timeout: 10000 });

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Retirada realizada com sucesso!",
        life: 3000,
      });

      resetForm();
      setLots([]);
      setRecommendedLotId(null);
      navigate("/home");
    } catch (error) {
      const err = error as AxiosErrorLike;
      console.error("❌ Erro completo:", err);

      const apiError = err.response?.data?.error;
      const severity =
        err.response?.status === 400 &&
        (apiError === "Quantidade insuficiente em estoque" ||
          apiError === "Lote fora da validade")
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
    pacienteId: yup.number().nullable(),
    quantity: yup
      .number()
      .typeError("A quantidade deve ser um número")
      .min(1, "A quantidade deve ser maior que 0")
      .integer("A quantidade deve ser um número inteiro")
      .required("A quantidade é obrigatória"),
  });

  const loteOptions = useMemo(
    () =>
      lots.map((m) => ({
        label: formatLoteOptionLabel(m, recommendedLotId),
        value: m.id,
        disabled: !isLoteDisponivelParaRetira(m),
      })),
    [lots, recommendedLotId],
  );

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-retire-medication">
        <PageHeader
          title="Retirar Medicamento"
          description="Busque o lote e informe a quantidade a retirar do estoque."
          icon={PackageMinus}
        />
        <p className="retire-medication-hint">
          Opcional: vincule a retirada a um paciente para acumular o total em mg dispensado na lista de
          pacientes (somente retiradas com paciente informado entram nesse total). Lotes vencidos não
          podem ser retirados; o lote recomendado é o que vence primeiro (FEFO).
        </p>
        <Toast ref={toast} position="top-right" />

        <Formik
          innerRef={formikRef}
          initialValues={{
            name: "",
            concentration: "",
            selectedMedicationId: null as number | null,
            quantity: 0,
            pacienteId: null as number | null,
          }}
          validationSchema={retireSchema}
          onSubmit={handleRetireMedication}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {({ isSubmitting, values, setFieldValue }) => (
            <>
              <FullScreenLoader
                active={
                  isSubmitting || loadingPacientesOpcoes || loadingLots
                }
                message={
                  isSubmitting
                    ? "Processando retirada..."
                    : "Carregando..."
                }
              />
              <Form className="retire-form">
              <div className="form-group">
                <LabelInput
                  name="name"
                  label="Nome do medicamento"
                  placeholder="Digite o nome do medicamento (ex.: Dipirona)"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <LabelInput
                  name="concentration"
                  label="Concentração"
                  placeholder="Digite a concentração do medicamento (ex.: 500mg, 250mg)"
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group retire-form-actions">
                <Button
                  type="button"
                  disabled={isSubmitting || loadingLots || !values.name.trim() || !values.concentration.trim()}
                  onClick={() =>
                    void buscarLotesPorNomeConc(
                      values.name,
                      values.concentration,
                      setFieldValue,
                    )
                  }
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
                      const res = await api.get<MedicationWithStatus[]>("/medications");
                      const list = res.data ?? [];
                      applyLots(list, setFieldValue);
                      if (!list.length) {
                        toast.current?.show({
                          severity: "info",
                          summary: "Busca",
                          detail: "Nenhum lote cadastrado.",
                          life: 4000,
                        });
                      }
                    } catch (e) {
                      setLots([]);
                      setRecommendedLotId(null);
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

              <div className="form-group">
                <label htmlFor="retira-paciente">Paciente (opcional)</label>
                <Dropdown
                  inputId="retira-paciente"
                  name="pacienteId"
                  value={values.pacienteId}
                  options={[
                    { label: "— Não vincular —", value: null },
                    ...pacientesOpcoes.map((p) => ({
                      label: `${p.nome} · Pront. ${p.prontuario}`,
                      value: p.id,
                    })),
                  ]}
                  onChange={(e) => setFieldValue("pacienteId", e.value)}
                  placeholder={
                    loadingPacientesOpcoes
                      ? "Carregando pacientes..."
                      : "Selecione o paciente"
                  }
                  className="w-full"
                  disabled={isSubmitting || loadingPacientesOpcoes}
                  filter
                  showClear
                />
              </div>

              {lots.length > 0 && (
                <div className="form-group">
                  <FieldLabel htmlFor="lot" label="Lote" required />
                  <Dropdown
                    inputId="lot"
                    name="selectedMedicationId"
                    value={values.selectedMedicationId}
                    options={loteOptions}
                    optionDisabled="disabled"
                    onChange={(e) => {
                      const nextId = e.value as number | null;
                      setFieldValue("selectedMedicationId", nextId);
                      if (
                        nextId != null &&
                        recommendedLotId != null &&
                        nextId !== recommendedLotId
                      ) {
                        toast.current?.show({
                          severity: "info",
                          summary: "FEFO",
                          detail:
                            "Você escolheu um lote diferente do recomendado (que vence primeiro).",
                          life: 4000,
                        });
                      }
                    }}
                    placeholder="Selecione o lote"
                    className="w-full"
                    disabled={isSubmitting}
                    aria-required
                  />
                </div>
              )}

              <div className="form-group">
                <LabelInput
                  name="quantity"
                  label="Quantidade"
                  placeholder="Digite a quantidade à retirar"
                  type="number"
                  disabled={isSubmitting}
                  required
                />
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
