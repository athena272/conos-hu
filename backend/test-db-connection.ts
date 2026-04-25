/**
 * Testa conexão com MongoDB (MONGODB_URI).
 * Execute: pnpm run test:db
 */

import { connectMongo } from "./models/mongo";

async function testConnection(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("❌ Defina a variável de ambiente MONGODB_URI.");
    process.exit(1);
  }

  console.log("🔍 Testando conexão com MongoDB...");
  console.log("");

  try {
    const db = await connectMongo();
    await db.command({ ping: 1 });
    console.log("✅ Conexão estabelecida com sucesso (ping).");
    process.exit(0);
  } catch (err) {
    const error = err as Error;
    console.error("❌ Falha na conexão com o MongoDB.");
    console.error("");
    console.error("   Detalhes:", error.message);
    process.exit(1);
  }
}

testConnection();
