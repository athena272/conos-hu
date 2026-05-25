import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import type { AuditoriaTrilha } from "../../utils/previsaoMgAuditoria";

export type { AuditoriaTrilha };

export function BotaoAuditoriaTrilha({
  tituloAcessivel,
  onClick,
}: {
  tituloAcessivel: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className="pacientes-mg-info-btn pacientes-previsao-audit-btn"
      onClick={onClick}
      aria-label={tituloAcessivel}
      title="Como chegamos neste valor"
    >
      <i className="pi pi-calculator" aria-hidden />
    </button>
  );
}

export function AuditoriaTrilhaDialog({
  trilha,
  visible,
  onHide,
}: {
  trilha: AuditoriaTrilha;
  visible: boolean;
  onHide: () => void;
}) {
  return (
    <Dialog
      header={trilha.titulo}
      visible={visible}
      onHide={onHide}
      draggable={false}
      dismissableMask
      style={{ width: "min(92vw, 34rem)" }}
      className="pacientes-previsao-audit-dialog"
      appendTo={typeof document !== "undefined" ? document.body : undefined}
    >
      <div className="pacientes-previsao-audit-body">
        <p className="pacientes-previsao-audit-intro">{trilha.intro}</p>
        <dl className="pacientes-previsao-audit-lista">
          {trilha.passos.map((passo, i) => (
            <div key={i} className="pacientes-previsao-audit-item">
              <dt>{passo.rotulo}</dt>
              <dd>{passo.detalhe}</dd>
            </div>
          ))}
        </dl>
        {trilha.indisponivel ? (
          <p className="pacientes-previsao-audit-indisponivel">{trilha.indisponivel}</p>
        ) : null}
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
