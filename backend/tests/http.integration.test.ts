import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../app";
import { coll, connectMongo, disconnectMongo } from "../models/mongo";
import { getNextId } from "../models/sequences";

const hasMongoUri = Boolean(process.env.MONGODB_URI?.trim());
const run = hasMongoUri ? test : test.skip;
let mongoReady = false;

const createdEmails: string[] = [];

type RegisterResponse = {
  message: string;
  userId: number;
  email: string;
  role: "admin" | "viewer";
  token: string;
};

run("integration setup connects to MongoDB", async () => {
  try {
    await connectMongo();
    mongoReady = true;
  } catch (err) {
    mongoReady = false;
    console.warn("Mongo indisponivel para testes de integracao, casos serao pulados:", (err as Error).message);
  }
});

function skipIfMongoUnavailable(t: { skip: (reason?: string) => void }): boolean {
  if (!mongoReady) {
    t.skip("MongoDB indisponivel neste ambiente de teste");
    return true;
  }
  return false;
}

run("POST /register and POST /login work end-to-end", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const email = `it_user_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  const registerRes = await request(app).post("/register").send({ email, password });
  assert.equal(registerRes.status, 201);
  const regBody = registerRes.body as RegisterResponse;
  assert.equal(regBody.email, email);
  assert.equal(regBody.role, "viewer");
  assert.ok(typeof regBody.token === "string" && regBody.token.length > 10);

  const loginRes = await request(app).post("/login").send({ email, password });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.email, email);
  assert.ok(typeof loginRes.body.token === "string" && loginRes.body.token.length > 10);
});

run("GET protected endpoints require bearer token", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const medsRes = await request(app).get("/medications");
  assert.equal(medsRes.status, 401);
  assert.equal(medsRes.body.message, "Não autenticado");

  const pacientesRes = await request(app).get("/pacientes");
  assert.equal(pacientesRes.status, 401);
  assert.equal(pacientesRes.body.message, "Não autenticado");
});

run("viewer token can read protected lists", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const email = `it_viewer_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  const registerRes = await request(app).post("/register").send({ email, password });
  assert.equal(registerRes.status, 201);
  const token = (registerRes.body as RegisterResponse).token;

  const medsRes = await request(app).get("/medications").set("Authorization", `Bearer ${token}`);
  assert.equal(medsRes.status, 200);
  assert.ok(Array.isArray(medsRes.body));

  const pacientesRes = await request(app).get("/pacientes").set("Authorization", `Bearer ${token}`);
  assert.equal(pacientesRes.status, 200);
  assert.ok(Array.isArray(pacientesRes.body));
});

