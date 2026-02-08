const mysql = require("mysql2");

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

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
  } else {
    console.log("✅ Conectado ao banco MySQL com sucesso!");
    connection.release();
  }
});

module.exports = db;