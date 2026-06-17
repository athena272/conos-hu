import { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import type { AuditoriaTrilha } from "../../utils/previsaoMgAuditoria";
import { PeriodoCalculoSelector } from "./PeriodoCalculoSelector";

export type { AuditoriaTrilha };

/**
 * Permite simular o período (dias) dentro do próprio diálogo de auditoria.
 * `rebuild` recalcula a trilha para o número de dias escolhido.
 */
export type PeriodoSimulacaoAuditoria = {
  diasPeriodoInicial: number;
  rebuild: (diasPeriodo: number) => AuditoriaTrilha;
};

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
  periodoSimulacao,
}: {
  trilha: AuditoriaTrilha;
  visible: boolean;
  onHide: () => void;
  periodoSimulacao?: PeriodoSimulacaoAuditoria;
}) {
  const [diasPeriodo, setDiasPeriodo] = useState(
    periodoSimulacao?.diasPeriodoInicial ?? 30,
  );

  // Ao reabrir, sincroniza o período do diálogo com o selecionado na tabela.
  useEffect(() => {
    if (visible && periodoSimulacao) {
      setDiasPeriodo(periodoSimulacao.diasPeriodoInicial);
    }
  }, [visible, periodoSimulacao?.diasPeriodoInicial]);

  const trilhaExibida = periodoSimulacao
    ? periodoSimulacao.rebuild(diasPeriodo)
    : trilha;

  return (
    <Dialog
      header={trilhaExibida.titulo}
      visible={visible}
      onHide={onHide}
      draggable={false}
      dismissableMask
      style={{ width: "min(92vw, 34rem)" }}
      className="pacientes-previsao-audit-dialog"
      appendTo={typeof document !== "undefined" ? document.body : undefined}
    >
      <div className="pacientes-previsao-audit-body">
        {periodoSimulacao ? (
          <div className="pacientes-audit-periodo">
            <PeriodoCalculoSelector
              diasPeriodo={diasPeriodo}
              onChange={setDiasPeriodo}
              idPrefix="pacientes-audit-periodo"
            />
          </div>
        ) : null}
        <p className="pacientes-previsao-audit-intro">{trilhaExibida.intro}</p>
        <dl className="pacientes-previsao-audit-lista">
          {trilhaExibida.passos.map((passo, i) => (
            <div key={i} className="pacientes-previsao-audit-item">
              <dt>{passo.rotulo}</dt>
              <dd>{passo.detalhe}</dd>
            </div>
          ))}
        </dl>
        {trilhaExibida.indisponivel ? (
          <p className="pacientes-previsao-audit-indisponivel">
            {trilhaExibida.indisponivel}
          </p>
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
