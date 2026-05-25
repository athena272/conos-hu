import { useState } from "react";
import type { Paciente, ResumoPorMedicamento } from "../../types/paciente";
import {
  buildMesesEstoqueResumoAuditoria,
  buildPrevisaoMgResumoAuditoria,
} from "../../utils/resumoAuditoria";
import { CelulaPrevisaoMg } from "./PrevisaoMgCelula";
import { AuditoriaTrilhaDialog, BotaoAuditoriaTrilha } from "./AuditoriaTrilhaDialog";

export function CelulaPrevisaoMgResumo({
  row,
  pacientes,
}: {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
}) {
  const [auditVisible, setAuditVisible] = useState(false);
  const trilha = buildPrevisaoMgResumoAuditoria({
    row,
    pacientes,
    previsaoExibida: row.previsaoMgTotal,
  });

  return (
    <>
      <div className="pacientes-previsao-mg-celula">
        <div className="pacientes-taxa-resumo-celula pacientes-previsao-mg-conteudo">
          <CelulaPrevisaoMg previsao={row.previsaoMgTotal} />
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
      />
    </>
  );
}

export function CelulaMesesEstoqueResumo({
  row,
  pacientes,
}: {
  row: ResumoPorMedicamento;
  pacientes: Paciente[];
}) {
  const [auditVisible, setAuditVisible] = useState(false);
  const unid = row.mesesEstoque != null ? `${row.mesesEstoque} meses` : "—";
  const mg = row.mesesEstoqueMg != null ? `${row.mesesEstoqueMg} meses` : "—";
  const trilha = buildMesesEstoqueResumoAuditoria({
    row,
    pacientes,
    previsaoExibida: row.previsaoMgTotal,
    mesesUnidExibido: row.mesesEstoque,
    mesesMgExibido: row.mesesEstoqueMg,
  });

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
      />
    </>
  );
}