run("viewer cannot create medication (admin only)", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const email = `it_viewer2_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  const registerRes = await request(app).post("/register").send({ email, password });
  assert.equal(registerRes.status, 201);
  const token = (registerRes.body as RegisterResponse).token;

  const createRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: "IT MEDICAMENTO",
      lote: "IT-LOTE",
      quantidade: 1,
      classificacao: "Teste",
      concentracao: "500mg",
      forma: "Comprimido",
      data_validade: "2030-12-31",
    });

  assert.equal(createRes.status, 403);
  assert.equal(createRes.body.message, "Acesso negado");
});

run("admin can create medication and paciente", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const email = `it_admin_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  const adminId = await getNextId("usuarios");
  const hash = await bcrypt.hash(password, 10);
  await coll<{
    _id: number;
    email: string;
    password: string;
    role: "admin";
    created_at: Date;
  }>("usuarios").insertOne({
    _id: adminId,
    email,
    password: hash,
    role: "admin",
    created_at: new Date(),
  });

  const loginRes = await request(app).post("/login").send({ email, password });
  assert.equal(loginRes.status, 200);
  const token = loginRes.body.token as string;
  assert.ok(token.length > 10);

  const medName = `IT_MED_${Date.now()}`;
  const medConcentration = "500mg";
  const medCreateRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: medName,
      lote: `ITLOTE-${Date.now()}`,
      quantidade: 5,
      classificacao: "Teste",
      concentracao: medConcentration,
      forma: "Comprimido",
      data_validade: "2031-01-01",
    });
  assert.equal(medCreateRes.status, 201);

  const pacienteProntuario = Math.floor(Date.now() / 1000);
  const pacienteCreateRes = await request(app)
    .post("/pacientes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: `IT Paciente ${Date.now()}`,
      prontuario: pacienteProntuario,
      apac: `IT-APAC-${Date.now()}`,
      diagnostico: "Teste de integração",
      medicamentos: [
        {
          medicamento_nome: medName,
          medicamento_concentracao: medConcentration,
          consumo_diario: 1,
          regime_consumo: "diario",
        },
      ],
      observacoes: "Teste automatizado",
      telefone: "999999999",
      data_liberacao: "2026-01-01",
      retorna_servico: false,
    });
  assert.equal(pacienteCreateRes.status, 201);

  const listRes = await request(app)
    .get("/pacientes")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  const lista = listRes.body as Array<{
    prontuario: number;
    medicamentos: Array<{ previsao_mg?: { mg_dia_previsto: number | null } }>;
  }>;
  const paciente = lista.find((p) => p.prontuario === pacienteProntuario);
  assert.ok(paciente);
  assert.equal(paciente!.medicamentos[0]?.previsao_mg?.mg_dia_previsto, 500);
  assert.ok(
    paciente!.medicamentos[0]?.previsao_mg != null,
    "previsao_mg deve estar presente em cada medicamento (nao omitir o campo)",
  );

  const resumoRes = await request(app)
    .get("/pacientes/resumo-por-medicamento")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(resumoRes.status, 200);
  const resumo = resumoRes.body as Array<{
    medicamento_nome: string;
    medicamento_concentracao: string;
    previsaoMgTotal?: { mg_dia_previsto: number | null };
    mesesEstoque: number | null;
    mesesEstoqueMg: number | null;
  }>;
  const rowResumo = resumo.find(
    (r) => r.medicamento_nome === medName && r.medicamento_concentracao === medConcentration,
  );
  assert.ok(rowResumo, "medicamento criado deve aparecer no resumo");
  assert.equal(rowResumo!.previsaoMgTotal?.mg_dia_previsto, 500);
  assert.ok(
    rowResumo!.mesesEstoqueMg === null || typeof rowResumo!.mesesEstoqueMg === "number",
    "mesesEstoqueMg deve ser numero ou null",
  );

  const porMgRes = await request(app)
    .post("/pacientes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: `IT Paciente MG ${Date.now()}`,
      prontuario: pacienteProntuario + 1,
      apac: `IT-APAC-MG-${Date.now()}`,
      diagnostico: "Teste por miligrama",
      medicamentos: [
        {
          medicamento_nome: medName,
          medicamento_concentracao: medConcentration,
          consumo_diario: 0,
          regime_consumo: "por_miligrama",
          consumo_mg_diario: 750,
        },
      ],
      observacoes: null,
      telefone: "",
      data_liberacao: "2026-01-01",
      retorna_servico: false,
    });
  assert.equal(porMgRes.status, 201);

  const impactRes = await request(app)
    .get("/pacientes/impacto-estoque")
    .set("Authorization", `Bearer ${token}`)
    .query({
      medicamento_nome: medName,
      medicamento_concentracao: medConcentration,
      regime_consumo: "por_miligrama",
      consumo_mg_diario: "750",
    });
  assert.equal(impactRes.status, 200);
  assert.ok(typeof impactRes.body.consumoMgDiarioComNovo === "number");
  assert.ok(typeof impactRes.body.mesesEstoqueMgComNovo === "number" || impactRes.body.mesesEstoqueMgComNovo === null);
});

test.after(async () => {
  if (!hasMongoUri || !mongoReady) {
    await disconnectMongo();
    return;
  }
  if (createdEmails.length > 0) {
    await coll<{ email: string }>("usuarios").deleteMany({ email: { $in: createdEmails } });
  }
  await disconnectMongo();
});

