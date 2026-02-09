import { useRef, useEffect, useState } from "react";
import Header from "../../components/Header";
import Menu from "../../components/Menu";
import Button from "../../components/ButtonSubmit";
import FullScreenLoader from "../../components/FullScreenLoader";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import Axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import type { MedicationWithStatus } from "../../types";
import "./styles.css";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

function formatOutputDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export default function Simulador() {
  const toast = useRef<Toast>(null);
  const [medications, setMedications] = useState<MedicationWithStatus[]>([]);
  const [loadingMedications, setLoadingMedications] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [consumoPorDia, setConsumoPorDia] = useState<string>("");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<{
    dias: number;
    dataEstimada: Date;
    emFalta?: boolean;
  } | null>(null);

  useEffect(() => {
    setLoadingMedications(true);
    Axios.get<MedicationWithStatus[]>(`${API_BASE_URL}/medications`)
      .then((res) => setMedications(res.data ?? []))
      .catch((err) => {
        setMedications([]);
        toast.current?.show({
          severity: "error",
          summary: "Erro",
          detail: normalizeErrorMessage(err),
          life: 5000,
        });
      })
      .finally(() => setLoadingMedications(false));
  }, []);

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
    const consumo = parseFloat(consumoPorDia.replace(",", "."));
    if (isNaN(consumo) || consumo <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atenção",
        detail: "Informe um consumo médio por dia maior que zero.",
        life: 4000,
      });
      return;
    }

    setCalculating(true);
    setResult(null);
    // Simula pequeno delay para UX do loading (cálculo é imediato)
    setTimeout(() => {
      try {
        const quantidade = selectedMedication.quantidade ?? 0;
        if (quantidade <= 0) {
          setResult({ dias: 0, dataEstimada: new Date(), emFalta: true });
          setCalculating(false);
          return;
        }
        const dias = Math.floor(quantidade / consumo);
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
        <p>Simule em quantos dias o estoque acaba com base no consumo médio por dia.</p>
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
                  label: `${m.nome} - Lote ${m.lote} - Validade ${formatDate(m.data_validade)}`,
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
              <label htmlFor="simulador-consumo">Consumo médio por dia</label>
              <input
                id="simulador-consumo"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ex: 10"
                value={consumoPorDia}
                onChange={(e) => {
                  setConsumoPorDia(e.target.value);
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
                  <p className="simulador-result--warning">Medicação em falta.</p>
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
