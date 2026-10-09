import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";

/** Cabeçalho da coluna Previsão (mg) com botão que abre o diálogo explicativo */
export function PrevisaoMgColunaHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <span className="pacientes-mg-col-header">
      <span className="pacientes-mg-col-header-label">Previsão (mg)</span>
      <button
        type="button"
        className="pacientes-mg-info-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        aria-label="Explicar previsão em mg"
        title="O que significa esta coluna"
      >
        <i className="pi pi-info-circle" aria-hidden />
      </button>
    </span>
  );
}

interface PrevisaoMgInfoDialogProps {
  visible: boolean;
  onHide: () => void;
}

export function PrevisaoMgInfoDialog({
  visible,
  onHide,
}: PrevisaoMgInfoDialogProps) {
  return (
    <Dialog
      header="Previsão (mg)"
      visible={visible}
      onHide={onHide}
      draggable={false}
      dismissableMask
      style={{ width: "min(92vw, 32rem)" }}
      className="pacientes-mg-info-dialog"
    >
      <div className="pacientes-mg-info-body">
        <p>
          Os valores são <strong>previsões de consumo</strong> calculadas a
          partir do <strong>vínculo paciente–medicamento</strong>.{" "}
          <strong>Não dependem</strong> de retiradas ou dispensação.
        </p>
        <p>
          <strong>Mg/dia:</strong> taxa diária prevista.{" "}
          <strong>Mg/mês:</strong> projeção em 30 dias (mg/dia × 30).{" "}
          <strong>Contextual:</strong> mg/ciclo no regime por ciclo; mg/dia nos
          demais.
        </p>
        <p className="pacientes-mg-info-nota">
          Se aparecer &quot;—&quot;, a concentração não permitiu extrair mg
          (exceto no regime &quot;Consumo por miligrama&quot;).
        </p>
        <p className="pacientes-mg-info-nota">
          Em <strong>Estoque dá para (meses)</strong>, a primeira linha usa
          consumo em <strong>unidades/dia</strong>; a segunda, em{" "}
          <strong>mg/dia</strong> (requer previsão em mg).
        </p>
      </div>
      <div className="pacientes-mg-info-footer">
        <Button
          type="button"
          label="Fechar"
          className="p-button-secondary"
          onClick={onHide}
        />
      </div>
    </Dialog>
  );
}
