import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import type { RegimeConsumoMedicamento } from "../../types";
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
}

/**
 * Apoio virtual para calcular a quantidade do dia.
 * Não baixa estoque e não altera a programação — a saída física é em Medicamentos → Retirar.
 */
export function DispensaDoDiaPaciente({
  pacienteId,
  medicamentos,
}: DispensaDoDiaPacienteProps) {
  const [medKey, setMedKey] = useState<string | null>(null);

  const selectedMed = useMemo(
    () => medicamentos.find((m) => m.key === medKey) ?? null,
    [medicamentos, medKey],
  );

  const quantidadeSugerida = useMemo(
    () =>
      suggestDispensaQuantidade(
        selectedMed
          ? {
              regime_consumo: selectedMed.regime_consumo,
              unidades_por_ciclo: selectedMed.unidades_por_ciclo,
            }
          : null,
      ),
    [selectedMed],
  );

  useEffect(() => {
    setMedKey(null);
  }, [pacienteId]);

  if (medicamentos.length === 0) {
    return (
      <div className="pacientes-dispensa-dia">
        <h4 className="pacientes-dispensa-dia-title">Apoio à dispensa</h4>
        <p className="pacientes-field-hint">
          Vincule ao menos um medicamento ao paciente para ver a quantidade
          sugerida pela programação.
        </p>
      </div>
    );
  }

  return (
    <div className="pacientes-dispensa-dia">
      <h4 className="pacientes-dispensa-dia-title">Apoio à dispensa</h4>
      <p className="pacientes-field-hint">
        Cálculo virtual com base na programação do paciente. Não altera o estoque
        nem a programação. A baixa física é feita em Medicamentos → Retirar (senha
        de medicamentos).
      </p>
      <div className="pacientes-dispensa-dia-fields">
        <div className="input-container">
          <label htmlFor="dispensa-medicamento" className="input-label">
            Medicamento
          </label>
          <Dropdown
            inputId="dispensa-medicamento"
            name="dispensa-medicamento"
            value={medKey}
            options={medicamentos.map((m) => ({
              label: m.label,
              value: m.key,
            }))}
            onChange={(e) => setMedKey(e.value ?? null)}
            placeholder="Selecione o medicamento"
            className="w-full"
          />
        </div>
        {selectedMed ? (
          <p className="pacientes-dias-retorno" role="status" aria-live="polite">
            {quantidadeSugerida ? (
              <>
                <span className="pacientes-dias-retorno-valor">
                  {quantidadeSugerida} unid.
                </span>
                <span className="pacientes-dias-retorno-label">
                  {" "}
                  sugeridas pela programação (por ciclo)
                </span>
              </>
            ) : (
              <span className="pacientes-dias-retorno-label">
                Sem sugestão automática neste regime — use os dias entre liberação
                e retorno e a programação do medicamento para calcular.
              </span>
            )}
          </p>
        ) : null}
      </div>
    </div>
  );
}
