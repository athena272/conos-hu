import { config } from "dotenv";
import path from "node:path";

/** Carrega `backend/.env` antes dos testes (pnpm test não lê .env sozinho). */
config({ path: path.resolve(process.cwd(), ".env") });
