/**
 * Script para testar conexão com o banco MySQL
 * Execute: pnpm run test:db
 */

import mysql from "mysql2/promise";

const config = {
  host: process.env.DB_HOST || "10.20.8.49",
  user: process.env.DB_USER || "conos",
  password: process.env.DB_PASSWORD || "C0no$US#r143",
  database: process.env.DB_NAME || "conos",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  connectTimeout: 10000,
};

async function testConnection(): Promise<void> {
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
    const error = err as NodeJS.ErrnoException;
    console.error("❌ Falha na conexão com o banco.");
    console.error("");
    console.error("   Detalhes do erro:", error.message);
    if (error.code) console.error("   Código:", error.code);

    if (error.code === "ECONNREFUSED") {
      console.error("");
      console.error("   Possíveis causas:");
      console.error("   - O servidor MySQL não está rodando");
      console.error("   - O host/porta estão incorretos");
      console.error("   - Firewall bloqueando a porta 3306");
    } else if (error.code === "ENOTFOUND" || error.code === "ETIMEDOUT") {
      console.error("");
      console.error("   Possíveis causas:");
      console.error("   - Host inacessível (rede, VPN desligada)");
      console.error("   - IP incorreto ou servidor offline");
    }

    process.exit(1);
  }
}

testConnection();
