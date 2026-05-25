import { useRef, useState, useCallback } from "react";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import Button from "../../components/ButtonSubmit";
import FullScreenLoader from "../../components/FullScreenLoader";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { formatDateBR } from "../../utils/dateUtils";
import type { MedicationWithStatus } from "../../types";
import "./styles.css";

function formatOutputDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export default function Simulador() {
  const toast = useRef<Toast>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [numeroPacientes, setNumeroPacientes] = useState<string>("");
  const [consumoDiarioPorPaciente, setConsumoDiarioPorPaciente] = useState<string>("");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<{
    dias: number;
    dataEstimada: Date;
    emFalta?: boolean;
  } | null>(null);

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

  const { data: medications, loading: loadingMedications } = useApiQuery(
    fetchMedicationsList,
    [],
    {
      initialData: [],
      onError: (message) => showFetchError(message),
    },
  );

  const selectedMedication = medications.find((m) => m.id === selectedId);

  const handleCalcular = () => {
    if (!selectedId || !selectedMedication) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Selecione um medicamento/lote.",
        life: 4000,
      });
      return;
    }
    const numPac = parseInt(numeroPacientes, 10);
    if (isNaN(numPac) || numPac < 1) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Informe o número de pacientes (mínimo 1).",
        life: 4000,
      });
      return;
    }
    const consumoPorPac = parseFloat(consumoDiarioPorPaciente.replace(",", "."));
    if (isNaN(consumoPorPac) || consumoPorPac <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Informe o consumo diário por paciente maior que zero.",
        life: 4000,
      });
      return;
    }

    const consumoTotalDia = numPac * consumoPorPac;
    setCalculating(true);
    setResult(null);
    setTimeout(() => {
      try {
        const quantidade = selectedMedication.quantidade ?? 0;
        if (quantidade <= 0) {
          setResult({ dias: 0, dataEstimada: new Date(), emFalta: true });
          setCalculating(false);
          return;
        }
        const dias = Math.floor(quantidade / consumoTotalDia);
        const dataEstimada = new Date();
        dataEstimada.setDate(dataEstimada.getDate() + dias);
        setResult({ dias, dataEstimada });
      } finally {
        setCalculating(false);
      }
    }, 300);
  };

  return (
    <div>
      <Header />
      <Menu />
      <div className="container-simulador">
        <h2>Simulador de duração de estoque</h2>
        <p>Simule em quantos dias o estoque acaba com base no número de pacientes e no consumo diário por paciente.</p>
        <Toast ref={toast} position="top-right" />

        <FullScreenLoader active={loadingMedications} message="Carregando medicamentos..." />
        {!loadingMedications && (
          <div className="simulador-form">
            <div className="form-group">
              <label htmlFor="simulador-medicamento">Medicamento / Lote</label>
              <Dropdown
                id="simulador-medicamento"
                value={selectedId}
                options={medications.map((m) => ({
                  label: `${m.nome} - Lote ${m.lote} - Validade ${formatDateBR(m.data_validade)}`,
                  value: m.id,
                }))}
                onChange={(e) => {
                  setSelectedId(e.value);
                  setResult(null);
                }}
                placeholder="Selecione o medicamento"
                className="w-full"
                disabled={calculating}
              />
            </div>

            <div className="form-group">
              <label htmlFor="simulador-numero-pacientes">Número de pacientes</label>
              <input
                id="simulador-numero-pacientes"
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 5"
                value={numeroPacientes}
                onChange={(e) => {
                  setNumeroPacientes(e.target.value);
                  setResult(null);
                }}
                disabled={calculating}
                className="form-field"
              />
            </div>

            <div className="form-group">
              <label htmlFor="simulador-consumo-por-paciente">Consumo diário por paciente</label>
              <input
                id="simulador-consumo-por-paciente"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ex: 2"
                value={consumoDiarioPorPaciente}
                onChange={(e) => {
                  setConsumoDiarioPorPaciente(e.target.value);
                  setResult(null);
                }}
                disabled={calculating}
                className="form-field"
              />
            </div>

            <Button type="button" onClick={handleCalcular} disabled={calculating} loading={calculating}>
              {calculating ? "Calculando..." : "Calcular"}
            </Button>

            {result && (
              <div className="simulador-result" role="status">
                {result.emFalta ? (
                  <p className="simulador-result--warning">Medicamento em falta.</p>
                ) : (
                  <>
                    <p>
                      Estoque acaba em aproximadamente <strong>{result.dias} dias</strong>.
                    </p>
                    <p>
                      Data estimada: <strong>{formatOutputDate(result.dataEstimada)}</strong>.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
