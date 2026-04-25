import { MongoClient, type Collection, type Db } from "mongodb";
import { ensureIndexes } from "./indexes";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) return database;
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }
  client = new MongoClient(uri);
  await client.connect();
  database = client.db();
  await ensureIndexes(database);
  return database;
}

export function getDb(): Db {
  if (!database) {
    throw new Error("MongoDB not connected; call connectMongo() first");
  }
  return database;
}

/** Coleções com `_id` numérico (ou esquema custom) — contorna o default `ObjectId` dos tipos do driver. */
export function coll<T extends object>(name: string): Collection<T> {
  return getDb().collection(name) as unknown as Collection<T>;
}
