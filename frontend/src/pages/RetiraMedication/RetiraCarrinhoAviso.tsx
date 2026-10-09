interface RetiraCarrinhoAvisoProps {
  /** Há dados no formulário que ainda não foram adicionados à lista. */
  temItemPendente: boolean;
}

export function RetiraCarrinhoAviso({ temItemPendente }: RetiraCarrinhoAvisoProps) {
  return (
    <div
      role="note"
      aria-live="polite"
      className={`retire-carrinho-aviso ${
        temItemPendente ? "retire-carrinho-aviso--pendente" : "retire-carrinho-aviso--info"
      }`}
    >
      <i
        className={`pi ${temItemPendente ? "pi-exclamation-triangle" : "pi-info-circle"}`}
        aria-hidden="true"
      />
      <div>
        <strong className="retire-carrinho-aviso-titulo">
          {temItemPendente ? "Item ainda não adicionado à lista" : "Confira a lista antes de retirar"}
        </strong>
        <p className="retire-carrinho-aviso-texto">
          {temItemPendente ? (
            <>
              O medicamento preenchido no formulário <strong>não será retirado</strong> enquanto
              não estiver na lista. Clique em <strong>&quot;Adicionar à lista&quot;</strong> para
              incluí-lo.
            </>
          ) : (
            <>
              Somente os itens da lista abaixo serão retirados. Para incluir outro medicamento,
              preencha o formulário e clique em <strong>&quot;Adicionar à lista&quot;</strong>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
