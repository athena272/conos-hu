# Guia de testes – Conos

Este documento descreve como testar a aplicação, com dados sugeridos, fluxos principais e casos de erro.

---

## Pré-requisitos

- **Backend** rodando (ex.: `pnpm dev` ou `npm run dev` na pasta `backend`).
- **Frontend** rodando (ex.: `pnpm dev` na pasta `frontend`).
- Navegador em `http://localhost:5173` (ou a URL que o Vite exibir).

---

## Dados sugeridos para testes

| Uso | Dados |
|-----|--------|
| **Login** | E-mail: `teste@email.com` (ou qualquer e-mail já cadastrado); Senha: conforme cadastro. |
| **Cadastro (Register)** | Nome: `Farmacêutico Teste`; E-mail: `farm@teste.com`; Senha: `senha123` (respeitando o mínimo da validação). |
| **Registrar medicação (novo lote)** | Nome: `Paracetamol 500mg`; Lote: `L2024001`; Quantidade: `100`; Classificação: `Analgésico`; Concentração: `500mg`; Forma: Comprimido; Validade: data futura (ex.: 31/12/2026). |
| **Registrar medicação (adicionar a lote existente)** | Tipo: "Adicionar a lote existente"; selecionar um medicamento da lista; Quantidade: `50`. |
| **Retirar medicação** | Nome: `Paracetamol`; Concentração: `500mg`; clicar em "Buscar lotes"; selecionar lote; Quantidade: `5`. |
| **Simulador** | Medicamento: um com estoque (ex.: Paracetamol - Lote L2024001); Número de pacientes: `5`; Consumo diário por paciente: `2`. |

---

## Fluxos possíveis (happy path)

1. **Login** – Informar e-mail e senha → Toast de sucesso e redirecionamento para Home.
2. **Register** – Preencher nome, e-mail e senha → Toast de sucesso → redirecionamento para Login (ou Home, conforme implementação).
3. **Registrar medicação – novo lote** – Tipo "Novo lote", preencher todos os campos obrigatórios, enviar → FullScreenLoader "Salvando..." → Toast de sucesso → formulário limpo.
4. **Registrar medicação – adicionar quantidade** – Tipo "Adicionar a lote existente", selecionar medicamento/lote, informar quantidade → FullScreenLoader "Adicionando quantidade..." → Toast de sucesso → formulário limpo.
5. **Retirar medicação** – Nome + concentração → "Buscar lotes" → selecionar lote → quantidade → FullScreenLoader "Processando retirada..." → Toast de sucesso → redirecionamento para Home.
6. **Home** – Listar medicações; editar uma (se existir fluxo de edição) → salvar → Toast e lista atualizada.
7. **Simulador** – Carregar lista → selecionar medicamento, informar número de pacientes e consumo diário por paciente → Calcular → exibir "X dias" e data estimada.

---

## Casos de erro e validação

| Onde | Caso | Comportamento esperado |
|------|------|------------------------|
| **Login** | E-mail/senha inválidos | Toast de erro. |
| **Login** | Campos vazios | Validação (Formik/HTML). |
| **Register** | E-mail já existente ou senha fraca | Toast de erro. |
| **RegisterMedication** | "Adicionar a lote": não selecionar medicamento | Toast "Selecione um medicamento/lote." |
| **RegisterMedication** | "Adicionar a lote": quantidade 0 ou inválida | Toast "Informe uma quantidade válida." |
| **RegisterMedication** | "Novo lote": campo obrigatório vazio | Toast "Preencha todos os campos obrigatórios do novo lote." |
| **RegisterMedication** | Backend falha (rede/500) | Toast com mensagem de erro (normalizeErrorMessage). |
| **RetiraMedication** | Sem login (userId ausente) | Toast "Usuário não está logado..." ou "Faça login novamente." |
| **RetiraMedication** | Não buscar lotes / não selecionar lote | Toast "Buscar lotes" ou "Selecione um lote na lista." |
| **RetiraMedication** | Quantidade maior que estoque | Toast de aviso "Quantidade insuficiente em estoque" (backend 400). |
| **RetiraMedication** | Backend falha | Toast de erro. |
| **Simulador** | Não selecionar medicamento | Toast "Selecione um medicamento/lote." |
| **Simulador** | Número de pacientes &lt; 1 | Toast "Informe o número de pacientes (mínimo 1)." |
| **Simulador** | Consumo diário por paciente ≤ 0 | Toast "Informe o consumo diário por paciente maior que zero." |
| **Simulador** | Medicamento com quantidade 0 | Mensagem "Medicação em falta." (sem dividir por zero). |
| **Simulador** | Falha ao carregar lista (GET /medications) | FullScreenLoader some; Toast de erro. |

---

## Simulador – campos atuais

O Simulador usa dois campos:

- **Número de pacientes** – inteiro, mínimo 1 (ex.: 5).
- **Consumo diário por paciente** – decimal, maior que zero (ex.: 2).

O consumo total por dia é calculado como: **número de pacientes × consumo diário por paciente**. Com isso, o sistema estima em quantos dias o estoque acaba e a data aproximada.

Exemplo: 100 unidades em estoque, 5 pacientes, 2 unidades/dia por paciente → 10 unidades/dia → estoque acaba em 10 dias.
