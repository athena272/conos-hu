import { Button } from "primereact/button";
import { describeCarrinhoItem, type RetiraCarrinhoItem } from "./retiraCarrinho";

interface RetiraEdicaoAvisoProps {
  item: Pick<RetiraCarrinhoItem, "nome" | "concentracao" | "lote">;
  disabled: boolean;
  onCancelar: () => void;
}

export function RetiraEdicaoAviso({ item, disabled, onCancelar }: RetiraEdicaoAvisoProps) {
  return (
    <div className="retire-edicao-aviso" aria-live="polite">
      <i className="pi pi-pencil" aria-hidden="true" />
      <p className="retire-edicao-aviso-texto">
        Editando item da lista: <strong>{describeCarrinhoItem(item)}</strong>. Altere os campos e
        clique em <strong>&quot;Salvar alteração&quot;</strong>.
      </p>
      <Button
        type="button"
        label="Cancelar edição"
        className="p-button-link p-button-sm"
        onClick={onCancelar}
        disabled={disabled}
      />
    </div>
  );
}
