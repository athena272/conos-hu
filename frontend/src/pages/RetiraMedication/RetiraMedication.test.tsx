// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { api } from "../../api/client";
import type { MedicationWithStatus } from "../../types";
import RetiraMedication from "./index";

vi.mock("../../api/client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock("../../auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../auth/session")>()),
  getAuth: () => ({ token: "token-de-teste", userId: 1, email: "admin@conos.test", role: "admin" }),
}));
vi.mock("../../components/Header", () => ({ default: () => null }));
vi.mock("../../components/Menu", () => ({ default: () => null }));

type ApiGet = Mock<
  (url: string, config?: { params?: Record<string, string> }) => Promise<{ data: unknown }>
>;
type ApiPost = Mock<(url: string, body?: unknown, config?: unknown) => Promise<{ data: unknown }>>;

const apiGet = api.get as unknown as ApiGet;
const apiPost = api.post as unknown as ApiPost;

function lot(partial: Partial<MedicationWithStatus> & Pick<MedicationWithStatus, "id">) {
  return {
    nome: "Dipirona",
    lote: `L${partial.id}`,
    classificacao: "",
    concentracao: "500mg",
    forma: "",
    status: "emEstoque",
    data_validade: "2099-01-01",
    quantidade: 10,
    ...partial,
  } satisfies MedicationWithStatus;
}

const DIPIRONA = lot({ id: 11, nome: "Dipirona", lote: "A1", concentracao: "500mg" });
const PARACETAMOL = lot({ id: 22, nome: "Paracetamol", lote: "B2", concentracao: "750mg" });

