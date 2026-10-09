// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDropdown } from "./AppDropdown";

const OPTIONS = [
  { label: "Sim", value: true },
  { label: "Não", value: false, disabled: true },
];

async function abrirLista(placeholder: string) {
  const user = userEvent.setup();
  const label = screen
    .getAllByText(placeholder)
    .find((el) => el.classList.contains("p-dropdown-label"));
  await user.click(label!);
  return user;
}

function itensDaLista(): Promise<HTMLElement[]> {
  return waitFor(() => {
    const encontrados = [...document.querySelectorAll<HTMLElement>(".p-dropdown-item")];
    expect(encontrados.length).toBeGreaterThan(0);
    return encontrados;
  });
}

describe("AppDropdown", () => {
  afterEach(() => {
    cleanup();
  });

  it("mostra o placeholder como primeira opção desabilitada, sem perder as opções desabilitadas originais", async () => {
    const onChange = vi.fn();
    render(
      <AppDropdown
        inputId="teste"
        value={null}
        options={OPTIONS}
        onChange={onChange}
        placeholder="Selecione sim ou não"
      />,
    );

    const user = await abrirLista("Selecione sim ou não");
    const itens = await itensDaLista();

    expect(itens.map((i) => i.textContent)).toEqual(["Selecione sim ou não", "Sim", "Não"]);
    expect(itens.map((i) => i.classList.contains("p-disabled"))).toEqual([true, false, true]);

    await user.click(itens[0]!);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(itens[1]!);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: true }));
  });

  it("durante a busca, a opção-placeholder sai da lista e não esconde a mensagem de busca vazia", async () => {
    const onFilter = vi.fn();
    render(
      <AppDropdown
        inputId="busca"
        value={null}
        options={OPTIONS}
        placeholder="Selecione sim ou não"
        filter
        filterPlaceholder="Digite para buscar"
        emptyFilterMessage="Nada encontrado"
        onFilter={onFilter}
      />,
    );

    const user = await abrirLista("Selecione sim ou não");
    const busca = await screen.findByPlaceholderText("Digite para buscar");

    await user.type(busca, "Selecione");
    expect(await screen.findByText("Nada encontrado")).toBeTruthy();
    expect(document.querySelector(".p-dropdown-item")).toBeNull();

    await user.clear(busca);
    await user.type(busca, "Si");
    const itens = await itensDaLista();
    expect(itens.map((i) => i.textContent)).toEqual(["Sim"]);
    expect(onFilter).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "Si" }));

    await user.clear(busca);
    await waitFor(() => {
      const textos = [...document.querySelectorAll(".p-dropdown-item")].map((i) => i.textContent);
      expect(textos).toEqual(["Selecione sim ou não", "Sim", "Não"]);
    });
  });

  it("com a lista vazia, mantém a mensagem de lista vazia", async () => {
    render(
      <AppDropdown
        inputId="vazio"
        value={null}
        options={[]}
        placeholder="Selecione o lote"
        emptyMessage="Nenhum lote cadastrado"
      />,
    );

    await abrirLista("Selecione o lote");

    expect(await screen.findByText("Nenhum lote cadastrado")).toBeTruthy();
    expect(document.querySelector(".p-dropdown-item")).toBeNull();
  });
});
