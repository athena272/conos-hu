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
import { Button as PrimeButton } from "primereact/button";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import { FieldLabel } from "../../components/forms/FieldLabel";
import { buildDropdownFilterProps } from "../../components/forms/dropdownFilter";
import { PageHeader } from "../../components/layout/PageHeader";
import { PackageMinus } from "lucide-react";
import { useApiQuery } from "../../hooks/useApiQuery";
import {
  formatLoteOptionLabel,
  formatMedicamentoNome,
  isLoteDisponivelParaRetira,
  medicamentoGroupKey,
  pickRecommendedLotId,
  pickRecommendedLotIdsByMedicamento,
  sortLotesParaSelecao,
} from "./retiraLotes";
import {
  adicionarItem,
  atualizarItem,
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
import { RetiraEdicaoAviso } from "./RetiraEdicaoAviso";
import "./styles.css";
import type { MedicationWithStatus, Paciente } from "../../types";

interface RetiraMedicationValues {
  selectedMedicationId: number | null;
  quantity: number;
  pacienteId: number | null;
}

/** Medicamento recebido pela URL (ex.: dispensa do dia do paciente); restringe o select a ele. */
interface FiltroLotes {
  nome: string;
  concentracao: string;
}

const INITIAL_VALUES: RetiraMedicationValues = {
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
  placeholder: "Digite o nome, concentração, lote ou validade",
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
  return values.selectedMedicationId != null || Number(values.quantity) > 0;
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
  const [lotsLoadFailed, setLotsLoadFailed] = useState(false);
  const [filtroLotes, setFiltroLotes] = useState<FiltroLotes | null>(null);
  const [recommendedByMedicamento, setRecommendedByMedicamento] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [carrinho, setCarrinho] = useState<RetiraCarrinhoItem[]>([]);
  const [submittingCarrinho, setSubmittingCarrinho] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  /** Valores do formulário antes de entrar na edição, restaurados ao cancelar. */
  const valoresAntesDaEdicaoRef = useRef<RetiraMedicationValues | null>(null);
  const itemEmEdicao = carrinho.find((i) => i.key === editingKey) ?? null;
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
      fetchList: () => Promise<MedicationWithStatus[]>,
      setFieldValue: SetFieldValue,
      options: CarregarLotesOptions & { mensagemListaVazia: string },
    ): Promise<MedicationWithStatus[] | null> => {
      const requestId = ++lotsRequestIdRef.current;
      const isLatest = () => requestId === lotsRequestIdRef.current;

      setLoadingLots(true);
      setLotsLoadFailed(false);
      setFieldValue("selectedMedicationId", null);
      try {
        const list = await fetchList();
        if (!isLatest()) return null;
        applyLots(list, setFieldValue, options);
        if (!list.length && options.notificar) {
          toast.current?.show({
            severity: "info",
            summary: "Busca",
            detail: options.mensagemListaVazia,
            life: 4000,
          });
        }
        return list;
      } catch (e) {
        if (!isLatest()) return null;
        setLots([]);
        setRecommendedByMedicamento(new Map());
        setLotsLoadFailed(true);
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: normalizeErrorMessage(e),
          life: 5000,
        });
        return null;
      } finally {
        if (isLatest()) {
          setLoadingLots(false);
        }
      }
    },
    [applyLots],
  );

  const buscarLotesPorNomeConc = useCallback(
    (nome: string, concentracao: string, setFieldValue: SetFieldValue) => {
      setFiltroLotes({ nome, concentracao });
      return carregarLotes(
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
      );
    },
    [carregarLotes],
  );

  const carregarTodosLotes = useCallback(
    (setFieldValue: SetFieldValue, { notificar }: Pick<CarregarLotesOptions, "notificar">) => {
      setFiltroLotes(null);
      return carregarLotes(
        async () => {
          const res = await api.get<MedicationWithStatus[]>("/medications");
          return res.data ?? [];
        },
        setFieldValue,
        { preSelecionar: false, notificar, mensagemListaVazia: "Nenhum lote cadastrado." },
      );
    },
    [carregarLotes],
  );

  const recarregarLotes = (setFieldValue: SetFieldValue) =>
    filtroLotes
      ? buscarLotesPorNomeConc(filtroLotes.nome, filtroLotes.concentracao, setFieldValue)
      : carregarTodosLotes(setFieldValue, { notificar: true });

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
      detail: lotsLoadFailed
        ? "Não foi possível carregar os lotes. Clique em 'Tentar novamente'."
        : lots.length === 0
          ? "Nenhum lote disponível para retirada."
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

  /**
   * Valida o formulário contra o estoque e devolve o item pronto para a lista,
   * ou `null` depois de avisar o motivo. `itensReservados` é o que já ocupa estoque na lista.
   */
  const montarItemDoFormulario = async (
    formik: FormikProps<RetiraMedicationValues>,
    itensReservados: RetiraCarrinhoItem[],
  ): Promise<RetiraCarrinhoItem | null> => {
    const errors = await formik.validateForm();
    if (errors.quantity) {
      void formik.setFieldTouched("quantity", true, false);
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: errors.quantity,
        life: 4000,
      });
      return null;
    }

    const { values } = formik;
    const lot = lots.find((m) => m.id === values.selectedMedicationId);
    if (!lot) {
      showLoteNaoSelecionadoWarning();
      return null;
    }

    const quantidade = parseInt(String(values.quantity), 10);
    const erro = validarNovoItem(lot, quantidade, itensReservados);
    if (erro) {
      toast.current?.show({ severity: "warn", summary: "Atenção!", detail: erro, life: 5000 });
      return null;
    }

    const paciente = toCarrinhoPaciente(values.pacienteId, pacientesOpcoes);
    return criarItemCarrinho(lot, quantidade, paciente);
  };

  const prepararFormularioParaProximoItem = (
    formik: FormikProps<RetiraMedicationValues>,
    pacienteId: number | null,
  ) => {
    formik.resetForm({ values: { ...INITIAL_VALUES, pacienteId } });
    void carregarTodosLotes(formik.setFieldValue, { notificar: false });
  };

  const handleAdicionarAoCarrinho = async (formik: FormikProps<RetiraMedicationValues>) => {
    const item = await montarItemDoFormulario(formik, carrinho);
    if (!item) return;

    setCarrinho((prev) => adicionarItem(prev, item));
    prepararFormularioParaProximoItem(formik, item.pacienteId);
    toast.current?.show({
      severity: "success",
      summary: "Lista",
      detail: `${formatMedicamentoNome(item)} (Lote ${item.lote}) adicionado à lista.`,
      life: 2500,
    });
  };

  const encerrarEdicao = () => {
    setEditingKey(null);
    valoresAntesDaEdicaoRef.current = null;
  };

  const handleEditarItem = async (
    formik: FormikProps<RetiraMedicationValues>,
    item: RetiraCarrinhoItem,
  ) => {
    if (editingKey == null) {
      valoresAntesDaEdicaoRef.current = formik.values;
    }
    setEditingKey(item.key);
    document
      .getElementById("retire-secao-item-titulo")
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });

    let lotesDisponiveis: MedicationWithStatus[] | null = lots;
    if (!lots.some((m) => m.id === item.medicationId)) {
      lotesDisponiveis = await carregarTodosLotes(formik.setFieldValue, { notificar: false });
    }
    const loteDisponivel = lotesDisponiveis?.some((m) => m.id === item.medicationId) ?? false;

    await formik.setValues({
      selectedMedicationId: loteDisponivel ? item.medicationId : null,
      pacienteId: item.pacienteId,
      quantity: item.quantidade,
    });

    // Sem `lotesDisponiveis` a falha de carregamento já foi avisada pelo toast de erro.
    if (lotesDisponiveis && !loteDisponivel) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção!",
        detail: `O lote ${item.lote} não está mais disponível. Escolha outro lote para este item.`,
        life: 6000,
      });
    }
  };

  const handleSalvarEdicao = async (formik: FormikProps<RetiraMedicationValues>) => {
    if (editingKey == null) return;
    const keyOriginal = editingKey;

    const item = await montarItemDoFormulario(formik, removerItem(carrinho, keyOriginal));
    if (!item) return;

    setCarrinho((prev) => atualizarItem(prev, keyOriginal, item));
    encerrarEdicao();
    prepararFormularioParaProximoItem(formik, item.pacienteId);
    toast.current?.show({
      severity: "success",
      summary: "Lista",
      detail: `${formatMedicamentoNome(item)} (Lote ${item.lote}) atualizado na lista.`,
      life: 2500,
    });
  };

  const handleCancelarEdicao = (formik: FormikProps<RetiraMedicationValues>) => {
    const anteriores = valoresAntesDaEdicaoRef.current ?? INITIAL_VALUES;
    const loteAnteriorNoSelect = lots.some((m) => m.id === anteriores.selectedMedicationId);
    encerrarEdicao();
    formik.resetForm({
      values: {
        ...anteriores,
        selectedMedicationId: loteAnteriorNoSelect ? anteriores.selectedMedicationId : null,
      },
    });
  };

  const handleRemoverItem = (formik: FormikProps<RetiraMedicationValues>, key: string) => {
    if (key === editingKey) {
      handleCancelarEdicao(formik);
    }
    setCarrinho((prev) => removerItem(prev, key));
  };

  const handleRetirarCarrinho = async () => {
    if (carrinho.length === 0 || submittingCarrinho || editingKey != null) return;
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
    if (editingKey != null) {
      toast.current?.show({
        severity: "info",
        summary: "Edição em andamento",
        detail: "Use 'Salvar alteração' ou 'Cancelar edição' para concluir a edição do item.",
        life: 5000,
      });
      return;
    }
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
          description="Selecione o lote e informe a quantidade a retirar do estoque."
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
              <section className="retire-secao" aria-labelledby="retire-secao-item-titulo">
              <header className="retire-secao-header">
                <h2 id="retire-secao-item-titulo" className="retire-secao-titulo">
                  Item da retirada
                </h2>
                <p className="retire-secao-descricao">
                  Escolha o lote, vincule um paciente se quiser e informe a quantidade.
                </p>
              </header>
              {itemEmEdicao && (
                <RetiraEdicaoAviso
                  item={itemEmEdicao}
                  disabled={busy}
                  onCancelar={() => handleCancelarEdicao(formik)}
                />
              )}

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
                {filtroLotes && !loadingLots && !lotsLoadFailed && (
                  <div className="retire-lotes-aviso" aria-live="polite">
                    <span>
                      Mostrando apenas os lotes de{" "}
                      <strong>
                        {filtroLotes.nome} {filtroLotes.concentracao}
                      </strong>
                      .
                    </span>
                    <PrimeButton
                      type="button"
                      label="Ver todos os lotes"
                      className="p-button-link p-button-sm"
                      disabled={busy}
                      onClick={() => void carregarTodosLotes(setFieldValue, { notificar: true })}
                    />
                  </div>
                )}
                {lotsLoadFailed && !loadingLots && (
                  <div className="retire-lotes-aviso retire-lotes-aviso--erro" role="alert">
                    <span>Não foi possível carregar os lotes.</span>
                    <PrimeButton
                      type="button"
                      label="Tentar novamente"
                      icon="pi pi-refresh"
                      className="p-button-link p-button-sm"
                      disabled={busy}
                      onClick={() => void recarregarLotes(setFieldValue)}
                    />
                  </div>
                )}
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
                {editingKey != null ? (
                  <>
                    <Button
                      type="button"
                      disabled={busy || loadingLots}
                      onClick={() => void handleSalvarEdicao(formik)}
                    >
                      Salvar alteração
                    </Button>
                    <Button
                      type="button"
                      className="p-button-outlined"
                      disabled={busy}
                      onClick={() => handleCancelarEdicao(formik)}
                    >
                      Cancelar edição
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="p-button-outlined"
                    disabled={busy || loadingLots}
                    onClick={() => void handleAdicionarAoCarrinho(formik)}
                  >
                    Adicionar à lista
                  </Button>
                )}
                {carrinho.length === 0 ? (
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Processando..." : "Retirar"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={busy || editingKey != null}
                    title={
                      editingKey != null
                        ? "Conclua ou cancele a edição do item antes de retirar"
                        : undefined
                    }
                    onClick={() => void handleRetirarCarrinho()}
                  >
                    {submittingCarrinho
                      ? "Processando..."
                      : `Retirar ${formatQuantidadeItens(carrinho.length)} da lista`}
                  </Button>
                )}
              </div>
              </section>
            </Form>

              <section className="retire-secao" aria-labelledby="retire-secao-lista-titulo">
                <header className="retire-secao-header">
                  <h2 id="retire-secao-lista-titulo" className="retire-secao-titulo">
                    Lista de retirada
                  </h2>
                  <p className="retire-secao-descricao">
                    Vários medicamentos no mesmo pedido? Use &quot;Adicionar à lista&quot; em cada
                    item e retire todos de uma vez: se algum item tiver problema, nada é baixado.
                  </p>
                </header>
                {carrinho.length === 0 ? (
                  <p className="retire-secao-vazia">
                    Nenhum item na lista. Para um único medicamento, basta clicar em
                    &quot;Retirar&quot;.
                  </p>
                ) : (
                  <>
                    <RetiraCarrinhoAviso
                      temItemPendente={editingKey == null && hasItemPendenteNoFormulario(values)}
                    />
                    <RetiraCarrinhoList
                      itens={carrinho}
                      disabled={busy}
                      editingKey={editingKey}
                      onEdit={(item) => void handleEditarItem(formik, item)}
                      onRemove={(key) => handleRemoverItem(formik, key)}
                      onClear={() => setCarrinho([])}
                    />
                  </>
                )}
              </section>
            </>
            );
          }}
        </Formik>
      </div>
    </div>
  );
}

export default RetiraMedication;
