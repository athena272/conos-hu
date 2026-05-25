# Conos

Sistema web para **gestão de estoque de medicamentos** em contexto assistencial: cadastro de lotes, movimentações (entrada e saída), acompanhamento de **pacientes** ligados ao consumo de medicamentos, **simulação de durabilidade** do estoque e **painéis analíticos**. O projeto é dividido em **API REST** (Node.js + Express + TypeScript + MongoDB) e **interface** (React + Vite + TypeScript).

---

## Ambiente em produção

A interface está publicada na **Vercel**:

[https://conos-hu.vercel.app/](https://conos-hu.vercel.app/)

A API continua em serviço separado; na Vercel configure `VITE_API_URL` apontando para essa API e, no backend, `ALLOWED_ORIGINS` incluindo `https://conos-hu.vercel.app`.

O **banco de dados em produção** é **MongoDB** no **MongoDB Atlas** (database `conos`, cluster com replica set). A API conecta via `MONGODB_URI` (ver [`backend/models/mongo.ts`](backend/models/mongo.ts)).

---

## Sumário

- [Ambiente em produção](#ambiente-em-produção)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação local (desenvolvimento)](#instalação-local-desenvolvimento)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Gerar JWT_SECRET](#gerar-jwt_secret)
- [Banco de dados](#banco-de-dados)
- [Docker](#docker)
- [API (visão geral)](#api-visão-geral)
- [Perfis de usuário](#perfis-de-usuário)
- [Documentação adicional](#documentação-adicional)

---

## Arquitetura

| Camada | Tecnologia | Pasta |
|--------|------------|--------|
| Backend | Express 4, TypeScript, driver `mongodb`, JWT (`bcryptjs` para senhas) | `backend/` |
| Frontend | React 18, Vite 6, PrimeReact, Chart.js, Formik/Yup, Axios | `frontend/` |
| Banco | MongoDB — em produção, **MongoDB Atlas**; localmente, **Docker Compose** (`mongo:8.0.23`) ou URI própria | — |

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

- **Node.js** 18 ou superior.
- **MongoDB** 8.x acessível pela API (instalação própria, **ou** **Docker** + Docker Compose para subir o MongoDB localmente — ver abaixo).
- Gerenciador de pacotes: **npm** (recomendado no dia a dia) ou **pnpm** (há `pnpm-lock.yaml` em `backend/` e `frontend/`). Com **pnpm v11** no PC, se aparecer `ERR_PNPM_IGNORED_BUILDS`, use `npm install` / `npm run dev` ou rode `pnpm approve-builds` na pasta do projeto.
- **Docker Desktop** (ou Docker Engine + Compose) — opcional, recomendado se quiser o banco local sem instalar o MongoDB na máquina.

---

## Instalação local (desenvolvimento)

Fluxo **híbrido** recomendado: **Docker Compose** sobe **somente o MongoDB**; **backend** e **frontend** rodam na sua máquina com `npm run dev`.

Ordem sugerida: (1) banco no Docker; (2) `MONGODB_URI` e `JWT_SECRET` no backend; (3) `npm run dev` em `backend` e `frontend`.

### 1. Banco MongoDB

**Opção A — MongoDB com Docker (recomendado para desenvolvimento)**

1. Na raiz do repositório, copie [`.env.example`](.env.example) para `.env` e defina `MONGO_ROOT_PASSWORD` (e opcionalmente `MONGO_INITDB_ROOT_USERNAME`, padrão `root`).
2. Suba o container:

   ```bash
   docker compose up -d
   ```

3. Aguarde o serviço ficar saudável (`docker compose ps`). Configure o backend com:

   ```text
   MONGODB_URI=mongodb://root:<MONGO_ROOT_PASSWORD>@127.0.0.1:27017/conos?authSource=admin
   ```

   O segmento `/conos` na URI define o database (igual ao Atlas em produção).

Para parar: `docker compose down`. Para apagar os dados persistidos do volume: `docker compose down -v` (irreversível).

**Migração do volume MySQL antigo:** se você já usava o Compose com MySQL, remova o volume antigo antes de subir o Mongo: `docker compose down -v` (apaga `conos_mysql_data` e dados locais do MySQL).

**Opção B — MongoDB já instalado ou Atlas (sem Docker local)**

1. Use uma URI de conexão completa em `MONGODB_URI` (ex.: `mongodb+srv://...` no Atlas, ou `mongodb://host:27017/conos`).
2. Garanta que o database na URI seja `conos` (ou o nome que você usar em produção).

Na **primeira conexão** bem-sucedida da API, o código em [`backend/models/mongo.ts`](backend/models/mongo.ts) conecta e [`backend/models/indexes.ts`](backend/models/indexes.ts) cria os índices necessários. Coleções são criadas automaticamente no primeiro insert. Arquivos SQL em [`backend/migrations/`](backend/migrations/) são **legado MySQL** (referência histórica).

### 2. Backend

```bash
cd backend
npm install
```

Copie [`backend/.env.example`](backend/.env.example) para `backend/.env` (a API carrega esse arquivo automaticamente ao subir). Mínimo: `MONGODB_URI` e `JWT_SECRET`. O `.env` na **raiz** do repo é só para o Docker (`MONGO_*`); variáveis da API ficam em `backend/.env`. Se a senha do Mongo tiver caracteres especiais (`/`, `+`, `@`…), use-os **codificados na URI** (ex.: `/` → `%2F`).

Gere um valor aleatório forte para `JWT_SECRET` (veja [Gerar JWT_SECRET](#gerar-jwt_secret)) e use no `.env` ou no shell:

```powershell
# Exemplo Windows PowerShell
$env:MONGODB_URI="mongodb://root:sua_senha@127.0.0.1:27017/conos?authSource=admin"
$env:JWT_SECRET="<cole aqui o valor gerado>"
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

Novos usuários cadastrados pela API tendem a ser **`viewer`** por padrão. Para liberar telas administrativas, promova pelo menos um usuário no MongoDB (mongosh, Compass ou Atlas Data Explorer):

```javascript
use conos
db.usuarios.updateOne(
  { email: "seu-email@exemplo.com" },
  { $set: { role: "admin" } }
)
```

---

## Variáveis de ambiente

### Backend

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP da API (padrão: `3001`). |
| `JWT_SECRET` | Segredo para assinatura do JWT. **Obrigatório** quando `NODE_ENV=production`. Use um valor longo e aleatório (veja [Gerar JWT_SECRET](#gerar-jwt_secret)). |
| `MONGODB_URI` | URI de conexão MongoDB (**obrigatória**). Local com Docker: `mongodb://root:<senha>@127.0.0.1:27017/conos?authSource=admin`. Produção: URI do Atlas (`mongodb+srv://...`). |
| `NODE_ENV` | `production` ativa exigência de `JWT_SECRET`. |
| `ALLOWED_ORIGINS` | Lista separada por vírgulas de origens permitidas no CORS (recomendado em produção). Se vazio, o CORS fica permissivo (adequado só para desenvolvimento). |

### Gerar JWT_SECRET

Use um segredo **único por ambiente** (desenvolvimento, staging, produção). Não reutilize senhas de banco nem commite o valor no Git.

**Windows (PowerShell)** — gera 48 bytes aleatórios em Base64:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Copie a saída para `backend/.env` (`JWT_SECRET=...`) ou atribua no shell: `$env:JWT_SECRET="<saída>"`.

**Linux / macOS (bash)** — alternativa equivalente:

```bash
openssl rand -base64 48
```

---

### Frontend

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL base da API. Se omitida, o código usa `http://localhost:3001`. |

---

## Banco de dados

Em **produção**, os dados ficam no **MongoDB Atlas** (database `conos`). Em **desenvolvimento**, use o MongoDB do Docker Compose ou uma URI apontando para o Atlas (com IP liberado na allowlist, se necessário).

Principais **coleções** (índices garantidos na subida da API via `ensureIndexes` em [`backend/models/indexes.ts`](backend/models/indexes.ts)):

- **usuarios** — autenticação e papel (`admin` / `viewer`).
- **medications** — lotes e quantidades.
- **retira_medications** — retiradas vinculadas a usuário e medicamento.
- **movimentacoes** — entradas e saídas.
- **pacientes** — cadastro assistencial.
- **paciente_medicamentos** — vários medicamentos por paciente.
- **paciente_retornos** — histórico de retornos.
- **medication_product_catalog** — catálogo de produtos (GTIN).
- **counters** — sequências numéricas para IDs.

Migração pontual de dados MySQL → MongoDB: `npm run migrate:mysql-to-mongo` (requer MySQL de origem e `MONGODB_URI`). SQL legado: [`backend/migrations/README-MIGRATIONS.md`](backend/migrations/README-MIGRATIONS.md).

---

## Docker

O [`docker-compose.yml`](docker-compose.yml) na raiz sobe o **MongoDB** (imagem `mongo:8.0.23`) como **replica set de um nó** (`rs0`), igual ao Atlas — necessário para operações com transação (excluir medicamento, retiradas, etc.). Volume `conos_mongo_data`, porta **27017**. **Não** inclui API nem frontend.

1. Copie [`.env.example`](.env.example) para `.env` e preencha `MONGO_ROOT_PASSWORD`.
2. `docker compose up -d` — só o container **`conos-mongo`** (`db`) fica rodando; é o único necessário no dia a dia.
3. Configure o backend com `MONGODB_URI` (ver [`backend/.env.example`](backend/.env.example)), com `&replicaSet=rs0` na URI local.

**Primeira vez** (ou após `docker compose down -v`), inicie o replica set **uma vez** (senha = `MONGO_ROOT_PASSWORD` do `.env`):

```powershell
cd C:\Users\guilh\Documents\GithubCloud\conos
docker cp docker/mongo/init-replica-set.js conos-mongo:/tmp/init-replica-set.js
docker exec conos-mongo mongosh -u root -p "SUA_SENHA" --authenticationDatabase admin --file /tmp/init-replica-set.js
```

Mensagem esperada: `Replica set rs0 inicializado` ou `Replica set já inicializado`. Depois disso, transações (ex.: excluir medicamento) funcionam.

Se aparecer `Transaction numbers are only allowed on a replica set`, o replica set ainda não foi iniciado — rode os comandos acima (dados no volume são mantidos).

Os arquivos [`backend/Dockerfile`](backend/Dockerfile) e [`frontend/Dockerfile`](frontend/Dockerfile) permanecem para **deploy** (por exemplo Cloud Run); o Compose local **não** os utiliza.

O arquivo `.env` está no [`.gitignore`](.gitignore) da raiz — não commite senhas.

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
- [Migrations MySQL (legado)](backend/migrations/README-MIGRATIONS.md) — SQL histórico; schema ativo é MongoDB.
- [Dados para testes](docs/DADOS-PARA-TESTES.md) — complemento ao guia de testes, se aplicável.

---

## Scripts úteis

| Pasta | Comando | Descrição |
|-------|---------|-----------|
| `backend` | `npm run dev` | API com `tsx watch` (hot reload). |
| `backend` | `npm run build` / `npm start` | Compila TypeScript e executa `dist/`. |
| `backend` | `npm run test:db` | Testa conexão MongoDB (`MONGODB_URI`). |
| `frontend` | `npm run dev` | Servidor Vite. |
| `frontend` | `npm run build` | Build de produção em `dist/`. |
| `frontend` | `npm run preview` | Preview do build. |
| `frontend` | `npm run lint` | ESLint. |

---

## Licença e metadados

O pacote do backend declara licença **ISC** no `package.json`. O frontend está marcado como **private**. Ajuste licenciamento e metadados conforme a política da sua organização.
