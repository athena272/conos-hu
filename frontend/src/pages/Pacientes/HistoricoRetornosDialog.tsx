import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { formatDateBR } from "../../utils/dateUtils";
import { getDataTableEmptyMessage } from "../../utils/dataTableMessages";
import type { Paciente, PacienteRetorno } from "../../types";
import { TIPO_RETORNO_OPTIONS, formatTipoRetorno } from "./pacienteFormModel";

export interface HistoricoRetornosDialogProps {
  paciente: Paciente | null;
  retornos: PacienteRetorno[];
  loading: boolean;
  canWrite: boolean;
  showAddForm: boolean;
  novaDataRetorno: string;
  novoTipoRetorno: string;
  addingRetorno: boolean;
  onClose: () => void;
  onShowAddForm: () => void;
  onCancelAddForm: () => void;
  onNovaDataRetornoChange: (value: string) => void;
  onNovoTipoRetornoChange: (value: string) => void;
  onAddRetorno: () => void;
}

export function HistoricoRetornosDialog({
  paciente,
  retornos,
  loading,
  canWrite,
  showAddForm,
  novaDataRetorno,
  novoTipoRetorno,
  addingRetorno,
  onClose,
  onShowAddForm,
  onCancelAddForm,
  onNovaDataRetornoChange,
  onNovoTipoRetornoChange,
  onAddRetorno,
}: HistoricoRetornosDialogProps) {
  return (
    <Dialog
      header={
        paciente
          ? `Histórico de retornos — ${paciente.nome}`
          : "Histórico de retornos"
      }
      visible={!!paciente}
      onHide={onClose}
      draggable={false}
      style={{ width: "92vw", maxWidth: "520px" }}
      className="pacientes-form-dialog"
      footer={<Button label="Fechar" onClick={onClose} />}
    >
      {!loading && (
        <>
          {retornos.length === 0 && !showAddForm ? (
            <p className="pacientes-field-hint">
              Nenhuma data de retorno cadastrada.
            </p>
          ) : (
            <DataTable
              value={retornos}
              size="small"
              emptyMessage={getDataTableEmptyMessage({
                loading: false,
                error: null,
                emptyLabel: "Nenhuma data de retorno",
              })}
              className="pacientes-table pacientes-table-custom"
              style={{ marginBottom: "1rem" }}
            >
              <Column
                field="data_retorno"
                header="Data"
                body={(row: PacienteRetorno) => formatDateBR(row.data_retorno)}
              />
              <Column
                field="tipo_retorno"
                header="Tipo"
                body={(row: PacienteRetorno) =>
                  formatTipoRetorno(row.tipo_retorno)
                }
              />
            </DataTable>
          )}
          {!showAddForm ? (
            canWrite ? (
              <Button
                label="Adicionar data de retorno"
                icon="pi pi-plus"
                className="p-button-sm p-button-secondary"
                onClick={onShowAddForm}
              />
            ) : null
          ) : (
            <div
              className="pacientes-form-fields"
              style={{ marginTop: "1rem" }}
            >
              <div className="campo-texto">
                <div className="input-container">
                  <label htmlFor="nova-data-retorno" className="input-label">
                    Data de retorno
                  </label>
                  <input
                    id="nova-data-retorno"
                    name="nova-data-retorno"
                    type="date"
                    value={novaDataRetorno}
                    onChange={(e) => onNovaDataRetornoChange(e.target.value)}
                    placeholder="Selecione a data de retorno"
                    className="p-inputtext p-component w-full form-field"
                  />
                </div>
              </div>
              <div className="campo-dropdown" style={{ marginTop: "0.5rem" }}>
                <label className="input-label">
                  Tipo de retorno (opcional)
                </label>
                <Dropdown
                  inputId="pacientes-novo-tipo-retorno"
                  name="pacientes-novo-tipo-retorno"
                  value={novoTipoRetorno}
                  options={TIPO_RETORNO_OPTIONS}
                  onChange={(e: { value: string }) =>
                    onNovoTipoRetornoChange(e.value ?? "")
                  }
                  placeholder="Selecione o tipo de retorno"
                  className="w-full"
                />
              </div>
              <div
                style={{
                  marginTop: "0.75rem",
                  display: "flex",
                  gap: "0.5rem",
                }}
              >
                <Button
                  label="Adicionar"
                  onClick={onAddRetorno}
                  disabled={addingRetorno || !novaDataRetorno.trim()}
                />
                <Button
                  label="Cancelar"
                  className="p-button-text"
                  onClick={onCancelAddForm}
                  disabled={addingRetorno}
                />
              </div>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
