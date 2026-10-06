import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LabelInput from "../../components/LabelInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { AppDropdown } from "../../components/forms/AppDropdown";
import { Formik, Form, FormikHelpers, FormikProps } from "formik";
import * as yup from "yup";
import { api } from "../../api/client";
import { getAuth } from "../../auth/session";
import { Toast } from "primereact/toast";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import { FieldLabel } from "../../components/forms/FieldLabel";
import { buildDropdownFilterProps } from "../../components/forms/dropdownFilter";
import { PageHeader } from "../../components/layout/PageHeader";
import { PackageMinus } from "lucide-react";
import { useApiQuery } from "../../hooks/useApiQuery";
import {
  formatLoteOptionLabel,
  isLoteDisponivelParaRetira,
  medicamentoGroupKey,
  pickRecommendedLotId,
  pickRecommendedLotIdsByMedicamento,
  sortLotesParaSelecao,
} from "./retiraLotes";
import {
  adicionarItem,
  criarItemCarrinho,
  removerItem,
  toRetiraLotePayload,
  validarNovoItem,
  type RetiraCarrinhoItem,
  type RetiraCarrinhoPaciente,
} from "./retiraCarrinho";
import { formatRetiraLoteErrorMessage, resolveRetiraErrorSeverity } from "./retiraErrors";
import { RetiraCarrinhoAviso } from "./RetiraCarrinhoAviso";
import { RetiraCarrinhoList } from "./RetiraCarrinhoList";
import "./styles.css";
import type { MedicationWithStatus, Paciente } from "../../types";

interface RetiraMedicationValues {
  name: string;
  concentration: string;
  selectedMedicationId: number | null;
  quantity: number;
  pacienteId: number | null;
}

const INITIAL_VALUES: RetiraMedicationValues = {
  name: "",
  concentration: "",
  selectedMedicationId: null,
  quantity: 0,
  pacienteId: null,
};

/** A retirada em lote roda em uma única transação; precisa de mais folga que a individual. */
const RETIRA_LOTE_TIMEOUT_MS = 30000;

type SetFieldValue = (field: string, value: unknown) => void;

interface CarregarLotesOptions {
  /** Pré-seleciona o lote FEFO; só faz sentido quando a lista é de um único medicamento. */
  preSelecionar: boolean;
  /** Avisa por toast quando a lista vem vazia ou sem lote disponível. */
  notificar: boolean;
}

const LOTE_FILTER_PROPS = buildDropdownFilterProps({
  id: "retira-lote-busca",
  placeholder: "Digite o nome, lote ou validade",
});

const PACIENTE_FILTER_PROPS = buildDropdownFilterProps({
  id: "retira-paciente-busca",
  placeholder: "Digite o nome ou prontuário do paciente",
});

function formatPacienteOptionLabel(p: Pick<Paciente, "nome" | "prontuario">): string {
  return `${p.nome} · Pront. ${p.prontuario}`;
}

function toCarrinhoPaciente(
  pacienteId: number | null,
  pacientes: Paciente[],
): RetiraCarrinhoPaciente | null {
  if (pacienteId == null) return null;
  const paciente = pacientes.find((p) => p.id === pacienteId);
  return {
    id: pacienteId,
    label: paciente ? formatPacienteOptionLabel(paciente) : `Paciente #${pacienteId}`,
  };
}

function hasItemPendenteNoFormulario(values: RetiraMedicationValues): boolean {
  return (
    values.name.trim() !== "" ||
    values.selectedMedicationId != null ||
    Number(values.quantity) > 0
  );
}

function formatQuantidadeItens(n: number): string {
  return `${n} ${n === 1 ? "item" : "itens"}`;
}