function renderPage(path = "/retira-medication") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/retira-medication" element={<RetiraMedication />} />
        <Route path="/home" element={<h1>Home</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillField(user: UserEvent, placeholder: string, value: string) {
  const input = screen.getByPlaceholderText(placeholder);
  await user.clear(input);
  await user.type(input, value);
}

async function adicionarItem(
  user: UserEvent,
  item: { nome: string; concentracao: string; lote: string; quantidade: number },
) {
  await fillField(user, "Digite o nome do medicamento (ex.: Dipirona)", item.nome);
  await fillField(
    user,
    "Digite a concentração do medicamento (ex.: 500mg, 250mg)",
    item.concentracao,
  );
  await user.click(screen.getByRole("button", { name: "Buscar lotes" }));
  await aguardarCarregamento();
  await screen.findAllByText(new RegExp(`Lote ${item.lote} - Validade`));
  await fillField(user, "Digite a quantidade à retirar", String(item.quantidade));
  await user.click(screen.getByRole("button", { name: "Adicionar à lista" }));
}

/** O `FullScreenLoader` (role="status") some quando pacientes e lotes terminam de carregar. */
async function aguardarCarregamento() {
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
}

/** Rótulo visível do `Dropdown` (o PrimeReact repete o texto num `<select>` oculto). */
function dropdownLabel(text: string): HTMLElement {
  const label = screen
    .getAllByText(text)
    .find((el) => el.classList.contains("p-dropdown-label"));
  if (!label) throw new Error(`Dropdown com o texto "${text}" não encontrado`);
  return label;
}

function chamadasTodosLotes(): number {
  return apiGet.mock.calls.filter(([url]) => url === "/medications").length;
}

describe("RetiraMedication", () => {
  beforeEach(() => {
    apiGet.mockImplementation(async (url, config) => {
      if (url === "/medications/by-name-concentration") {
        return { data: config?.params?.nome === "Paracetamol" ? [PARACETAMOL] : [DIPIRONA] };
      }
      if (url === "/medications") {
        return { data: [PARACETAMOL, DIPIRONA] };
      }
      return { data: [] };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("com a lista vazia, 'Retirar' continua fazendo a retirada individual", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ data: { message: "ok" } });
    renderPage("/retira-medication?nome=Dipirona&concentracao=500mg&quantidade=2");

    await screen.findAllByText(/Lote A1 - Validade/);
    await user.click(screen.getByRole("button", { name: "Retirar" }));

    await screen.findByRole("heading", { name: "Home" });
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith(
      "/retira",
      { medication_id: 11, quantidade: 2 },
      { timeout: 10000 },
    );
    expect(chamadasTodosLotes()).toBe(0);
  });

  it("ao abrir sem busca na URL, mostra o select com todos os lotes e nenhum pré-selecionado", async () => {
    const user = userEvent.setup();
    renderPage();
    await aguardarCarregamento();

    expect(chamadasTodosLotes()).toBe(1);
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");

    await user.click(dropdownLabel("Selecione o lote"));
    const opcoes = await waitFor(() => {
      const itens = [...document.querySelectorAll<HTMLElement>(".p-dropdown-item")];
      expect(itens.length).toBeGreaterThan(0);
      return itens;
    });
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Selecione o lote",
      expect.stringMatching(/^Dipirona - Lote A1 - Validade .* · recomendado$/),
      expect.stringMatching(/^Paracetamol - Lote B2 - Validade .* · recomendado$/),
    ]);
    expect(opcoes.map((o) => o.classList.contains("p-disabled"))).toEqual([true, false, false]);
    const buscaLote = screen.getByPlaceholderText("Digite o nome, lote ou validade");
    expect(buscaLote.id).toBe("retira-lote-busca");
    await user.keyboard("{Escape}");

    await fillField(user, "Digite a quantidade à retirar", "1");
    await user.click(screen.getByRole("button", { name: "Retirar" }));

    await screen.findByText("Selecione um lote na lista.");
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("depois de adicionar à lista, recarrega todos os lotes e mantém o select disponível", async () => {
    const user = userEvent.setup();
    renderPage();
    await aguardarCarregamento();

    await adicionarItem(user, { nome: "Dipirona", concentracao: "500mg", lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona - Lote A1" });
    await aguardarCarregamento();

    expect(chamadasTodosLotes()).toBe(2);
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");
  });

  it("a busca dentro do select de paciente tem placeholder e id", async () => {
    const user = userEvent.setup();
    renderPage();
    await aguardarCarregamento();

    await user.click(dropdownLabel("Selecione o paciente"));

    const busca = await screen.findByPlaceholderText("Digite o nome ou prontuário do paciente");
    expect(busca.id).toBe("retira-paciente-busca");
  });

  it("retira todos os itens da lista de uma vez, mostrando o carregamento", async () => {
    const user = userEvent.setup();
    let resolvePost!: (value: { data: unknown }) => void;
    apiPost.mockReturnValue(new Promise((resolve) => (resolvePost = resolve)));
    renderPage();

    await adicionarItem(user, { nome: "Dipirona", concentracao: "500mg", lote: "A1", quantidade: 3 });
    await screen.findByRole("button", { name: "Remover Dipirona - Lote A1" });
    await adicionarItem(user, {
      nome: "Paracetamol",
      concentracao: "750mg",
      lote: "B2",
      quantidade: 2,
    });
    await screen.findByRole("button", { name: "Remover Paracetamol - Lote B2" });

    expect(screen.queryByRole("button", { name: "Retirar" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retirar 2 itens da lista" }));

    expect(screen.getByRole("status").textContent).toContain("Processando retirada de 2 itens...");
    expect(apiPost).toHaveBeenCalledWith(
      "/retira/lote",
      {
        itens: [
          { medication_id: 11, quantidade: 3 },
          { medication_id: 22, quantidade: 2 },
        ],
      },
      { timeout: 30000 },
    );

    resolvePost({ data: { message: "ok", total_itens: 2 } });
    await screen.findByRole("heading", { name: "Home" });
  });

  it("mantém a lista e cita o item com problema quando a retirada em lote falha", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue({
      response: {
        status: 400,
        data: { error: "Quantidade insuficiente em estoque", item_index: 1 },
      },
    });
    renderPage();

    await adicionarItem(user, { nome: "Dipirona", concentracao: "500mg", lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona - Lote A1" });
    await adicionarItem(user, {
      nome: "Paracetamol",
      concentracao: "750mg",
      lote: "B2",
      quantidade: 1,
    });
    await screen.findByRole("button", { name: "Remover Paracetamol - Lote B2" });

    await user.click(screen.getByRole("button", { name: "Retirar 2 itens da lista" }));

    await screen.findByText(
      "Item 2 (Paracetamol - Lote B2): Quantidade insuficiente em estoque",
    );
    expect(screen.getByRole("button", { name: "Remover Dipirona - Lote A1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover Paracetamol - Lote B2" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("destaca quando há item preenchido no formulário que ainda não está na lista", async () => {
    const user = userEvent.setup();
    renderPage();

    await adicionarItem(user, { nome: "Dipirona", concentracao: "500mg", lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona - Lote A1" });

    const aviso = screen.getByRole("note");
    expect(aviso.textContent).toContain("Confira a lista antes de retirar");

    await fillField(user, "Digite o nome do medicamento (ex.: Dipirona)", "Paracetamol");

    expect(screen.getByRole("note").textContent).toContain("Item ainda não adicionado à lista");
    expect(screen.getByRole("note").className).toContain("retire-carrinho-aviso--pendente");
  });

  it("não adiciona à lista quantidade acima do estoque do lote", async () => {
    const user = userEvent.setup();
    renderPage();

    await adicionarItem(user, {
      nome: "Dipirona",
      concentracao: "500mg",
      lote: "A1",
      quantidade: 11,
    });

    await screen.findByText(/Estoque insuficiente: o lote tem 10 unidade\(s\)/);
    expect(screen.queryByRole("button", { name: "Remover Dipirona - Lote A1" })).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
