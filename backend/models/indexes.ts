import type { Db } from "mongodb";

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection("usuarios").createIndex({ email: 1 }, { unique: true });
  await db.collection("medications").createIndex({ nome: 1, concentracao: 1 });
  await db.collection("medications").createIndex({ data_validade: 1 });
  await db.collection("medications").createIndex({ gtin: 1 }, { sparse: true });
  await db.collection("pacientes").createIndex({ prontuario: 1 }, { unique: true });
  await db.collection("paciente_medicamentos").createIndex({ paciente_id: 1 });
  await db.collection("paciente_medicamentos").createIndex({
    medicamento_nome: 1,
    medicamento_concentracao: 1,
  });
  await db.collection("paciente_retornos").createIndex({ paciente_id: 1 });
  await db.collection("retira_medications").createIndex({ paciente_id: 1 });
  await db.collection("retira_medications").createIndex({ medication_id: 1 });
  await db.collection("movimentacoes").createIndex({ medication_id: 1 });
  await db.collection("medication_product_catalog").createIndex({ gtin: 1 }, { unique: true });
}
