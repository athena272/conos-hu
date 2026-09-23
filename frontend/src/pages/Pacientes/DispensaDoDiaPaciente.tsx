import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { api } from "../../api/client";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { formatDateBR } from "../../utils/dateUtils";
import type { MedicationWithStatus, RegimeConsumoMedicamento } from "../../types";
import { suggestDispensaQuantidade } from "./dispensaDoDia";

export interface DispensaDoDiaMedicamentoOption {
  key: string;
  label: string;
  nome: string;
  concentracao: string;
  regime_consumo: RegimeConsumoMedicamento;
  unidades_por_ciclo: string;
}

interface DispensaDoDiaPacienteProps {
  pacienteId: number;
  medicamentos: DispensaDoDiaMedicamentoOption[];
  onSuccess: (detail: string) => void;
  onError: (detail: string) => void;
}

/**
 * Registra saída de estoque do dia (POST /retira) sem alterar a programação do paciente.
 */
export function DispensaDoDiaPaciente({
  pacienteId,
  medicamentos,
  onSuccess,
  onError,
}: DispensaDoDiaPacienteProps) {
  const [medKey, setMedKey] = useState<string | null>(null);
  const [lots, setLots] = useState<MedicationWithStatus[]>([]);
  const [medicationId, setMedicationId] = useState<number | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [loadingLots, setLoadingLots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const selectedMed = useMemo(
    () => medicamentos.find((m) => m.key === medKey) ?? null,
    [medicamentos, medKey],
  );

  useEffect(() => {
    setMedKey(null);
    setLots([]);
    setMedicationId(null);
    setQuantidade("");
  }, [pacienteId]);

  useEffect(() => {
    if (!selectedMed) {
      setLots([]);
      setMedicationId(null);
      setQuantidade("");
      return;
    }
    setQuantidade(
      suggestDispensaQuantidade({
        regime_consumo: selectedMed.regime_consumo,
        unidades_por_ciclo: selectedMed.unidades_por_ciclo,
      }),
    );
    setMedicationId(null);
    let cancelled = false;
    setLoadingLots(true);
    api
      .get<MedicationWithStatus[]>("/medications/by-name-concentration", {
        params: {
          nome: selectedMed.nome,
          concentracao: selectedMed.concentracao,
        },
      })
      .then((res) => {
        if (cancelled) return;
        setLots(res.data ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLots([]);
        onErrorRef.current(normalizeErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingLots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMed]);

  const handleSubmit = () => {
    if (!medicationId) {
      onErrorRef.current("Selecione o lote para a dispensa do dia.");
      return;
    }
    const qtd = parseInt(quantidade, 10);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      onErrorRef.current("Informe uma quantidade válida para a dispensa do dia.");
      return;
    }
    setSubmitting(true);
    api
      .post("/retira", {
        medication_id: medicationId,
        quantidade: qtd,
        paciente_id: pacienteId,
      })
      .then(() => {
        onSuccessRef.current(
          "Dispensa do dia registrada. A programação do paciente não foi alterada.",
        );
        setQuantidade(
          suggestDispensaQuantidade(
            selectedMed
              ? {
                  regime_consumo: selectedMed.regime_consumo,
                  unidades_por_ciclo: selectedMed.unidades_por_ciclo,
                }
              : null,
          ),
        );
        setMedicationId(null);
        if (!selectedMed) return undefined;
        return api.get<MedicationWithStatus[]>("/medications/by-name-concentration", {
          params: {
            nome: selectedMed.nome,
            concentracao: selectedMed.concentracao,
          },
        });
      })
      .then((res) => {
        if (res) setLots(res.data ?? []);
      })
      .catch((err: unknown) => {
        onErrorRef.current(normalizeErrorMessage(err));
      })
      .finally(() => setSubmitting(false));
  };

  if (medicamentos.length === 0) {
    return (
      <div className="pacientes-dispensa-dia">
        <h4 className="pacientes-dispensa-dia-title">Dispensa do dia</h4>
        <p className="pacientes-field-hint">
          Vincule ao menos um medicamento ao paciente para registrar a saída de
          estoque de hoje.
        </p>
      </div>
    );
  }

  return (
    <div className="pacientes-dispensa-dia">
      <h4 className="pacientes-dispensa-dia-title">Dispensa do dia</h4>
      <p className="pacientes-field-hint">
        Registra a saída de estoque de hoje. Não altera a programação do paciente.
      </p>
      <div className="pacientes-dispensa-dia-fields">
        <div className="input-container">
          <label htmlFor="dispensa-medicamento" className="input-label">
            Medicamento
          </label>
          <Dropdown
            inputId="dispensa-medicamento"
            value={medKey}
            options={medicamentos.map((m) => ({
              label: m.label,
              value: m.key,
            }))}
            onChange={(e) => setMedKey(e.value ?? null)}
            placeholder="Selecione o medicamento"
            className="w-full"
            disabled={submitting}
          />
        </div>
        <div className="input-container">
          <label htmlFor="dispensa-lote" className="input-label">
            Lote
          </label>
          <Dropdown
            inputId="dispensa-lote"
            value={medicationId}
            options={lots.map((m) => ({
              label: `Lote ${m.lote} · Val. ${formatDateBR(m.data_validade)} · Qtd ${m.quantidade}`,
              value: m.id,
            }))}
            onChange={(e) => setMedicationId(e.value ?? null)}
            placeholder={
              loadingLots
                ? "Carregando lotes..."
                : selectedMed
                  ? lots.length
                    ? "Selecione o lote"
                    : "Nenhum lote encontrado"
                  : "Selecione o medicamento antes"
            }
            className="w-full"
            disabled={submitting || loadingLots || !selectedMed || lots.length === 0}
          />
        </div>
        <div className="input-container">
          <label htmlFor="dispensa-quantidade" className="input-label">
            Quantidade liberada hoje
          </label>
          <InputText
            id="dispensa-quantidade"
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-full"
            disabled={submitting}
            min={1}
          />
        </div>
        <Button
          type="button"
          label={submitting ? "Registrando..." : "Registrar dispensa"}
          icon="pi pi-box"
          onClick={handleSubmit}
          disabled={submitting || !medicationId}
        />
      </div>
    </div>
  );
}
