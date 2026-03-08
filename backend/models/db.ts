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
    medicamento_nome VARCHAR(255) NOT NULL,
    medicamento_concentracao VARCHAR(100) NOT NULL,
    consumo_diario DECIMAL(10,2) NOT NULL,
    observacoes TEXT NULL,
    telefone VARCHAR(50) NOT NULL DEFAULT '',
    data_liberacao DATE NOT NULL,
    retorna_servico TINYINT(1) NOT NULL,
    tipo_retorno VARCHAR(50) NULL,
    UNIQUE KEY uk_pacientes_prontuario (prontuario),
    KEY idx_pacientes_medicamento (medicamento_nome, medicamento_concentracao)
  )
`;

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
    return;
  }
  console.log("✅ Conectado ao banco MySQL com sucesso!");
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
      connection.release();
    });
  });
});

export default db;
