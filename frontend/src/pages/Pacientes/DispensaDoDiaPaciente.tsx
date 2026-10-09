import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { AppDropdown } from "../../components/forms/AppDropdown";
import { sessionCanWithdrawMedications } from "../../auth/session";
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
  pacienteNome?: string;
  medicamentos: DispensaDoDiaMedicamentoOption[];
}

/**
 * Apoio virtual para calcular a quantidade do dia.
 * Não baixa estoque. Quem tem permissão de retirada pode abrir a tela Retira pré-preenchida.
 */
export function DispensaDoDiaPaciente({
  pacienteId,
  pacienteNome,
  medicamentos,
}: DispensaDoDiaPacienteProps) {
  const navigate = useNavigate();
  const canWithdraw = sessionCanWithdrawMedications();
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

  const resumoTexto = useMemo(() => {
    if (!selectedMed) return "";
    const partes = [
      pacienteNome?.trim()
        ? `Paciente: ${pacienteNome.trim()} (id ${pacienteId})`
        : `Paciente id: ${pacienteId}`,
      `Medicamento: ${selectedMed.nome} - ${selectedMed.concentracao}`,
    ];
    if (quantidadeSugerida) {
      partes.push(`Quantidade sugerida: ${quantidadeSugerida}`);
    }
    return partes.join("\n");
  }, [selectedMed, pacienteId, pacienteNome, quantidadeSugerida]);

  const openRetira = () => {
    if (!selectedMed || !canWithdraw) return;
    const params = new URLSearchParams({
      pacienteId: String(pacienteId),
      nome: selectedMed.nome,
      concentracao: selectedMed.concentracao,
    });
    if (quantidadeSugerida) {
      params.set("quantidade", quantidadeSugerida);
    }
    navigate(`/retira-medication?${params.toString()}`);
  };

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
        Cálculo virtual com base na programação. Não altera o estoque nem a
        programação.
      </p>
      {!canWithdraw ? (
        <p className="pacientes-field-hint">
          Quem faz a baixa física: usuário com acesso a{" "}
          <strong>Medicamentos → Retirar</strong> (senha de medicamentos). Use o
          resumo abaixo para passar os dados.
        </p>
      ) : (
        <p className="pacientes-field-hint">
          Com sua permissão, você pode abrir a Retira já com paciente,
          medicamento e quantidade sugerida.
        </p>
      )}
      <div className="pacientes-dispensa-dia-fields">
        <div className="input-container">
          <label htmlFor="dispensa-medicamento" className="input-label">
            Medicamento
          </label>
          <AppDropdown
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
          <>
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
                  Sem sugestão automática neste regime — use os dias entre
                  liberação e retorno e a programação do medicamento para
                  calcular.
                </span>
              )}
            </p>
            {!canWithdraw && resumoTexto ? (
              <pre className="pacientes-dispensa-resumo">{resumoTexto}</pre>
            ) : null}
            {canWithdraw ? (
              <Button
                type="button"
                label="Abrir Retira"
                icon="pi pi-external-link"
                onClick={openRetira}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
