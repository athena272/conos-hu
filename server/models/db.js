const mysql = require("mysql2");

const dbConfig = {
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "conos",
  password: process.env.DB_PASSWORD || "C0no$US#r143",
  database: process.env.DB_NAME || "conos",
  port: process.env.DB_PORT || 3306,
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