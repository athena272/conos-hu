import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { formatDateBR } from "../../utils/dateUtils";
import { describeCarrinhoItem, type RetiraCarrinhoItem } from "./retiraCarrinho";

interface RetiraCarrinhoListProps {
  itens: RetiraCarrinhoItem[];
  disabled: boolean;
  onRemove: (key: string) => void;
  onClear: () => void;
}

export function RetiraCarrinhoList({ itens, disabled, onRemove, onClear }: RetiraCarrinhoListProps) {
  const totalUnidades = itens.reduce((total, i) => total + i.quantidade, 0);

  return (
    <section className="retire-carrinho" aria-label="Lista de retirada">
      <div className="retire-carrinho-header">
        <h3 className="retire-carrinho-title">
          Lista de retirada ({itens.length} {itens.length === 1 ? "item" : "itens"} ·{" "}
          {totalUnidades} unid.)
        </h3>
        <Button
          type="button"
          label="Limpar lista"
          icon="pi pi-trash"
          className="p-button-text p-button-sm p-button-danger"
          onClick={onClear}
          disabled={disabled}
        />
      </div>
      <DataTable value={itens} dataKey="key" size="small" className="retire-carrinho-table">
        <Column
          header="Medicamento"
          body={(row: RetiraCarrinhoItem) =>
            row.concentracao ? `${row.nome} ${row.concentracao}` : row.nome
          }
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
            <Button
              type="button"
              icon="pi pi-times"
              className="p-button-text p-button-sm p-button-danger"
              aria-label={`Remover ${describeCarrinhoItem(row)}`}
              onClick={() => onRemove(row.key)}
              disabled={disabled}
            />
          )}
        />
      </DataTable>
    </section>
  );
}
