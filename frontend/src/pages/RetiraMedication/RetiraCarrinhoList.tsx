import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { formatDateBR } from "../../utils/dateUtils";
import { describeCarrinhoItem, type RetiraCarrinhoItem } from "./retiraCarrinho";
import { formatMedicamentoNome } from "./retiraLotes";

interface RetiraCarrinhoListProps {
  itens: RetiraCarrinhoItem[];
  disabled: boolean;
  /** Chave do item sendo editado no formulário; `null` fora do modo edição. */
  editingKey: string | null;
  onEdit: (item: RetiraCarrinhoItem) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}

export function RetiraCarrinhoList({
  itens,
  disabled,
  editingKey,
  onEdit,
  onRemove,
  onClear,
}: RetiraCarrinhoListProps) {
  const totalUnidades = itens.reduce((total, i) => total + i.quantidade, 0);

  return (
    <div className="retire-carrinho">
      <div className="retire-carrinho-header">
        <p className="retire-carrinho-resumo">
          {itens.length} {itens.length === 1 ? "item" : "itens"} · {totalUnidades} unid.
        </p>
        <Button
          type="button"
          label="Limpar lista"
          icon="pi pi-trash"
          className="p-button-text p-button-sm p-button-danger"
          onClick={onClear}
          disabled={disabled || editingKey != null}
          title={editingKey != null ? "Conclua ou cancele a edição antes de limpar a lista" : undefined}
        />
      </div>
      {/* Sem `cellMemo={false}` o PrimeReact memoriza as células e os botões ficam com handlers e `disabled` antigos. */}
      <DataTable
        value={itens}
        dataKey="key"
        size="small"
        className="retire-carrinho-table"
        cellMemo={false}
        rowClassName={(row: RetiraCarrinhoItem) =>
          row.key === editingKey ? "retire-carrinho-linha--editando" : ""
        }
      >
        <Column
          header="Medicamento"
          body={(row: RetiraCarrinhoItem) => formatMedicamentoNome(row)}
        />
        <Column field="lote" header="Lote" />
        <Column
          header="Validade"
          body={(row: RetiraCarrinhoItem) => formatDateBR(row.dataValidade)}
        />
        <Column field="quantidade" header="Qtd" />
        <Column
          header="Paciente"
          body={(row: RetiraCarrinhoItem) => row.pacienteLabel ?? "—"}
        />
        <Column
          header=""
          body={(row: RetiraCarrinhoItem) => (
            <div className="retire-carrinho-acoes">
              <Button
                type="button"
                icon="pi pi-pencil"
                className="p-button-text p-button-sm"
                aria-label={`Editar ${describeCarrinhoItem(row)}`}
                aria-pressed={row.key === editingKey}
                onClick={() => onEdit(row)}
                disabled={disabled}
              />
              <Button
                type="button"
                icon="pi pi-times"
                className="p-button-text p-button-sm p-button-danger"
                aria-label={`Remover ${describeCarrinhoItem(row)}`}
                onClick={() => onRemove(row.key)}
                disabled={disabled}
              />
            </div>
          )}
        />
      </DataTable>
    </div>
  );
}
