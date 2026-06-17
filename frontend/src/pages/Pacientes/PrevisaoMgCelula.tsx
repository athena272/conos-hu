import { useState } from "react";
import type { PacienteMedicamento, PrevisaoMg } from "../../types/paciente";
import {
  formatarPrevisaoMgLinhas,
  getNotaPrevisaoMgIndisponivel,
  previsaoMgTemValor,
  resolvePrevisaoMgMedicamento,
} from "../../utils/pacienteMedicamentoDisplay";
import {
  buildPrevisaoMgAuditoria,
  previsaoMgAuditoriaParaTrilha,
} from "../../utils/previsaoMgAuditoria";
import { AuditoriaTrilhaDialog, BotaoAuditoriaTrilha } from "./AuditoriaTrilhaDialog";

export function CelulaPrevisaoMg({
  previsao,
  medicamento,
  mostrarAuditoria = false,
  diasPeriodo = 30,
}: {
  previsao: PrevisaoMg | null | undefined;
  medicamento?: PacienteMedicamento;
  mostrarAuditoria?: boolean;
  diasPeriodo?: number;
}) {
  const [auditVisible, setAuditVisible] = useState(false);

  const resolved = medicamento
    ? resolvePrevisaoMgMedicamento({
        ...medicamento,
        previsao_mg: previsaoMgTemValor(previsao) ? previsao! : medicamento.previsao_mg,
      })
    : previsaoMgTemValor(previsao)
      ? previsao!
      : previsao;

  const linhas = formatarPrevisaoMgLinhas(resolved, diasPeriodo);
  const nota =
    !previsaoMgTemValor(resolved) && medicamento
      ? getNotaPrevisaoMgIndisponivel({
          ...medicamento,
          previsao_mg: resolved ?? medicamento.previsao_mg,
        })
      : null;

  const trilha =
    medicamento && mostrarAuditoria
      ? previsaoMgAuditoriaParaTrilha(
          buildPrevisaoMgAuditoria(medicamento, {
            previsaoExibida: resolved ?? undefined,
          }),
        )
      : null;

  return (
    <>
      <div className="pacientes-previsao-mg-celula">
        <div className="pacientes-taxa-item pacientes-previsao-mg-conteudo">
          {linhas.map((l, i) => (
            <div
              key={i}
              className={
                l.principal
                  ? "pacientes-taxa-linha-principal"
                  : "pacientes-taxa-linha-secundaria"
              }
            >
              {l.texto}
            </div>
          ))}
          {nota ? (
            <div className="pacientes-taxa-linha-secundaria">{nota}</div>
          ) : null}
        </div>
        {trilha ? (
          <BotaoAuditoriaTrilha
            tituloAcessivel={`Ver como a previsão de ${trilha.titulo.replace(/^Previsão: /, "")} foi calculada`}
            onClick={(e) => {
              e.stopPropagation();
              setAuditVisible(true);
            }}
          />
        ) : null}
      </div>

      {trilha ? (
        <AuditoriaTrilhaDialog
          trilha={trilha}
          visible={auditVisible}
          onHide={() => setAuditVisible(false)}
        />
      ) : null}
    </>
  );
}

