# Conos

Sistema web para **gestão de estoque de medicamentos** em contexto assistencial: cadastro de lotes, movimentações (entrada e saída), acompanhamento de **pacientes** ligados ao consumo de medicamentos, **simulação de durabilidade** do estoque e **painéis analíticos**. O projeto é dividido em **API REST** (Node.js + Express + TypeScript + MySQL) e **interface** (React + Vite + TypeScript).

---

## Ambiente em produção

A interface está publicada na **Vercel**:

[https://conos-hu.vercel.app/](https://conos-hu.vercel.app/)

A API continua em serviço separado; na Vercel configure `VITE_API_URL` apontando para essa API e, no backend, `ALLOWED_ORIGINS` incluindo `https://conos-hu.vercel.app`.

O **banco de dados em produção** é **MySQL** hospedado no **Google Cloud SQL** (conexão via host/porta ou socket Unix com `INSTANCE_CONNECTION_NAME` no Cloud Run, conforme `backend/models/db.ts`).

---

## Sumário

- [Ambiente em produção](#ambiente-em-produção)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação local (desenvolvimento)](#instalação-local-desenvolvimento)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Docker](#docker)
- [API (visão geral)](#api-visão-geral)
- [Perfis de usuário](#perfis-de-usuário)
- [Documentação adicional](#documentação-adicional)

---

## Arquitetura

| Camada | Tecnologia | Pasta |
|--------|------------|--------|
| Backend | Express 4, TypeScript, `mysql2`, JWT (`bcryptjs` para senhas) | `backend/` |
| Frontend | React 18, Vite 6, PrimeReact, Chart.js, Formik/Yup, Axios | `frontend/` |
| Banco | MySQL — em produção, **Google Cloud SQL**; localmente, instância própria ou túnel (ex.: Cloud SQL Auth Proxy) | — |

Fluxo típico: o frontend chama a API com `Authorization: Bearer <token>` após o login; respostas `401` limpam a sessão e redirecionam para o login.

---

## Funcionalidades

### Autenticação e acesso

- **Cadastro** e **login** de usuários com JWT.
- Rotas da aplicação **protegidas** (usuário autenticado).
- Operações sensíveis (cadastro de lotes, retiradas, CRUD de pacientes, etc.) restritas a perfil **administrador** (ver [Perfis de usuário](#perfis-de-usuário)).

### Medicamentos e estoque

- **Listagem** de medicamentos com status derivado (em estoque, em falta, próximo a vencer, fora da validade).
- **Cadastro de novo lote** ou **incremento de quantidade** em lote existente.
- **Edição** e **exclusão** de registros (conforme permissões).
- **Busca** por nome/concentração e listagem de lotes compatíveis.
- **Retirada de medicamento** (saída de estoque), com validação de quantidade disponível.
- Registro de **movimentações** (entrada/saída) e histórico de retiradas associadas ao usuário.

### Pacientes

- Cadastro e manutenção de **pacientes** (dados clínicos/administrativos, liberação, retorno ao serviço).
- Associação de **vários medicamentos** por paciente, com **consumo diário** por item.
- **Datas de retorno** e tipos de retorno (farmácia, médico, enfermagem, etc.).
- Endpoints de **impacto no estoque** e **resumo por medicamento** para apoiar decisões.

### Simulador

- Estimativa de **quantos dias** o estoque de um lote dura e **data aproximada** de esgotamento, com base no número de pacientes e consumo diário por paciente (consumo total diário = pacientes × consumo por paciente).

### Painéis e visualização

- **Dashboard**: totais por status e gráficos (Chart.js) a partir dos dados de medicamentos.
- **Painel de estoque**: visão **por lote** e **por medicamento** (agregação), em abas estilo kanban.

---

## Requisitos

- **Node.js** 18 ou superior (alinhado às imagens Docker do projeto).
- **MySQL** acessível pela API (5.7+ ou 8.x, conforme seu ambiente).
- Gerenciador de pacotes: **npm** ou **pnpm** (há `pnpm-lock.yaml` no backend; use o que preferir, de forma consistente em cada pasta).

---

## Instalação local (desenvolvimento)

### 1. Banco MySQL

1. Crie um banco de dados (ex.: `conos`) e um usuário com permissões adequadas nesse banco.
2. Anote **host**, **porta**, **usuário**, **senha** e **nome do banco** — você usará nas variáveis `DB_*` da API.

Na **primeira conexão** bem-sucedida da API, o código em `backend/models/db.ts` cria e ajusta tabelas necessárias (`CREATE TABLE IF NOT EXISTS` e migrações leves em código). Para cenários específicos ou produção, consulte também [`backend/migrations/README-MIGRATIONS.md`](backend/migrations/README-MIGRATIONS.md).

### 2. Backend

```bash
cd backend
npm install
```

Defina as variáveis de ambiente (mínimo recomendado para desenvolvimento: `JWT_SECRET` e as variáveis `DB_*`; em desenvolvimento, se `JWT_SECRET` não existir, o servidor usa um aviso e segredo apenas para dev — **nunca deixe assim em produção**).

```bash
# Exemplo Windows PowerShell
$env:JWT_SECRET="uma-chave-longa-e-aleatoria"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="seu_usuario"
$env:DB_PASSWORD="sua_senha"
$env:DB_NAME="conos"
npm run dev
```

A API sobe por padrão na porta **3001** (ou na porta definida por `PORT`).

Compilação e execução “build”:

```bash
npm run build
npm start
```

Teste opcional de conexão com o banco:

```bash
npm run test:db
```

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O Vite costuma expor a aplicação em **http://localhost:5173**.

Se a API não estiver em `http://localhost:3001`, defina:

```bash
# Exemplo: API em outra máquina ou porta
$env:VITE_API_URL="http://localhost:3001"
npm run dev
```

### 4. Primeiro administrador

Após existir a coluna `role` na tabela `usuarios` (criada/atualizada automaticamente na subida da API), novos usuários tendem a ser **`viewer`** por padrão. Para liberar telas administrativas, promova pelo menos um usuário no MySQL:

```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
```

Detalhes em [`backend/migrations/README-MIGRATIONS.md`](backend/migrations/README-MIGRATIONS.md) (seção da migration 8).

---

## Variáveis de ambiente

### Backend

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP da API (padrão: `3001`). |
| `JWT_SECRET` | Segredo para assinatura do JWT. **Obrigatório** quando `NODE_ENV=production`. |
| `DB_HOST` | Host MySQL (padrão local: `127.0.0.1`). |
| `DB_PORT` | Porta MySQL (padrão: `3306`). |
| `DB_USER` | Usuário do banco. |
| `DB_PASSWORD` | Senha do banco. |
| `DB_NAME` | Nome do banco. |
| `INSTANCE_CONNECTION_NAME` | Se definido, a API usa socket Unix `/cloudsql/...` (Google Cloud SQL / Cloud Run). |
| `NODE_ENV` | `production` ativa exigência de `JWT_SECRET`. |
| `ALLOWED_ORIGINS` | Lista separada por vírgulas de origens permitidas no CORS (recomendado em produção). Se vazio, o CORS fica permissivo (adequado só para desenvolvimento). |

### Frontend

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL base da API. Se omitida, o código usa `http://localhost:3001`. |

---

## Banco de dados

Em **produção**, os dados ficam no **Google Cloud SQL** (MySQL). Em **desenvolvimento**, use um MySQL local ou conecte-se ao Cloud SQL por IP autorizado ou [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-auth-proxy).

Principais entidades (criadas/ajustadas na inicialização da API, conforme `backend/models/db.ts`):

- **usuarios** — autenticação e papel (`admin` / `viewer`).
- **medications** — lotes e quantidades.
- **retira_medications** — retiradas vinculadas a usuário e medicamento.
- **movimentacoes** — entradas e saídas.
- **pacientes** — cadastro assistencial.
- **paciente_medicamentos** — vários medicamentos por paciente.
- **paciente_retornos** — histórico de retornos.

Para execução manual de SQL, ordem de dependências e notas de deploy (GCP), use [`backend/migrations/README-MIGRATIONS.md`](backend/migrations/README-MIGRATIONS.md).

---

## Docker

Na raiz do repositório existe um [`docker-compose.yml`](docker-compose.yml) que sobe **API** e **frontend** (o frontend na imagem atual roda o Vite em modo desenvolvimento com `--host`).

**Importante:**

- Ajuste **credenciais e host do MySQL** via variáveis de ambiente do serviço `conos-api` — não commite senhas reais.
- O `Dockerfile` do backend expõe a porta **8080** na imagem, mas o processo usa `PORT` do ambiente; alinhe o mapeamento de portas do Compose com o valor de `PORT` que a API realmente escuta.
- Em produção, o frontend costuma ser **build estático** (por exemplo `npm run build` + nginx ou hospedagem tipo Vercel), não o servidor de desenvolvimento do Vite.

Comandos típicos:

```bash
docker compose build
docker compose up
```

---

## API (visão geral)

Prefixos principais (todas as rotas abaixo, exceto login/registro na raiz, exigem autenticação quando indicado no código):

| Método | Caminho | Observação |
|--------|---------|------------|
| `POST` | `/register` | Cadastro de usuário. |
| `POST` | `/login` | Login; retorna token. |
| `GET` / `POST` / `PUT` / `DELETE` | `/medications`… | CRUD e operações de estoque; parte das rotas exige **admin**. |
| `POST` | `/retira` | Retirada de medicamento (**admin**). |
| `GET` / `POST` / `PUT` / `DELETE` | `/pacientes`… | Pacientes, retornos, impacto e resumos; escrita em geral **admin**. |

O cliente HTTP do frontend está em `frontend/src/api/client.ts` e envia o Bearer token automaticamente.

---

## Perfis de usuário

- **admin** — acesso a cadastro de medicamentos, retiradas, gestão completa de pacientes e retornos.
- **viewer** — pode usar rotas autenticadas que não exigem `requireAdmin` (home, dashboards, simulador, leituras de pacientes conforme implementação das rotas).

A verificação ocorre no backend (`backend/middleware/authMiddleware.ts`) e no frontend (`AdminRoute`, `isAdmin` na sessão).

---

## Documentação adicional

- [Guia de testes](docs/GUIA-DE-TESTES.md) — fluxos, dados sugeridos e casos de erro.
- [Migrations e banco](backend/migrations/README-MIGRATIONS.md) — SQL manual, GCP e migrações automáticas.
- [Dados para testes](docs/DADOS-PARA-TESTES.md) — complemento ao guia de testes, se aplicável.

---

## Scripts úteis

| Pasta | Comando | Descrição |
|-------|---------|-----------|
| `backend` | `npm run dev` | API com `tsx watch` (hot reload). |
| `backend` | `npm run build` / `npm start` | Compila TypeScript e executa `dist/`. |
| `backend` | `npm run test:db` | Testa conexão MySQL. |
| `frontend` | `npm run dev` | Servidor Vite. |
| `frontend` | `npm run build` | Build de produção em `dist/`. |
| `frontend` | `npm run preview` | Preview do build. |
| `frontend` | `npm run lint` | ESLint. |

---

## Licença e metadados

O pacote do backend declara licença **ISC** no `package.json`. O frontend está marcado como **private**. Ajuste licenciamento e metadados conforme a política da sua organização.
