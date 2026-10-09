/**
 * Garante que o MongoDB do ambiente de teste aceita transações multi-documento.
 * Controllers (retira, medicamentos, pacientes) usam `session.withTransaction`.
 * Sem replica set, o driver falha com:
 * "Transaction numbers are only allowed on a replica set member or mongos".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { coll, connectMongo, disconnectMongo, getDb } from "../models/mongo";

const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
const run = hasMongoUri ? test : test.skip;

run("MongoDB aceita withTransaction (replica set obrigatório)", async () => {
  await connectMongo();
  const db = getDb();
  const session = db.client.startSession();
  const marker = `txn_probe_${Date.now()}`;
  try {
    await session.withTransaction(async () => {
      await coll<{ _id: string; ok: boolean }>("_ci_txn_probe").insertOne(
        { _id: marker, ok: true },
        { session },
      );
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    assert.fail(
      `withTransaction falhou — o Mongo precisa ser replica set (ex.: ?replicaSet=rs0). Detalhe: ${message}`,
    );
  } finally {
    await session.endSession();
    await coll("_ci_txn_probe").deleteOne({ _id: marker }).catch(() => undefined);
  }
});

test.after(async () => {
  await disconnectMongo();
});
