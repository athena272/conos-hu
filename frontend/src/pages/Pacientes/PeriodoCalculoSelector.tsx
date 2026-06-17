import { useEffect, useState, type ReactNode } from "react";
import { SelectButton } from "primereact/selectbutton";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";

const PERIODO_PRESETS_DIAS = [7, 14, 21, 28, 30];
const PERIODO_PADRAO_DIAS = 30;

/**
 * Seletor de "Período de cálculo (dias)" reutilizado no resumo de Pacientes e
 * no diálogo de auditoria. Presets aplicam na hora; valor personalizado é
 * aplicado via botão "Aplicar" ou tecla Enter (evita recalcular a cada dígito).
 *
 * `idPrefix` garante ids únicos quando há mais de um seletor na tela.
 */
export function PeriodoCalculoSelector({
  diasPeriodo,
  onChange,
  idPrefix,
  nota,
}: {
  diasPeriodo: number;
  onChange: (dias: number) => void;
  idPrefix: string;
  nota?: ReactNode;
}) {
  const [inputValue, setInputValue] = useState<number | null>(diasPeriodo);

  // Sincroniza o campo quando o valor aplicado muda por fora (ex.: presets).
  useEffect(() => {
    setInputValue(diasPeriodo);
  }, [diasPeriodo]);

  const podeAplicar =
    inputValue != null && inputValue > 0 && inputValue !== diasPeriodo;

  const aplicarPersonalizado = () => {
    if (podeAplicar) onChange(inputValue as number);
  };

  const labelId = `${idPrefix}-label`;
  const presetSelecionado = PERIODO_PRESETS_DIAS.includes(diasPeriodo)
    ? diasPeriodo
    : null;

  return (
    <div className="pacientes-periodo-selector">
      <span className="pacientes-periodo-label" id={labelId}>
        Período de cálculo (dias):
      </span>
      <SelectButton
        value={presetSelecionado}
        onChange={(e) => {
          if (e.value != null) onChange(e.value);
        }}
        options={PERIODO_PRESETS_DIAS.map((d) => ({
          label: String(d),
          value: d,
        }))}
        aria-labelledby={labelId}
      />
      <InputNumber
        inputId={`${idPrefix}-dias`}
        name={`${idPrefix}-dias`}
        value={inputValue}
        onChange={(e) => setInputValue(e.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            aplicarPersonalizado();
          }
        }}
        min={1}
        max={365}
        showButtons
        inputStyle={{ width: "4.5rem" }}
        aria-label="Período personalizado em dias"
      />
      <Button
        type="button"
        label="Aplicar"
        icon="pi pi-check"
        className="p-button-sm p-button-outlined"
        onClick={aplicarPersonalizado}
        disabled={!podeAplicar}
        aria-label="Aplicar período personalizado"
      />
      {nota}
    </div>
  );
}

export { PERIODO_PRESETS_DIAS, PERIODO_PADRAO_DIAS };
