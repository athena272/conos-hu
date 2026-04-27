import type { ClientSession } from "mongodb";
import { coll } from "./mongo";

type CounterDoc = { _id: string; seq: number };

export async function getNextId(name: string, session?: ClientSession): Promise<number> {
  const col = coll<CounterDoc>("counters");
  const doc = await col.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session }
  );
  if (!doc || typeof doc.seq !== "number") {
    throw new Error(`Falha ao obter sequência para ${name}`);
  }
  return doc.seq;
}
