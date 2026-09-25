import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import {
  formatarMgPtBr,
  formatarNumeroTaxaPtBr,
} from "../../utils/pacienteMedicamentoDisplay";
import type { ImpactoEstoque, RegimeConsumoMedicamento } from "../../types";
import { resumoMedicamentoNoPayload } from "./pacienteFormModel";

type MedicamentoPayloadResumo = {
  medicamento_nome: string;
  medicamento_concentracao: string;
  consumo_diario: number;
  regime_consumo?: RegimeConsumoMedicamento;
  unidades_por_ciclo?: number | null;
  intervalo_ciclo_dias?: number | null;
  consumo_mg_diario?: number | null;
};

export interface ConfirmarCadastroPacienteDialogProps {
  visible: boolean;
  pendingPayload: Record<string, unknown> | null;
  impactDataList: ImpactoEstoque[];
  loadingImpact: boolean;
  submittingConfirm: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmarCadastroPacienteDialog({
  visible,
  pendingPayload,
  impactDataList,
  loadingImpact,
  submittingConfirm,
  onCancel,
  onConfirm,
}: ConfirmarCadastroPacienteDialogProps) {
  return (
    <Dialog
      header="Confirmar cadastro do paciente"
      visible={visible}
      onHide={onCancel}
      draggable={false}
      style={{ width: "92vw", maxWidth: "520px" }}
      footer={
        <div>
          <Button
            label="Cancelar"
            className="p-button-text"
            onClick={onCancel}
            disabled={submittingConfirm}
          />
          <Button
            label="Confirmar cadastro"
            onClick={onConfirm}
            disabled={submittingConfirm || loadingImpact}
          />
        </div>
      }
    >
      {pendingPayload && (
        <div className="pacientes-confirm-content">
          <p>
            <strong>Resumo:</strong> {String(pendingPayload.nome)} — Pront.{" "}
            {String(pendingPayload.prontuario)} — Medicamentos:{" "}
            {(
              pendingPayload.medicamentos as MedicamentoPayloadResumo[]
            )
              ?.map((m) => resumoMedicamentoNoPayload(m))
              .join(", ") ?? "—"}
          </p>
          <h4>Impacto no estoque</h4>
          {loadingImpact ? (
            <p>Carregando...</p>
          ) : (
            <>
              {(
                pendingPayload.medicamentos as MedicamentoPayloadResumo[]
              )?.map((m, idx) => {
                const impact = impactDataList[idx];
                return (
                  <div key={idx} className="pacientes-impact-block">
                    <p className="pacientes-impact-med-label">
                      <strong>
                        {m.medicamento_nome} {m.medicamento_concentracao}
                      </strong>{" "}
                      ({resumoMedicamentoNoPayload(m)})
                    </p>
                    {impact ? (
                      <>
                        <ul className="pacientes-impact-list">
                          <li>
                            Estoque total:{" "}
                            <strong>{impact.estoqueTotal}</strong> unidades
                          </li>
                          <li>
                            Pacientes vinculados:{" "}
                            <strong>{impact.pacientesVinculados}</strong>
                          </li>
                          <li>
                            Total equivalente atual:{" "}
                            <strong>
                              {formatarNumeroTaxaPtBr(impact.consumoDiarioAtual)}
                            </strong>{" "}
                            unid./dia
                          </li>
                          <li>
                            Com este paciente:{" "}
                            <strong>
                              {formatarNumeroTaxaPtBr(
                                impact.consumoDiarioComNovo,
                              )}
                            </strong>{" "}
                            unid./dia
                          </li>
                          <li>
                            Estoque dá para (unid.):{" "}
                            <strong>
                              {impact.mesesEstoqueAtual != null
                                ? `${impact.mesesEstoqueAtual} meses`
                                : "—"}
                            </strong>
                            {" → "}
                            <strong>
                              {impact.mesesEstoqueComNovo != null
                                ? `${impact.mesesEstoqueComNovo} meses`
                                : "—"}
                            </strong>
                          </li>
                          {impact.consumoMgDiarioComNovo != null ? (
                            <>
                              <li>
                                Consumo previsto (mg/dia):{" "}
                                <strong>
                                  {formatarMgPtBr(
                                    impact.consumoMgDiarioAtual ?? 0,
                                  )}
                                  /dia
                                </strong>
                                {" → "}
                                <strong>
                                  {formatarMgPtBr(impact.consumoMgDiarioComNovo)}
                                  /dia
                                </strong>
                              </li>
                              {impact.consumoMgMesComNovo != null ? (
                                <li>
                                  Projeção mensal (mg):{" "}
                                  <strong>
                                    {formatarMgPtBr(impact.consumoMgMesComNovo)}
                                  </strong>
                                </li>
                              ) : null}
                              <li>
                                Estoque dá para (mg):{" "}
                                <strong>
                                  {impact.mesesEstoqueMgAtual != null
                                    ? `${impact.mesesEstoqueMgAtual} meses`
                                    : "—"}
                                </strong>
                                {" → "}
                                <strong>
                                  {impact.mesesEstoqueMgComNovo != null
                                    ? `${impact.mesesEstoqueMgComNovo} meses`
                                    : "—"}
                                </strong>
                              </li>
                            </>
                          ) : null}
                        </ul>
                        <p className="pacientes-taxa-linha-secundaria pacientes-impact-taxa-nota">
                          Valores são soma das taxas equivalentes (consumo
                          diário e por ciclo já convertidos).
                        </p>
                      </>
                    ) : (
                      <p>Não foi possível carregar o impacto.</p>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
