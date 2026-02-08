/**
 * Script para testar conexão com o banco MySQL
 * Execute: node test-db-connection.js
 * Ou: npm run test:db
 */

const mysql = require("mysql2/promise");

const config = {
  host: process.env.DB_HOST || "10.20.8.49",
  user: process.env.DB_USER || "conos",
  password: process.env.DB_PASSWORD || "C0no$US#r143",
  database: process.env.DB_NAME || "conos",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  connectTimeout: 10000,
};

async function testConnection() {
  console.log("🔍 Testando conexão com o banco MySQL...");
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log("");

  try {
    const connection = await mysql.createConnection(config);
    await connection.ping();
    await connection.end();

    console.log("✅ Conexão estabelecida com sucesso!");
    console.log("   O banco está acessível e pronto para uso.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Falha na conexão com o banco.");
    console.error("");
    console.error("   Detalhes do erro:", err.message);
    if (err.code) console.error("   Código:", err.code);

    if (err.code === "ECONNREFUSED") {
      console.error("");
      console.error("   Possíveis causas:");
      console.error("   - O servidor MySQL não está rodando");
      console.error("   - O host/porta estão incorretos");
      console.error("   - Firewall bloqueando a porta 3306");
    } else if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      console.error("");
      console.error("   Possíveis causas:");
      console.error("   - Host inacessível (rede, VPN desligada)");
      console.error("   - IP incorreto ou servidor offline");
    }

    process.exit(1);
  }
}

testConnection();
