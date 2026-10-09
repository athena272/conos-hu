import { config } from "dotenv";
import path from "node:path";

/** Carrega `backend/.env` quando a API sobe (dev, start, serverless). */
config({ path: path.resolve(process.cwd(), ".env") });
