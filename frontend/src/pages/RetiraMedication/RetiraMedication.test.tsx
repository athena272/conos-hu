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

/** Rótulo visível do `Dropdown` cujo campo tem o `inputId` informado. */
function rotuloDoCampo(inputId: string): HTMLElement {
  const label = document
    .getElementById(inputId)
    ?.closest(".p-dropdown")
    ?.querySelector<HTMLElement>(".p-dropdown-label");
  if (!label) throw new Error(`Dropdown "${inputId}" não encontrado`);
  return label;
}

/** Abre o select e devolve as opções renderizadas (a primeira é o placeholder). */
async function abrirSelect(user: UserEvent, inputId: string): Promise<HTMLElement[]> {
  await user.click(rotuloDoCampo(inputId));
  return waitFor(() => {
    const itens = [...document.querySelectorAll<HTMLElement>(".p-dropdown-item")];
    expect(itens.length).toBeGreaterThan(0);
    return itens;
  });
}

async function escolherOpcao(user: UserEvent, inputId: string, texto: string) {
  const opcoes = await abrirSelect(user, inputId);
  const opcao = opcoes.find((o) => o.textContent?.includes(texto));
  if (!opcao) throw new Error(`Opção "${texto}" não encontrada em "${inputId}"`);
  await user.click(opcao);
}

function campoQuantidade(): HTMLInputElement {
  return screen.getByPlaceholderText("Digite a quantidade à retirar") as HTMLInputElement;
}

async function adicionarItem(user: UserEvent, item: { lote: string; quantidade: number }) {
  await aguardarCarregamento();
  await escolherOpcao(user, "lot", `Lote ${item.lote} -`);
  await fillField(user, "Digite a quantidade à retirar", String(item.quantidade));
  await user.click(screen.getByRole("button", { name: "Adicionar à lista" }));
}

/** Células de texto de cada linha da lista (Medicamento, Lote, Validade, Qtd, Paciente). */
function linhasDaLista(): string[][] {
  return [...document.querySelectorAll(".retire-carrinho-table tbody tr")].map((tr) =>
    [...tr.querySelectorAll("td")].slice(0, 5).map((td) => td.textContent?.trim() ?? ""),
  );
}

