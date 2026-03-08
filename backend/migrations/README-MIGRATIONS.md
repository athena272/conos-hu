# Migrations do banco de dados

Este diretório contém os arquivos SQL de migration. No **GCP (Cloud Run)** as tabelas necessárias são criadas **na subida da aplicação** (ver abaixo). Em ambiente local ou para rodar manualmente, use as opções abaixo.

---

## Migrations ao subir no GCP (Cloud Run)

**Não é necessário alterar o `cloudbuild.yaml`.**

O backend está configurado para criar as tabelas ao iniciar:

- Em **`backend/models/db.ts`**, na primeira conexão ao MySQL, o código executa:
  - `CREATE TABLE IF NOT EXISTS movimentacoes ...`
  - `CREATE TABLE IF NOT EXISTS pacientes ...`

Assim, quando o Cloud Run sobe uma nova revisão, a API conecta ao banco e garante que essas tabelas existam. Não há passo de migration no Cloud Build.

**Para adicionar uma nova tabela no futuro:**

1. Crie o arquivo em `backend/migrations/N-create_table_nome.sql` (para referência e para rodar manualmente em outros ambientes).
2. No `backend/models/db.ts`, adicione uma constante com o `CREATE TABLE IF NOT EXISTS ...` e chame esse SQL no mesmo bloco de inicialização (junto com `movimentacoes` e `pacientes`), antes de dar `connection.release()`.

**Se um dia quiser rodar migrations no Cloud Build** (por exemplo, um script que aplica todos os `.sql` da pasta em ordem), seria preciso:

- Um step no `cloudbuild.yaml` que execute esse script **com acesso ao Cloud SQL** (por exemplo, usando Cloud SQL Proxy em um container ou VPC connector).
- O Cloud Build em si não tem acesso direto ao socket do Cloud SQL; por isso a abordagem atual (criar tabelas na subida do app) é a mais simples.

---

## Como rodar a migration da tabela `movimentacoes` (manual)

A migration `4-create_table_movimentacoes.sql` cria a tabela de movimentações (entrada/saída) de medicamentos. Escolha uma das opções abaixo conforme onde está o seu MySQL.

---

## Opção 1: Banco MySQL **local** (na sua máquina)

1. Abra um terminal (PowerShell, CMD ou Git Bash) na pasta do projeto.

2. Conecte ao MySQL com o usuário e o banco que a API usa (por padrão: usuário `conos`, banco `conos`):

   ```bash
   mysql -u conos -p conos
   ```

   (Digite a senha quando pedir. Se a senha for a padrão do projeto: `C0no$US#r143`.)

3. Cole e execute o SQL abaixo (ou rode o arquivo):

   **Colar o SQL direto no console do MySQL:**

   ```sql
   CREATE TABLE movimentacoes (
       id INT AUTO_INCREMENT PRIMARY KEY,
       tipo ENUM('entrada', 'saida') NOT NULL,
       medication_id INT NOT NULL,
       quantidade INT NOT NULL,
       usuario_id INT NULL,
       data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (medication_id) REFERENCES medications(id),
       FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
   );
   ```

   **Ou rodar o arquivo da migration:**

   ```bash
   mysql -u conos -p conos < migrations/4-create_table_movimentacoes.sql
   ```

   (Execute esse comando a partir da pasta `backend`.)

4. Confirme que a tabela existe:

   ```sql
   SHOW TABLES LIKE 'movimentacoes';
   ```

   Depois pode sair do MySQL: `exit`.

---

## Opção 2: Banco no **Google Cloud SQL** (via Cloud Shell)

Use esta opção se a API em produção usa Cloud SQL (por exemplo no Cloud Run).

1. Abra o **Google Cloud Console** do seu projeto e abra o **Cloud Shell** (ícone de terminal no canto superior direito).

2. Conecte ao instance do Cloud SQL (substitua `NOME_INSTANCIA` e `PROJETO:REGIAO:INSTANCIA` pelos seus):

   ```bash
   gcloud sql connect NOME_INSTANCIA --user=conos --database=conos
   ```

   Ou, se precisar do formato de connection name:

   ```bash
   gcloud sql connect NOME_INSTANCIA --user=conos --database=conos --project=SEU_PROJETO
   ```

   Digite a senha do usuário `conos` quando solicitado.

3. No prompt do MySQL que abrir no Cloud Shell, cole e execute o mesmo SQL da Opção 1:

   ```sql
   CREATE TABLE movimentacoes (
       id INT AUTO_INCREMENT PRIMARY KEY,
       tipo ENUM('entrada', 'saida') NOT NULL,
       medication_id INT NOT NULL,
       quantidade INT NOT NULL,
       usuario_id INT NULL,
       data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (medication_id) REFERENCES medications(id),
       FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
   );
   ```

4. Confirme:

   ```sql
   SHOW TABLES LIKE 'movimentacoes';
   ```

   Depois digite `exit` para sair do cliente MySQL.

---

## Opção 3: Cloud SQL a partir da **sua máquina** (Cloud SQL Proxy)

Se você usa Cloud SQL Proxy no PC (por exemplo em `127.0.0.1:3306`):

1. Deixe o proxy conectado ao instance.

2. No terminal, na pasta `backend`:

   ```bash
   mysql -h 127.0.0.1 -P 3306 -u conos -p conos < migrations/4-create_table_movimentacoes.sql
   ```

   (Ajuste `-P 3306` se a porta do proxy for outra.)

---

## Resumo

| Onde está o banco?        | Onde rodar?        | Comando principal |
|--------------------------|--------------------|-------------------|
| MySQL na sua máquina     | Terminal local     | `mysql -u conos -p conos < migrations/4-create_table_movimentacoes.sql` (a partir de `backend`) |
| Google Cloud SQL         | **Cloud Shell**    | `gcloud sql connect ...` e depois colar o SQL acima |
| Cloud SQL via proxy local| Terminal local     | `mysql -h 127.0.0.1 -P 3306 -u conos -p conos < migrations/4-create_table_movimentacoes.sql` |

**Sim:** se o banco de produção for no Google Cloud, a forma mais direta é usar o **Cloud Shell**, conectar no instance com `gcloud sql connect` e colar o SQL da tabela `movimentacoes` no prompt do MySQL.
