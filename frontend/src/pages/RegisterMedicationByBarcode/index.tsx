import { useRef, useEffect, useState } from "react";
import LabelInput from "../../components/LabelInput";
import DropdownInput, { DropdownOption } from "../../components/DropdownInput";
import Button from "../../components/ButtonSubmit";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import { Dropdown } from "primereact/dropdown";
import { Button as PrimeButton } from "primereact/button";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import { Toast } from "primereact/toast";
import { api } from "../../api/client";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR } from "../../utils/dateUtils";
import FullScreenLoader from "../../components/FullScreenLoader";
import "./styles.css";
import type { MedicationWithStatus } from "../../types";

type EntryType = "new" | "existing";
type CaptureMode = "usb" | "type";

interface ResolveScanResponse {
  source: "gs1" | "catalog" | "gtin_only" | "empty";
  gtin?: string;
  lote?: string;
  data_validade?: string;
  nome?: string;
  concentracao?: string;
  forma?: string;
  classificacao?: string;
}

interface RegisterBarcodeValues {
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

const pharmaceuticalForms: DropdownOption[] = [
  { name: "Comprimido", code: 1 },
  { name: "Injetável", code: 2 },
  { name: "Gotas", code: 3 },
  { name: "Outros", code: 4 },
];

function mapFormaToOption(forma: string | undefined): DropdownOption | null {
  if (forma == null || forma === "") return null;
  const code = parseInt(forma, 10);
  if (isNaN(code)) return null;
  return pharmaceuticalForms.find((f) => f.code === code) ?? null;
}

function RegisterMedicationByBarcode() {
  const toast = useRef<Toast>(null);
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastResolve, setLastResolve] = useState<ResolveScanResponse | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<MedicationWithStatus[]>("/medications")
      .then((res) => setMedications(res.data ?? []))
      .catch(() => setMedications([]));
  }, []);

  useEffect(() => {
    if (captureMode === "usb") {
      const t = window.setTimeout(() => scanInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [captureMode]);

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

  /** Preenche só o que a API devolve (GS1 completo ou match no catálogo). GTIN sozinho não traz nome/lote. */
  const applyResolveToForm = (
    data: ResolveScanResponse,
    setFieldValue: (f: string, v: unknown) => void
  ) => {
    if (data.nome) setFieldValue("name", data.nome);
    if (data.lote) setFieldValue("batch", data.lote);
    if (data.concentracao) setFieldValue("concentration", data.concentracao);
    if (data.classificacao) setFieldValue("classification", data.classificacao);
    if (data.data_validade) setFieldValue("expiryDate", data.data_validade);
    const formaOpt = mapFormaToOption(data.forma);
    if (formaOpt) setFieldValue("pharmaceuticalForm", formaOpt);
  };

  const countResolvedFields = (data: ResolveScanResponse): number => {
    let n = 0;
    if (data.nome) n++;
    if (data.lote) n++;
    if (data.concentracao) n++;
    if (data.classificacao) n++;
    if (data.data_validade) n++;
    if (mapFormaToOption(data.forma)) n++;
    return n;
  };

  const runResolveScan = async (
    raw: string,
    setFieldValue: (f: string, v: unknown) => void
  ) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Informe ou escaneie o código antes de continuar.",
        life: 3000,
      });
      return;
    }
    try {
      const res = await api.post<ResolveScanResponse>("/medications/resolve-scan", {
        raw: trimmed,
      });
      const data = res.data;
      setLastResolve(data);
      applyResolveToForm(data, setFieldValue);
      const filled = countResolvedFields(data);

      if (data.source === "empty") {
        toast.current?.show({
          severity: "info",
          summary: "Leitura",
          detail:
            "Não foi possível extrair dados do código. Preencha os campos manualmente.",
          life: 5000,
        });
      } else if (data.source === "gtin_only") {
        toast.current?.show({
          severity: "info",
          summary: "Só o código GTIN",
          detail:
            "O código identifica apenas o GTIN (sem GS1 com lote/validade e sem registro no catálogo interno). Preencha nome, lote, quantidade e demais campos manualmente.",
          life: 7000,
        });
      } else if (filled === 0) {
        toast.current?.show({
          severity: "info",
          summary: "Leitura",
          detail: "Nenhum campo automático disponível para este código. Complete o formulário manualmente.",
          life: 5000,
        });
      } else {
        toast.current?.show({
          severity: "success",
          summary: "Leitura aplicada",
          detail:
            filled >= 4
              ? "Vários campos foram preenchidos. Confira e complete o que faltar."
              : "Alguns campos foram preenchidos. Complete o restante manualmente.",
          life: 4000,
        });
      }
    } catch (e: unknown) {
      toast.current?.show({
        severity: "error",
        summary: "Erro",
        detail: normalizeErrorMessage(e),
        life: 4000,
      });
    }
  };

  const handleRegisterMedication = (
    values: RegisterBarcodeValues,
    { resetForm, setSubmitting }: FormikHelpers<RegisterBarcodeValues>
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
          setCaptureMode(null);
          setScanBuffer("");
          setLastResolve(null);
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
        setCaptureMode(null);
        setScanBuffer("");
        setLastResolve(null);
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
      <div className="container-register-barcode">
        <h2>Registrar medicamento (código de barras)</h2>
        <p>
          Use um leitor USB ou digite o código. Os campos são preenchidos automaticamente quando
          possível; complete o restante manualmente.
        </p>
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
                message={
                  values.entryType === "existing" ? "Adicionando quantidade..." : "Salvando..."
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
                      setFieldValue("existingMedicationId", null);
                      if (e.value === "existing") {
                        setCaptureMode(null);
                        setScanBuffer("");
                        setLastResolve(null);
                      }
                    }}
                    placeholder="Selecione"
                    className="w-full"
                  />
                </div>

                {values.entryType === "new" && (
                  <div className="scan-section">
                    <label style={{ fontWeight: 600 }}>Leitura do código</label>
                    {!captureMode ? (
                      <div className="scan-mode-buttons">
                        <PrimeButton
                          type="button"
                          label="Escanear com leitor USB"
                          icon="pi pi-qrcode"
                          onClick={() => {
                            setCaptureMode("usb");
                            setScanBuffer("");
                          }}
                        />
                        <PrimeButton
                          type="button"
                          label="Digitar código de barras"
                          icon="pi pi-keyboard"
                          className="p-button-outlined"
                          onClick={() => {
                            setCaptureMode("type");
                            setScanBuffer("");
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="helper-text">
                          {captureMode === "usb"
                            ? "Clique no campo abaixo e escaneie com o leitor (geralmente envia Enter ao final)."
                            : "Digite o código e pressione Enter ou clique em Aplicar leitura."}
                        </p>
                        <div className="scan-input-wrap">
                          <input
                            ref={scanInputRef}
                            type="text"
                            value={scanBuffer}
                            onChange={(e) => setScanBuffer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void runResolveScan(scanBuffer, setFieldValue);
                              }
                            }}
                            className="p-inputtext p-component w-full"
                            style={{ width: "100%", boxSizing: "border-box" }}
                            placeholder={
                              captureMode === "usb"
                                ? "Foco aqui e escaneie…"
                                : "Digite o código…"
                            }
                            autoFocus={captureMode === "type"}
                            autoComplete="off"
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            marginTop: "0.75rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <PrimeButton
                            type="button"
                            label="Aplicar leitura"
                            icon="pi pi-check"
                            onClick={() => void runResolveScan(scanBuffer, setFieldValue)}
                          />
                          <PrimeButton
                            type="button"
                            label="Trocar modo"
                            className="p-button-text"
                            onClick={() => {
                              setCaptureMode(null);
                              setScanBuffer("");
                              setLastResolve(null);
                            }}
                          />
                        </div>
                        {lastResolve?.gtin && (
                          <p className="helper-text" style={{ marginTop: "0.75rem" }}>
                            GTIN reconhecido: <strong>{lastResolve.gtin}</strong> (origem:{" "}
                            {lastResolve.source}
                            {lastResolve.source === "gtin_only"
                              ? " — não há dados automáticos de nome/lote; preencha abaixo ou cadastre o produto na coleção de catálogo no sistema."
                              : ""}
                            )
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

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
                        placeholder="Selecione o medicamento"
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

export default RegisterMedicationByBarcode;
