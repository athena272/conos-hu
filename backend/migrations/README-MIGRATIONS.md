# Migrations do banco de dados (legado MySQL)

> **Schema ativo:** MongoDB (database `conos` no Atlas ou local via Docker). Índices criados na subida da API em [`backend/models/indexes.ts`](../models/indexes.ts). Conexão: `MONGODB_URI` em [`backend/models/mongo.ts`](../models/mongo.ts).

Este diretório contém arquivos **SQL históricos** da época em que o projeto usava MySQL. Mantidos para referência e migração pontual (`npm run migrate:mysql-to-mongo`). **Não** use estes scripts no fluxo diário de desenvolvimento com MongoDB.

---

## Schema MongoDB (atual)

- Coleções criadas no primeiro uso; índices garantidos por `ensureIndexes()` ao conectar.
- Para dados antigos em MySQL: [`backend/scripts/mysql-to-mongo.ts`](../scripts/mysql-to-mongo.ts) com `MONGODB_URI` e variáveis `SOURCE_MYSQL_*`.

---

## Conteúdo legado abaixo (MySQL / Cloud SQL)

As seções a seguir descrevem o fluxo antigo (MySQL, `db.ts`, Cloud Run + Cloud SQL). Podem estar desatualizadas em relação ao deploy atual (MongoDB Atlas).

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

---

## Migration 6: Paciente com múltiplos medicamentos

### Execução automática no deploy (GCP / qualquer ambiente)

A partir desta versão, a **migration 6 roda sozinha** quando a API sobe. Em `backend/models/db.ts`, logo após criar/verificar as tabelas, o código:

1. Verifica se a tabela `pacientes` ainda tem a coluna `medicamento_nome` (schema antigo).
2. Se tiver: cria `paciente_medicamentos` (se não existir), copia os dados de `pacientes` para `paciente_medicamentos`, remove o índice `idx_pacientes_medicamento` (se existir) e remove as colunas `medicamento_nome`, `medicamento_concentracao` e `consumo_diario` de `pacientes`.

Ou seja: **no próximo build/deploy no GCP**, ao subir a revisão da API, a migration será aplicada no banco ao qual a API se conecta. Não é necessário rodar SQL manualmente no Cloud SQL, a não ser que a migração automática falhe (veja logs do Cloud Run).

### Se a migração automática falhar (execução manual)

Se nos logs do Cloud Run aparecer erro ao aplicar a migration 6, ou se por algum motivo precisar rodar manualmente no banco (Cloud SQL ou local), use os passos abaixo.

### Passos manuais (Cloud SQL via Cloud Shell)

1. Conecte ao instance e ao banco (ex.: `gcloud sql connect NOME_INSTANCIA --user=conos --database=conos`).
2. Execute, **na ordem**, o conteúdo de `backend/migrations/6-paciente_medicamentos.sql`:

   **Passo 1 – Criar tabela**
   ```sql
   CREATE TABLE IF NOT EXISTS paciente_medicamentos (
     id INT AUTO_INCREMENT PRIMARY KEY,
     paciente_id INT NOT NULL,
     medicamento_nome VARCHAR(255) NOT NULL,
     medicamento_concentracao VARCHAR(100) NOT NULL,
     consumo_diario DECIMAL(10,2) NOT NULL,
     KEY idx_pm_paciente (paciente_id),
     KEY idx_pm_medicamento (medicamento_nome, medicamento_concentracao),
     FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
   );
   ```

   **Passo 2 – Copiar dados**
   ```sql
   INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario)
   SELECT id, medicamento_nome, medicamento_concentracao, consumo_diario
   FROM pacientes
   WHERE medicamento_nome IS NOT NULL AND medicamento_nome != ''
     AND medicamento_concentracao IS NOT NULL AND medicamento_concentracao != '';
   ```

   **Passo 3 – Remover colunas de `pacientes`**  
   Se der erro de índice inexistente, rode primeiro `ALTER TABLE pacientes DROP INDEX idx_pacientes_medicamento;` (se existir) e depois:
   ```sql
   ALTER TABLE pacientes
     DROP COLUMN medicamento_nome,
     DROP COLUMN medicamento_concentracao,
     DROP COLUMN consumo_diario;
   ```
   (Se o índice `idx_pacientes_medicamento` existir, inclua `DROP INDEX idx_pacientes_medicamento` no mesmo `ALTER` ou em um anterior.)

3. Confirme: `SHOW TABLES LIKE 'paciente_medicamentos';` e `DESCRIBE pacientes;` (não deve listar `medicamento_nome`).

Depois disso, o POST em `/pacientes` com `medicamentos: [...]` passará a funcionar em produção.

---

## Migration 8: coluna `role` em `usuarios` (admin / viewer)

### Execução automática no deploy

Em [`backend/models/db.ts`](../models/db.ts), na subida da API, após criar/verificar `usuarios`, o código verifica se existe a coluna `role` em `INFORMATION_SCHEMA`; se não existir, executa `ALTER TABLE usuarios ADD COLUMN role ENUM('admin','viewer') NOT NULL DEFAULT 'viewer'`.

### Dados existentes: definir um administrador

Após a coluna existir, todos os usuários antigos ficam com `role = 'viewer'` (DEFAULT). Promova **um** e-mail para admin no MySQL (substitua pelo e-mail real):

```sql
UPDATE usuarios SET role = 'viewer';
UPDATE usuarios SET role = 'admin' WHERE email = 'seu-admin@exemplo.com';
```

Em deploy automatizado, você pode usar a variável de ambiente **`ADMIN_EMAIL`** apenas como **documentação** do e-mail a usar nesse segundo `UPDATE` (o aplicativo não executa esse `UPDATE` sozinho por segurança).

Arquivo SQL de referência: [`8-add_usuario_role.sql`](8-add_usuario_role.sql).
