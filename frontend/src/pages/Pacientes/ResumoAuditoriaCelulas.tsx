import { useState } from "react";
import type { Paciente, ResumoPorMedicamento } from "../../types/paciente";
import {
  buildMesesEstoqueResumoAuditoria,
  buildPrevisaoMgResumoAuditoria,
} from "../../utils/resumoAuditoria";
import {
  mesesEstoqueFromMgFrontend,
  periodosEstoqueUnid,
} from "../../utils/pacienteMedicamentoDisplay";
import { CelulaPrevisaoMg } from "./PrevisaoMgCelula";
import { AuditoriaTrilhaDialog, BotaoAuditoriaTrilha } from "./AuditoriaTrilhaDialog";

const DIAS_POR_MES = 30;

export function CelulaPrevisaoMgResumo({
  row,
  pacientes,
  diasPeriodo = DIAS_POR_MES,
}: {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
  diasPeriodo?: number;
}) {
  const [auditVisible, setAuditVisible] = useState(false);
  const rebuildTrilha = (dias: number) =>
    buildPrevisaoMgResumoAuditoria({
      row,
      pacientes,
      previsaoExibida: row.previsaoMgTotal,
      diasPeriodo: dias,
    });
  const trilha = rebuildTrilha(diasPeriodo);

  return (
    <>
      <div className="pacientes-previsao-mg-celula">
        <div className="pacientes-taxa-resumo-celula pacientes-previsao-mg-conteudo">
          <CelulaPrevisaoMg previsao={row.previsaoMgTotal} diasPeriodo={diasPeriodo} />
        </div>
        <BotaoAuditoriaTrilha
          tituloAcessivel={`Ver como a previsão agregada de ${row.medicamento_nome} ${row.medicamento_concentracao} foi calculada`}
          onClick={(e) => {
            e.stopPropagation();
            setAuditVisible(true);
          }}
        />
      </div>
      <AuditoriaTrilhaDialog
        trilha={trilha}
        visible={auditVisible}
        onHide={() => setAuditVisible(false)}
        periodoSimulacao={{ diasPeriodoInicial: diasPeriodo, rebuild: rebuildTrilha }}
      />
    </>
  );
}

export function CelulaMesesEstoqueResumo({
  row,
  pacientes,
  diasPeriodo = DIAS_POR_MES,
}: {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
  diasPeriodo?: number;
}) {
  const [auditVisible, setAuditVisible] = useState(false);

  const calcularCobertura = (dias: number) => {
    const ehPadrao = dias === DIAS_POR_MES;
    return {
      mesesUnidVal: ehPadrao
        ? row.mesesEstoque
        : periodosEstoqueUnid(row.estoqueTotal, row.consumoDiarioTotal, dias),
      mesesMgVal: ehPadrao
        ? row.mesesEstoqueMg
        : mesesEstoqueFromMgFrontend(
            row.estoqueTotal,
            row.previsaoMgTotal?.mg_dia_previsto ?? null,
            row.medicamento_concentracao,
            dias,
          ),
    };
  };

  const rebuildTrilha = (dias: number) => {
    const { mesesUnidVal, mesesMgVal } = calcularCobertura(dias);
    return buildMesesEstoqueResumoAuditoria({
      row,
      pacientes,
      previsaoExibida: row.previsaoMgTotal,
      mesesUnidExibido: mesesUnidVal,
      mesesMgExibido: mesesMgVal,
      diasPeriodo: dias,
    });
  };

  const { mesesUnidVal, mesesMgVal } = calcularCobertura(diasPeriodo);
  // No padrão (30 dias) mostra "N meses"; em simulação, mostra "N períodos
  // (~N×dias dias)" para tornar a cobertura tangível e verificável.
  const formatarCobertura = (valor: number | null | undefined): string => {
    if (valor == null) return "—";
    if (diasPeriodo === DIAS_POR_MES) return `${valor} meses`;
    return `${valor} períodos (~${valor * diasPeriodo} dias)`;
  };
  const unid = formatarCobertura(mesesUnidVal);
  const mg = formatarCobertura(mesesMgVal);
  const trilha = rebuildTrilha(diasPeriodo);

  return (
    <>
      <div className="pacientes-previsao-mg-celula">
        <div className="pacientes-taxa-item pacientes-previsao-mg-conteudo">
          <div className="pacientes-taxa-linha-principal">
            {unid}
            <span className="pacientes-taxa-linha-hint"> (unid./dia)</span>
          </div>
          <div className="pacientes-taxa-linha-secundaria">
            {mg}
            <span className="pacientes-taxa-linha-hint"> (mg/dia)</span>
          </div>
        </div>
        <BotaoAuditoriaTrilha
          tituloAcessivel={`Ver como os meses de estoque de ${row.medicamento_nome} ${row.medicamento_concentracao} foram calculados`}
          onClick={(e) => {
            e.stopPropagation();
            setAuditVisible(true);
          }}
        />
      </div>
      <AuditoriaTrilhaDialog
        trilha={trilha}
        visible={auditVisible}
        onHide={() => setAuditVisible(false)}
        periodoSimulacao={{ diasPeriodoInicial: diasPeriodo, rebuild: rebuildTrilha }}
      />
    </>
  );
}