function RetiraMedication() {
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formikRef = useRef<FormikProps<RetiraMedicationValues>>(null);
  const [lots, setLots] = useState<MedicationWithStatus[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"filter" | "all" | null>(null);
  const [lotsLoadFailed, setLotsLoadFailed] = useState(false);
  const [recommendedByMedicamento, setRecommendedByMedicamento] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [carrinho, setCarrinho] = useState<RetiraCarrinhoItem[]>([]);
  const [submittingCarrinho, setSubmittingCarrinho] = useState(false);
  const prefillDoneRef = useRef(false);
  const initialLotsLoadRef = useRef(false);
  /** Só a resposta da última busca de lotes é aplicada; as anteriores são descartadas. */
  const lotsRequestIdRef = useRef(0);

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
    (
      list: MedicationWithStatus[],
      setFieldValue: SetFieldValue,
      { preSelecionar, notificar }: CarregarLotesOptions,
    ) => {
      const ordenados = sortLotesParaSelecao(list);
      const recomendados = pickRecommendedLotIdsByMedicamento(ordenados);
      setLots(ordenados);
      setRecommendedByMedicamento(recomendados);
      if (preSelecionar) {
        setFieldValue("selectedMedicationId", pickRecommendedLotId(ordenados));
      }
      if (notificar && ordenados.length > 0 && recomendados.size === 0) {
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

  const carregarLotes = useCallback(
    async (
      mode: "filter" | "all",
      fetchList: () => Promise<MedicationWithStatus[]>,
      setFieldValue: SetFieldValue,
      options: CarregarLotesOptions & { mensagemListaVazia: string },
    ) => {
      const requestId = ++lotsRequestIdRef.current;
      const isLatest = () => requestId === lotsRequestIdRef.current;

      setLoadingLots(true);
      setLoadingMode(mode);
      setLotsLoadFailed(false);
      setFieldValue("selectedMedicationId", null);
      try {
        const list = await fetchList();
        if (!isLatest()) return;
        applyLots(list, setFieldValue, options);
        if (!list.length && options.notificar) {
          toast.current?.show({
            severity: "info",
            summary: "Busca",
            detail: options.mensagemListaVazia,
            life: 4000,
          });
        }
      } catch (e) {
        if (!isLatest()) return;
        setLots([]);
        setRecommendedByMedicamento(new Map());
        setLotsLoadFailed(true);
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: normalizeErrorMessage(e),
          life: 5000,
        });
      } finally {
        if (isLatest()) {
          setLoadingLots(false);
          setLoadingMode(null);
        }
      }
    },
    [applyLots],
  );

  const buscarLotesPorNomeConc = useCallback(
    (nome: string, concentracao: string, setFieldValue: SetFieldValue) =>
      carregarLotes(
        "filter",
        async () => {
          const res = await api.get<MedicationWithStatus[]>("/medications/by-name-concentration", {
            params: { nome: nome.trim(), concentracao: concentracao.trim() },
          });
          return res.data ?? [];
        },
        setFieldValue,
        {
          preSelecionar: true,
          notificar: true,
          mensagemListaVazia: "Nenhum lote encontrado com esse nome e concentração.",
        },
      ),
    [carregarLotes],
  );

  const carregarTodosLotes = useCallback(
    (setFieldValue: SetFieldValue, { notificar }: Pick<CarregarLotesOptions, "notificar">) =>
      carregarLotes(
        "all",
        async () => {
          const res = await api.get<MedicationWithStatus[]>("/medications");
          return res.data ?? [];
        },
        setFieldValue,
        { preSelecionar: false, notificar, mensagemListaVazia: "Nenhum lote cadastrado." },
      ),
    [carregarLotes],
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

  useEffect(() => {
    if (initialLotsLoadRef.current) return;
    const formik = formikRef.current;
    if (!formik) return;
    initialLotsLoadRef.current = true;

    const temBuscaPorUrl =
      Boolean(searchParams.get("nome")?.trim()) && Boolean(searchParams.get("concentracao")?.trim());
    if (temBuscaPorUrl) return;
    void carregarTodosLotes(formik.setFieldValue, { notificar: false });
  }, [searchParams, carregarTodosLotes]);

  const showNotLoggedError = () => {
    toast.current?.show({
      severity: "error",
      summary: "Erro!",
      detail: "Usuário não está logado. Faça login novamente.",
      life: 5000,
    });
  };

  const showLoteNaoSelecionadoWarning = () => {
    toast.current?.show({
      severity: "warn",
      summary: "Atenção!",
      detail:
        lots.length === 0
          ? "Clique em 'Buscar lotes' ou 'Ver todos os lotes' e selecione um lote."
          : "Selecione um lote na lista.",
      life: 5000,
    });
  };

  const clearLots = () => {
    setLots([]);
    setRecommendedByMedicamento(new Map());
  };

  const handleRetireMedication = async (
    values: RetiraMedicationValues,
    { resetForm }: FormikHelpers<RetiraMedicationValues>
  ) => {
    try {
      if (!getAuth()) {
        showNotLoggedError();
        return;
      }

      const medicationId = values.selectedMedicationId ?? null;
      if (!medicationId) {
        showLoteNaoSelecionadoWarning();
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
      clearLots();
      navigate("/home");
    } catch (error) {
      console.error("❌ Erro completo:", error);

      const severity = resolveRetiraErrorSeverity(error);
      toast.current?.show({
        severity,
        summary: severity === "warn" ? "Aviso!" : "Erro!",
        detail: normalizeErrorMessage(error),
        life: 5000,
      });
    }
  };

  const handleAdicionarAoCarrinho = async (formik: FormikProps<RetiraMedicationValues>) => {
    const errors = await formik.validateForm();
    if (errors.quantity) {
      void formik.setFieldTouched("quantity", true, false);
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: errors.quantity,
        life: 4000,
      });
      return;
    }

    const { values } = formik;
    const lot = lots.find((m) => m.id === values.selectedMedicationId);
    if (!lot) {
      showLoteNaoSelecionadoWarning();
      return;
    }

    const quantidade = parseInt(String(values.quantity), 10);
    const erro = validarNovoItem(lot, quantidade, carrinho);
    if (erro) {
      toast.current?.show({ severity: "warn", summary: "Atenção!", detail: erro, life: 5000 });
      return;
    }

    const paciente = toCarrinhoPaciente(values.pacienteId, pacientesOpcoes);
    setCarrinho((prev) => adicionarItem(prev, criarItemCarrinho(lot, quantidade, paciente)));
    formik.resetForm({ values: { ...INITIAL_VALUES, pacienteId: values.pacienteId } });
    void carregarTodosLotes(formik.setFieldValue, { notificar: false });
    toast.current?.show({
      severity: "success",
      summary: "Lista",
      detail: `${lot.nome} (Lote ${lot.lote}) adicionado à lista.`,
      life: 2500,
    });
  };

  const handleRetirarCarrinho = async () => {
    if (carrinho.length === 0 || submittingCarrinho) return;
    if (!getAuth()) {
      showNotLoggedError();
      return;
    }

    setSubmittingCarrinho(true);
    try {
      await api.post("/retira/lote", toRetiraLotePayload(carrinho), {
        timeout: RETIRA_LOTE_TIMEOUT_MS,
      });

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: `Retirada de ${formatQuantidadeItens(carrinho.length)} realizada com sucesso!`,
        life: 3000,
      });

      setCarrinho([]);
      formikRef.current?.resetForm({ values: INITIAL_VALUES });
      clearLots();
      navigate("/home");
    } catch (error) {
      console.error("❌ Erro na retirada em lote:", error);

      const severity = resolveRetiraErrorSeverity(error);
      toast.current?.show({
        severity,
        summary: severity === "warn" ? "Aviso!" : "Erro!",
        detail: formatRetiraLoteErrorMessage(error, carrinho),
        life: 6000,
      });
    } finally {
      setSubmittingCarrinho(false);
    }
  };

  /** Com itens na lista, Enter no formulário não pode disparar uma retirada individual por engano. */
  const handleSubmit = async (
    values: RetiraMedicationValues,
    helpers: FormikHelpers<RetiraMedicationValues>,
  ) => {
    if (carrinho.length > 0) {
      toast.current?.show({
        severity: "info",
        summary: "Lista de retirada",
        detail:
          "Use 'Adicionar à lista' para incluir este item ou 'Retirar itens da lista' para concluir.",
        life: 5000,
      });
      return;
    }
    await handleRetireMedication(values, helpers);
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

  const recomendadoDoMedicamento = useCallback(
    (lot: MedicationWithStatus): number | undefined =>
      recommendedByMedicamento.get(medicamentoGroupKey(lot)),
    [recommendedByMedicamento],
  );

  const loteOptions = useMemo(
    () =>
      lots.map((m) => ({
        label: formatLoteOptionLabel(m, recomendadoDoMedicamento(m) === m.id),
        value: m.id,
        disabled: !isLoteDisponivelParaRetira(m),
      })),
    [lots, recomendadoDoMedicamento],
  );

  const lotePlaceholder = loadingLots
    ? "Carregando lotes..."
    : lotsLoadFailed
      ? "Não foi possível carregar os lotes"
      : lots.length === 0
        ? "Nenhum lote disponível"
        : "Selecione o lote";

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
        <p className="retire-medication-hint">
          Vários medicamentos no mesmo pedido? Use &quot;Adicionar à lista&quot; em cada item e depois
          &quot;Retirar itens da lista&quot;: a retirada é feita de uma vez, e se algum item tiver
          problema nada é baixado.
        </p>
        <Toast ref={toast} position="top-right" />

        <Formik
          innerRef={formikRef}
          initialValues={INITIAL_VALUES}
          validationSchema={retireSchema}
          onSubmit={handleSubmit}
          validateOnChange={true}
          validateOnBlur={true}
        >
          {(formik) => {
            const { isSubmitting, values, setFieldValue } = formik;
            const busy = isSubmitting || submittingCarrinho;
            return (
            <>
              <FullScreenLoader
                active={
                  busy || loadingPacientesOpcoes || loadingLots
                }
                message={
                  submittingCarrinho
                    ? `Processando retirada de ${formatQuantidadeItens(carrinho.length)}...`
                    : isSubmitting
                      ? "Processando retirada..."
                      : loadingLots
                        ? "Carregando lotes..."
                        : "Carregando..."
                }
              />
              <Form className="retire-form">
              <div className="form-group">
                <LabelInput
                  name="name"
                  label="Nome do medicamento"
                  placeholder="Digite o nome do medicamento (ex.: Dipirona)"
                  disabled={busy}
                />
              </div>

              <div className="form-group">
                <LabelInput
                  name="concentration"
                  label="Concentração"
                  placeholder="Digite a concentração do medicamento (ex.: 500mg, 250mg)"
                  disabled={busy}
                />
              </div>

              <div className="form-group retire-form-actions">
                <Button
                  type="button"
                  disabled={busy || loadingLots || !values.name.trim() || !values.concentration.trim()}
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
                  disabled={busy || loadingLots}
                  onClick={() => void carregarTodosLotes(setFieldValue, { notificar: true })}
                >
                  {loadingLots && loadingMode === "all" ? "Carregando..." : "Ver todos os lotes"}
                </Button>
              </div>

              <div className="form-group">
                <label htmlFor="retira-paciente">Paciente (opcional)</label>
                <AppDropdown
                  inputId="retira-paciente"
                  name="pacienteId"
                  value={values.pacienteId}
                  options={[
                    { label: "— Não vincular —", value: null },
                    ...pacientesOpcoes.map((p) => ({
                      label: formatPacienteOptionLabel(p),
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
                  disabled={busy || loadingPacientesOpcoes}
                  {...PACIENTE_FILTER_PROPS}
                  emptyFilterMessage="Nenhum paciente encontrado"
                  showClear
                />
              </div>

              <div className="form-group">
                <FieldLabel htmlFor="lot" label="Lote" required />
                <AppDropdown
                  inputId="lot"
                  name="selectedMedicationId"
                  value={values.selectedMedicationId}
                  options={loteOptions}
                  optionDisabled="disabled"
                  onChange={(e) => {
                    const nextId = e.value as number | null;
                    setFieldValue("selectedMedicationId", nextId);
                    const selected = lots.find((m) => m.id === nextId);
                    const recomendado = selected ? recomendadoDoMedicamento(selected) : undefined;
                    if (nextId != null && recomendado != null && nextId !== recomendado) {
                      toast.current?.show({
                        severity: "info",
                        summary: "FEFO",
                        detail:
                          "Você escolheu um lote diferente do recomendado (que vence primeiro).",
                        life: 4000,
                      });
                    }
                  }}
                  placeholder={lotePlaceholder}
                  className="w-full"
                  disabled={busy || loadingLots || lots.length === 0}
                  {...LOTE_FILTER_PROPS}
                  emptyMessage="Nenhum lote cadastrado"
                  emptyFilterMessage="Nenhum lote encontrado"
                  aria-required
                />
              </div>

              <div className="form-group">
                <LabelInput
                  name="quantity"
                  label="Quantidade"
                  placeholder="Digite a quantidade à retirar"
                  type="number"
                  disabled={busy}
                  required
                />
              </div>

              <div className="form-group retire-form-actions">
                <Button
                  type="button"
                  className="p-button-outlined"
                  disabled={busy || loadingLots}
                  onClick={() => void handleAdicionarAoCarrinho(formik)}
                >
                  Adicionar à lista
                </Button>
                {carrinho.length === 0 ? (
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Processando..." : "Retirar"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRetirarCarrinho()}
                  >
                    {submittingCarrinho
                      ? "Processando..."
                      : `Retirar ${formatQuantidadeItens(carrinho.length)} da lista`}
                  </Button>
                )}
              </div>
            </Form>

              {carrinho.length > 0 && (
                <>
                  <RetiraCarrinhoAviso temItemPendente={hasItemPendenteNoFormulario(values)} />
                  <RetiraCarrinhoList
                    itens={carrinho}
                    disabled={busy}
                    onRemove={(key) => setCarrinho((prev) => removerItem(prev, key))}
                    onClear={() => setCarrinho([])}
                  />
                </>
              )}
            </>
            );
          }}
        </Formik>
      </div>
    </div>
  );
}

export default RetiraMedication;
