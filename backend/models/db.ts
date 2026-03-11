import mysql from "mysql2";

// Cloud Run: usa Unix socket quando INSTANCE_CONNECTION_NAME está definido
// Local: usa host/porta (IP direto ou Auth Proxy em localhost)
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

const dbConfig = instanceConnectionName
  ? {
      socketPath: `/cloudsql/${instanceConnectionName}`,
      user: process.env.DB_USER || "conos",
      password: process.env.DB_PASSWORD || "C0no$US#r143",
      database: process.env.DB_NAME || "conos",
      connectionLimit: 10,
    }
  : {
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "conos",
      password: process.env.DB_PASSWORD || "C0no$US#r143",
      database: process.env.DB_NAME || "conos",
      connectionLimit: 10,
    };

const db = mysql.createPool(dbConfig);

// Ordem: tabelas base primeiro (sem FK), depois as que dependem delas
const USUARIOS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    idusuarios INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

const MEDICATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    lote VARCHAR(100) NOT NULL,
    quantidade INT NOT NULL,
    classificacao VARCHAR(100),
    concentracao VARCHAR(100) NOT NULL,
    forma ENUM('1', '2', '3', '4') NOT NULL,
    data_validade DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

const RETIRA_MEDICATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS retira_medications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    medication_id INT NOT NULL,
    usuario_id INT NOT NULL,
    quantidade INT NOT NULL,
    data_retirada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
  )
`;

const MOVIMENTACOES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('entrada', 'saida') NOT NULL,
    medication_id INT NOT NULL,
    quantidade INT NOT NULL,
    usuario_id INT NULL,
    data_movimentacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medication_id) REFERENCES medications(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(idusuarios)
  )
`;

const PACIENTES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS pacientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    prontuario BIGINT NOT NULL,
    apac VARCHAR(255) NOT NULL,
    diagnostico VARCHAR(500) NOT NULL,
    observacoes TEXT NULL,
    telefone VARCHAR(50) NOT NULL DEFAULT '',
    data_liberacao DATE NOT NULL,
    retorna_servico TINYINT(1) NOT NULL,
    tipo_retorno VARCHAR(50) NULL,
    UNIQUE KEY uk_pacientes_prontuario (prontuario)
  )
`;

const PACIENTE_MEDICAMENTOS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS paciente_medicamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    medicamento_nome VARCHAR(255) NOT NULL,
    medicamento_concentracao VARCHAR(100) NOT NULL,
    consumo_diario DECIMAL(10,2) NOT NULL,
    KEY idx_pm_paciente (paciente_id),
    KEY idx_pm_medicamento (medicamento_nome, medicamento_concentracao),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
  )
`;

const CHECK_OLD_PACIENTES_COLUMN =
  "SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes' AND COLUMN_NAME = 'medicamento_nome' LIMIT 1";

const MIGRATION_6_COPY =
  "INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario) SELECT id, medicamento_nome, medicamento_concentracao, consumo_diario FROM pacientes WHERE medicamento_nome IS NOT NULL AND medicamento_nome != '' AND medicamento_concentracao IS NOT NULL AND medicamento_concentracao != ''";

const MIGRATION_6_DROP_COLUMNS = `
  ALTER TABLE pacientes
  DROP COLUMN medicamento_nome,
  DROP COLUMN medicamento_concentracao,
  DROP COLUMN consumo_diario
`;

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
    return;
  }
  console.log("✅ Conectado ao banco MySQL com sucesso!");
  connection.query(USUARIOS_TABLE_SQL, (uErr) => {
    if (uErr) console.error("⚠️ Erro ao criar tabela usuarios (pode já existir):", uErr.message);
    else console.log("✅ Tabela usuarios verificada/criada.");
    connection.query(MEDICATIONS_TABLE_SQL, (mErr) => {
      if (mErr) console.error("⚠️ Erro ao criar tabela medications (pode já existir):", mErr.message);
      else console.log("✅ Tabela medications verificada/criada.");
      connection.query(RETIRA_MEDICATIONS_TABLE_SQL, (rErr) => {
        if (rErr) console.error("⚠️ Erro ao criar tabela retira_medications (pode já existir):", rErr.message);
        else console.log("✅ Tabela retira_medications verificada/criada.");
        connection.query(MOVIMENTACOES_TABLE_SQL, (movErr) => {
          if (movErr) {
            console.error("⚠️ Erro ao criar tabela movimentacoes (pode já existir):", movErr.message);
          } else {
            console.log("✅ Tabela movimentacoes verificada/criada.");
          }
          connection.query(PACIENTES_TABLE_SQL, (pacErr) => {
      if (pacErr) {
        console.error("⚠️ Erro ao criar tabela pacientes (pode já existir):", pacErr.message);
      } else {
        console.log("✅ Tabela pacientes verificada/criada.");
      }
      connection.query(PACIENTE_MEDICAMENTOS_TABLE_SQL, (pmErr) => {
        if (pmErr) {
          console.error("⚠️ Erro ao criar tabela paciente_medicamentos (pode já existir):", pmErr.message);
        } else {
          console.log("✅ Tabela paciente_medicamentos verificada/criada.");
        }
        connection.query(
          { sql: CHECK_OLD_PACIENTES_COLUMN },
          (checkErr, checkRows) => {
          const rows = checkRows as { ok?: number }[] | undefined;
          const hasOldColumn = !checkErr && Array.isArray(rows) && rows.length > 0;
          if (!hasOldColumn) {
            connection.release();
            return;
          }
          console.log("🔄 Migration 6: base com schema antigo de pacientes. Aplicando migração...");
          connection.query(MIGRATION_6_COPY, (copyErr) => {
            if (copyErr) {
              console.error("⚠️ Erro ao copiar dados para paciente_medicamentos:", copyErr.message);
              connection.release();
              return;
            }
            connection.query("ALTER TABLE pacientes DROP INDEX idx_pacientes_medicamento", (idxErr) => {
              if (idxErr && (idxErr as { code?: string }).code !== "ER_CANT_DROP_FIELD_OR_KEY") {
                console.warn("⚠️ Índice idx_pacientes_medicamento:", (idxErr as Error).message);
              }
              connection.query(MIGRATION_6_DROP_COLUMNS, (dropErr) => {
                if (dropErr) {
                  console.error("⚠️ Erro ao remover colunas antigas de pacientes (tente rodar a migration manualmente):", dropErr.message);
                } else {
                  console.log("✅ Migration 6 aplicada: colunas de medicamento removidas de pacientes.");
                }
                connection.release();
              });
            });
          });
        });
      });
    });
  });
  });
  });
  });
});

export default db;