async function editarItem(user: UserEvent, descricao: string) {
  await user.click(screen.getByRole("button", { name: `Editar ${descricao}` }));
  await aguardarCarregamento();
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

    await screen.findAllByText(/Dipirona 500mg - Lote A1 - Validade/);
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

  it("vindo da URL com medicamento, mostra o filtro aplicado e permite ver todos os lotes", async () => {
    const user = userEvent.setup();
    renderPage("/retira-medication?nome=Dipirona&concentracao=500mg");
    await aguardarCarregamento();

    expect(screen.getByText(/Mostrando apenas os lotes de/).textContent).toContain(
      "Dipirona 500mg",
    );
    const loteSelecionado = screen
      .getAllByText(/^Dipirona 500mg - Lote A1 - Validade/)
      .find((el) => el.classList.contains("p-dropdown-label"));
    expect(loteSelecionado).toBeTruthy();
    expect(chamadasTodosLotes()).toBe(0);

    await user.click(screen.getByRole("button", { name: "Ver todos os lotes" }));
    await aguardarCarregamento();

    expect(chamadasTodosLotes()).toBe(1);
    expect(screen.queryByText(/Mostrando apenas os lotes de/)).toBeNull();
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");
  });

  it("vindo da URL com medicamento sem lotes, avisa e mantém a opção de ver todos os lotes", async () => {
    const user = userEvent.setup();
    apiGet.mockImplementation(async (url) =>
      url === "/medications" ? { data: [PARACETAMOL, DIPIRONA] } : { data: [] },
    );
    renderPage("/retira-medication?nome=Inexistente&concentracao=1mg");
    await aguardarCarregamento();

    expect(apiGet).toHaveBeenCalledWith("/medications/by-name-concentration", {
      params: { nome: "Inexistente", concentracao: "1mg" },
    });
    await screen.findByText("Nenhum lote encontrado com esse nome e concentração.");
    expect(dropdownLabel("Nenhum lote disponível")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ver todos os lotes" }));
    await aguardarCarregamento();

    expect(screen.queryByText(/Mostrando apenas os lotes de/)).toBeNull();
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");
  });

  it("quando os lotes não carregam, oferece tentar novamente", async () => {
    const user = userEvent.setup();
    const getPadrao = apiGet.getMockImplementation()!;
    let falhar = true;
    apiGet.mockImplementation(async (url, config) => {
      if (url === "/medications" && falhar) {
        falhar = false;
        throw new Error("Network Error");
      }
      return getPadrao(url, config);
    });
    renderPage();
    await aguardarCarregamento();

    const aviso = screen.getByText("Não foi possível carregar os lotes.").closest("[role='alert']");
    expect(aviso?.className).toContain("retire-lotes-aviso--erro");
    expect(dropdownLabel("Não foi possível carregar os lotes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await aguardarCarregamento();

    expect(chamadasTodosLotes()).toBe(2);
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");
  });

  it("ao abrir sem busca na URL, mostra o select com todos os lotes e nenhum pré-selecionado", async () => {
    const user = userEvent.setup();
    renderPage();
    await aguardarCarregamento();

    expect(chamadasTodosLotes()).toBe(1);
    expect(screen.getByRole("heading", { name: "Item da retirada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lista de retirada" })).toBeTruthy();
    expect(screen.queryByText("Nome do medicamento")).toBeNull();
    expect(screen.queryByRole("button", { name: "Buscar lotes" })).toBeNull();
    expect(dropdownLabel("Selecione o lote").classList).toContain("p-placeholder");

    const opcoes = await abrirSelect(user, "lot");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Selecione o lote",
      expect.stringMatching(/^Dipirona 500mg - Lote A1 - Validade .* · recomendado$/),
      expect.stringMatching(/^Paracetamol 750mg - Lote B2 - Validade .* · recomendado$/),
    ]);
    expect(opcoes.map((o) => o.classList.contains("p-disabled"))).toEqual([true, false, false]);
    const buscaLote = screen.getByPlaceholderText("Digite o nome, concentração, lote ou validade");
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

    await adicionarItem(user, { lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona 500mg - Lote A1" });
    await aguardarCarregamento();

    expect(screen.getByText("Dipirona 500mg (Lote A1) adicionado à lista.")).toBeTruthy();
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

    await adicionarItem(user, { lote: "A1", quantidade: 3 });
    await screen.findByRole("button", { name: "Remover Dipirona 500mg - Lote A1" });
    await adicionarItem(user, { lote: "B2", quantidade: 2 });
    await screen.findByRole("button", { name: "Remover Paracetamol 750mg - Lote B2" });

    expect(screen.queryByRole("button", { name: "Retirar" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retirar 2 itens da lista" }));

    expect(screen.getByRole("status").textContent).toContain("Processando retirada de 2 itens...");
    for (const acao of ["Editar", "Remover"]) {
      const botao = screen.getByRole("button", { name: `${acao} Dipirona 500mg - Lote A1` });
      expect((botao as HTMLButtonElement).disabled).toBe(true);
    }
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

    await adicionarItem(user, { lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona 500mg - Lote A1" });
    await adicionarItem(user, { lote: "B2", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Paracetamol 750mg - Lote B2" });

    await user.click(screen.getByRole("button", { name: "Retirar 2 itens da lista" }));

    await screen.findByText(
      "Item 2 (Paracetamol 750mg - Lote B2): Quantidade insuficiente em estoque",
    );
    expect(screen.getByRole("button", { name: "Remover Dipirona 500mg - Lote A1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover Paracetamol 750mg - Lote B2" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("destaca quando há item preenchido no formulário que ainda não está na lista", async () => {
    const user = userEvent.setup();
    renderPage();

    await adicionarItem(user, { lote: "A1", quantidade: 1 });
    await screen.findByRole("button", { name: "Remover Dipirona 500mg - Lote A1" });

    const aviso = screen.getByRole("note");
    expect(aviso.textContent).toContain("Confira a lista antes de retirar");

    await fillField(user, "Digite a quantidade à retirar", "2");

    expect(screen.queryByText(/Nenhum item na lista/)).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("Item ainda não adicionado à lista");
    expect(screen.getByRole("note").className).toContain("retire-carrinho-aviso--pendente");
  });

  it("não adiciona à lista quantidade acima do estoque do lote", async () => {
    const user = userEvent.setup();
    renderPage();

    await adicionarItem(user, { lote: "A1", quantidade: 11 });

    await screen.findByText(/Estoque insuficiente: o lote tem 10 unidade\(s\)/);
    expect(screen.queryByRole("button", { name: "Remover Dipirona 500mg - Lote A1" })).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  describe("edição de item da lista", () => {
    const DIPIRONA_A1 = "Dipirona 500mg - Lote A1";
    const PARACETAMOL_B2 = "Paracetamol 750mg - Lote B2";

    async function montarListaComDoisItens(user: UserEvent) {
      await adicionarItem(user, { lote: "A1", quantidade: 1 });
      await screen.findByRole("button", { name: `Remover ${DIPIRONA_A1}` });
      await adicionarItem(user, { lote: "B2", quantidade: 2 });
      await screen.findByRole("button", { name: `Remover ${PARACETAMOL_B2}` });
      await aguardarCarregamento();
    }

    it("preenche lote, paciente e quantidade do item e entra em modo edição", async () => {
      const user = userEvent.setup();
      const getPadrao = apiGet.getMockImplementation()!;
      apiGet.mockImplementation(async (url, config) =>
        url === "/pacientes"
          ? { data: [{ id: 7, nome: "Ana", prontuario: 123 }] }
          : getPadrao(url, config),
      );
      renderPage();
      await aguardarCarregamento();

      await escolherOpcao(user, "retira-paciente", "Ana · Pront. 123");
      await adicionarItem(user, { lote: "A1", quantidade: 3 });
      await screen.findByRole("button", { name: `Remover ${DIPIRONA_A1}` });
      await escolherOpcao(user, "retira-paciente", "— Não vincular —");
      await adicionarItem(user, { lote: "B2", quantidade: 2 });
      await screen.findByRole("button", { name: `Remover ${PARACETAMOL_B2}` });
      await aguardarCarregamento();

      await editarItem(user, DIPIRONA_A1);

      expect(rotuloDoCampo("lot").textContent).toMatch(/^Dipirona 500mg - Lote A1 - Validade/);
      expect(rotuloDoCampo("retira-paciente").textContent).toBe("Ana · Pront. 123");
      expect(campoQuantidade().value).toBe("3");
      expect(screen.getByText(/Editando item da lista:/).textContent).toContain(DIPIRONA_A1);
      expect(
        screen.getByRole("button", { name: `Editar ${DIPIRONA_A1}` }).getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.queryByRole("button", { name: "Adicionar à lista" })).toBeNull();
      expect(screen.getByRole("button", { name: "Salvar alteração" })).toBeTruthy();
      expect(screen.getByRole("note").textContent).toContain("Confira a lista antes de retirar");
    });

    it("bloqueia retirar e limpar a lista enquanto há edição em aberto", async () => {
      const user = userEvent.setup();
      renderPage();
      await montarListaComDoisItens(user);

      await editarItem(user, DIPIRONA_A1);

      const retirar = screen.getByRole("button", { name: "Retirar 2 itens da lista" });
      expect((retirar as HTMLButtonElement).disabled).toBe(true);
      expect(retirar.getAttribute("title")).toBe(
        "Conclua ou cancele a edição do item antes de retirar",
      );
      expect(
        (screen.getByRole("button", { name: "Limpar lista" }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("salvar atualiza o item na mesma posição e a retirada usa o valor novo", async () => {
      const user = userEvent.setup();
      apiPost.mockResolvedValue({ data: { message: "ok", total_itens: 2 } });
      renderPage();
      await montarListaComDoisItens(user);

      await editarItem(user, DIPIRONA_A1);
      await fillField(user, "Digite a quantidade à retirar", "4");
      await user.click(screen.getByRole("button", { name: "Salvar alteração" }));
      await aguardarCarregamento();

      await screen.findByText("Dipirona 500mg (Lote A1) atualizado na lista.");
      expect(linhasDaLista().map(([nome, , , qtd]) => [nome, qtd])).toEqual([
        ["Dipirona 500mg", "4"],
        ["Paracetamol 750mg", "2"],
      ]);
      expect(screen.queryByText(/Editando item da lista:/)).toBeNull();
      expect(screen.getByRole("button", { name: "Adicionar à lista" })).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Retirar 2 itens da lista" }));
      await screen.findByRole("heading", { name: "Home" });
      expect(apiPost).toHaveBeenCalledWith(
        "/retira/lote",
        {
          itens: [
            { medication_id: 11, quantidade: 4 },
            { medication_id: 22, quantidade: 2 },
          ],
        },
        { timeout: 30000 },
      );
    });

    it("trocar para um lote que já está em outro item soma as quantidades numa linha só", async () => {
      const user = userEvent.setup();
      renderPage();
      await montarListaComDoisItens(user);

      await editarItem(user, PARACETAMOL_B2);
      await escolherOpcao(user, "lot", "Lote A1 -");
      await user.click(screen.getByRole("button", { name: "Salvar alteração" }));
      await aguardarCarregamento();

      expect(linhasDaLista().map(([nome, lote, , qtd]) => [nome, lote, qtd])).toEqual([
        ["Dipirona 500mg", "A1", "3"],
      ]);
    });

    it("não salva quantidade acima do estoque e mantém o item original", async () => {
      const user = userEvent.setup();
      renderPage();
      await montarListaComDoisItens(user);

      await editarItem(user, DIPIRONA_A1);
      await fillField(user, "Digite a quantidade à retirar", "11");
      await user.click(screen.getByRole("button", { name: "Salvar alteração" }));

      await screen.findByText("Estoque insuficiente: o lote tem 10 unidade(s).");
      expect(linhasDaLista()[0]?.[3]).toBe("1");
      expect(screen.getByText(/Editando item da lista:/)).toBeTruthy();
    });

    it("cancelar restaura o formulário anterior sem alterar a lista", async () => {
      const user = userEvent.setup();
      renderPage();
      await montarListaComDoisItens(user);

      await escolherOpcao(user, "lot", "Lote B2 -");
      await fillField(user, "Digite a quantidade à retirar", "5");
      await editarItem(user, DIPIRONA_A1);
      expect(campoQuantidade().value).toBe("1");

      await user.click(screen.getAllByRole("button", { name: "Cancelar edição" })[0]!);

      expect(campoQuantidade().value).toBe("5");
      expect(rotuloDoCampo("lot").textContent).toMatch(/^Paracetamol 750mg - Lote B2/);
      expect(screen.queryByText(/Editando item da lista:/)).toBeNull();
      expect(linhasDaLista().map(([, , , qtd]) => qtd)).toEqual(["1", "2"]);
    });

    it("remover o item em edição encerra a edição", async () => {
      const user = userEvent.setup();
      renderPage();
      await montarListaComDoisItens(user);

      await editarItem(user, DIPIRONA_A1);
      await user.click(screen.getByRole("button", { name: `Remover ${DIPIRONA_A1}` }));

      expect(screen.queryByText(/Editando item da lista:/)).toBeNull();
      expect(screen.getByRole("button", { name: "Adicionar à lista" })).toBeTruthy();
      expect(linhasDaLista().map(([nome]) => nome)).toEqual(["Paracetamol 750mg"]);
      expect(
        (screen.getByRole("button", { name: "Retirar 1 item da lista" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    it("se o lote do item não está no select, recarrega os lotes antes de preencher", async () => {
      const user = userEvent.setup();
      let chamada = 0;
      apiGet.mockImplementation(async (url) => {
        if (url !== "/medications") return { data: [] };
        chamada += 1;
        if (chamada === 2) throw new Error("Network Error");
        return { data: [PARACETAMOL, DIPIRONA] };
      });
      renderPage();

      await adicionarItem(user, { lote: "A1", quantidade: 2 });
      await screen.findByRole("button", { name: `Remover ${DIPIRONA_A1}` });
      await aguardarCarregamento();
      expect(dropdownLabel("Não foi possível carregar os lotes")).toBeTruthy();

      await editarItem(user, DIPIRONA_A1);

      expect(chamadasTodosLotes()).toBe(3);
      expect(rotuloDoCampo("lot").textContent).toMatch(/^Dipirona 500mg - Lote A1/);
      expect(campoQuantidade().value).toBe("2");
    });

    it("avisa quando o lote do item não existe mais e deixa escolher outro", async () => {
      const user = userEvent.setup();
      let chamada = 0;
      apiGet.mockImplementation(async (url) => {
        if (url !== "/medications") return { data: [] };
        chamada += 1;
        if (chamada === 2) throw new Error("Network Error");
        return { data: chamada === 1 ? [PARACETAMOL, DIPIRONA] : [PARACETAMOL] };
      });
      renderPage();

      await adicionarItem(user, { lote: "A1", quantidade: 2 });
      await screen.findByRole("button", { name: `Remover ${DIPIRONA_A1}` });
      await aguardarCarregamento();

      await editarItem(user, DIPIRONA_A1);

      await screen.findByText(
        "O lote A1 não está mais disponível. Escolha outro lote para este item.",
      );
      expect(rotuloDoCampo("lot").textContent).toBe("Selecione o lote");
      expect(campoQuantidade().value).toBe("2");
      expect(screen.getByText(/Editando item da lista:/)).toBeTruthy();
    });
  });
});
