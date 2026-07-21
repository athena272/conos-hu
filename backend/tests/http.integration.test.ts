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
  role: "admin" | "admin_medicamentos" | "admin_pacientes" | "viewer";
  token: string;
};

async function insertUserWithRole(
  email: string,
  password: string,
  role: "admin" | "admin_medicamentos" | "admin_pacientes" | "viewer",
): Promise<number> {
  const userId = await getNextId("usuarios");
  const hash = await bcrypt.hash(password, 10);
  await coll<{
    _id: number;
    email: string;
    password: string;
    role: typeof role;
    created_at: Date;
  }>("usuarios").insertOne({
    _id: userId,
    email,
    password: hash,
    role,
    created_at: new Date(),
  });
  return userId;
}

async function loginAs(email: string, password: string): Promise<string> {
  const loginRes = await request(app).post("/login").send({ email, password });
  assert.equal(loginRes.status, 200);
  return loginRes.body.token as string;
}

const minimalMedicationPayload = (suffix: string) => ({
  nome: `IT_MED_${suffix}`,
  lote: `ITLOTE-${suffix}`,
  quantidade: 1,
  classificacao: "Teste",
  concentracao: "500mg",
  forma: "Comprimido",
  data_validade: "2030-12-31",
});

const minimalPacientePayload = (suffix: string, medName: string) => ({
  nome: `IT Paciente ${suffix}`,
  prontuario: Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000),
  apac: `IT-APAC-${suffix}`,
  diagnostico: "Teste de integração",
  medicamentos: [
    {
      medicamento_nome: medName,
      medicamento_concentracao: "500mg",
      consumo_diario: 1,
      regime_consumo: "diario",
    },
  ],
  observacoes: "Teste automatizado",
  telefone: "999999999",
  data_liberacao: "2026-01-01",
  retorna_servico: false,
});

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

run("retira funciona sem paciente e valida paciente quando informado", async (t) => {
  if (skipIfMongoUnavailable(t)) return;
  const email = `it_retira_${Date.now()}@example.com`;
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

  const medName = `IT_RETIRA_${Date.now()}`;
  const medLote = `ITLOTE-RET-${Date.now()}`;
  const createRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: medName,
      lote: medLote,
      quantidade: 10,
      classificacao: "Teste",
      concentracao: "500mg",
      forma: "Comprimido",
      data_validade: "2031-01-01",
    });
  assert.equal(createRes.status, 201);

  const medDoc = await coll<{ _id: number; quantidade: number }>("medications").findOne({
    nome: medName,
    lote: medLote,
  });
  assert.ok(medDoc, "medicamento criado deve existir");
  const medicationId = medDoc!._id;

  // 1) Retirada SEM paciente deve funcionar e baixar o estoque
  const semPacienteRes = await request(app)
    .post("/retira")
    .set("Authorization", `Bearer ${token}`)
    .send({ medication_id: medicationId, quantidade: 2 });
  assert.equal(semPacienteRes.status, 200, "retirada sem paciente deve funcionar");

  const aposSem = await coll<{ _id: number; quantidade: number }>("medications").findOne({
    _id: medicationId,
  });
  assert.equal(aposSem!.quantidade, 8, "estoque deve baixar mesmo sem paciente vinculado");

  const prontuario = Math.floor(Date.now() / 1000) + 5;
  const pacienteRes = await request(app)
    .post("/pacientes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      nome: `IT Paciente Retira ${Date.now()}`,
      prontuario,
      apac: `IT-APAC-RET-${Date.now()}`,
      diagnostico: "Teste retira",
      medicamentos: [
        {
          medicamento_nome: medName,
          medicamento_concentracao: "500mg",
          consumo_diario: 1,
          regime_consumo: "diario",
        },
      ],
      observacoes: null,
      telefone: "",
      data_liberacao: "2026-01-01",
      retorna_servico: false,
    });
  assert.equal(pacienteRes.status, 201);
  const pacienteId = pacienteRes.body.id as number;

  // 2) Retirada COM paciente válido deve funcionar e gravar o vínculo
  const comPacienteRes = await request(app)
    .post("/retira")
    .set("Authorization", `Bearer ${token}`)
    .send({ medication_id: medicationId, quantidade: 1, paciente_id: pacienteId });
  assert.equal(comPacienteRes.status, 200, "retirada com paciente deve funcionar");

  const retiraComPaciente = await coll<{
    medication_id: number;
    paciente_id: number | null;
  }>("retira_medications").findOne({ medication_id: medicationId, paciente_id: pacienteId });
  assert.ok(retiraComPaciente, "deve gravar a retirada vinculada ao paciente");

  // 3) Retirada com paciente inexistente deve retornar 400
  const inexistenteRes = await request(app)
    .post("/retira")
    .set("Authorization", `Bearer ${token}`)
    .send({ medication_id: medicationId, quantidade: 1, paciente_id: 999999999 });
  assert.equal(inexistenteRes.status, 400, "paciente inexistente deve retornar 400");

  await coll<{ medication_id: number }>("retira_medications").deleteMany({ medication_id: medicationId });
  await coll<{ _id: number }>("medications").deleteMany({ _id: medicationId });
  await coll<{ paciente_id: number }>("paciente_medicamentos").deleteMany({ paciente_id: pacienteId });
  await coll<{ _id: number }>("pacientes").deleteMany({ _id: pacienteId });
});

run("GET /eventos exige auth admin e registra eventos de escrita", async (t) => {
  if (skipIfMongoUnavailable(t)) return;

  const unauthRes = await request(app).get("/eventos");
  assert.equal(unauthRes.status, 401);

  const viewerEmail = `it_eventos_viewer_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(viewerEmail);

  const viewerReg = await request(app).post("/register").send({ email: viewerEmail, password });
  assert.equal(viewerReg.status, 201);
  const viewerToken = (viewerReg.body as RegisterResponse).token;

  const viewerRes = await request(app)
    .get("/eventos")
    .set("Authorization", `Bearer ${viewerToken}`);
  assert.equal(viewerRes.status, 403);

  const adminEmail = `it_eventos_admin_${Date.now()}@example.com`;
  createdEmails.push(adminEmail);
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
    email: adminEmail,
    password: hash,
    role: "admin",
    created_at: new Date(),
  });

  const loginRes = await request(app).post("/login").send({ email: adminEmail, password });
  assert.equal(loginRes.status, 200);
  const adminToken = loginRes.body.token as string;

  const medName = `IT_EVENTOS_${Date.now()}`;
  const medLote = `ITLOTE-EVT-${Date.now()}`;
  const createRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      nome: medName,
      lote: medLote,
      quantidade: 5,
      classificacao: "Teste",
      concentracao: "100mg",
      forma: "Comprimido",
      data_validade: "2031-06-01",
    });
  assert.equal(createRes.status, 201);

  const medDoc = await coll<{ _id: number }>("medications").findOne({ nome: medName, lote: medLote });
  assert.ok(medDoc);

  const eventosRes = await request(app)
    .get("/eventos")
    .query({ acao: "medication.create", limit: 20 })
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(eventosRes.status, 200);

  const eventos = eventosRes.body as Array<{
    id: number;
    acao: string;
    entidade_tipo: string;
    entidade_id: number | null;
    usuario_id: number;
    usuario_email: string | null;
    detalhes: Record<string, unknown>;
  }>;
  const created = eventos.find(
    (e) => e.entidade_id === medDoc!._id && e.acao === "medication.create"
  );
  assert.ok(created, "deve existir evento medication.create");
  assert.equal(created!.usuario_id, adminId);
  assert.equal(created!.usuario_email, adminEmail);
  assert.equal(created!.entidade_tipo, "medication");
  assert.equal(created!.detalhes.nome, medName);

  const today = new Date().toISOString().slice(0, 10);
  const byEntidadeRes = await request(app)
    .get("/eventos")
    .query({
      entidade_tipo: "medication",
      data_inicio: today,
      data_fim: today,
      limit: 50,
    })
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(byEntidadeRes.status, 200);
  const byEntidade = byEntidadeRes.body as Array<{ entidade_id: number | null; acao: string }>;
  assert.ok(
    byEntidade.some((e) => e.entidade_id === medDoc!._id && e.acao === "medication.create"),
    "filtro por entidade_tipo e período deve incluir o evento criado"
  );

  const badDateRes = await request(app)
    .get("/eventos")
    .query({ data_inicio: "20-07-2026" })
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(badDateRes.status, 400);

  await coll<{ _id: number }>("eventos").deleteMany({ entidade_id: medDoc!._id, entidade_tipo: "medication" });
  await coll<{ medication_id: number }>("movimentacoes").deleteMany({ medication_id: medDoc!._id });
  await coll<{ _id: number }>("medications").deleteMany({ _id: medDoc!._id });
});

run("admin_medicamentos: escreve medicamentos, não escreve pacientes, lê histórico", async (t) => {
  if (skipIfMongoUnavailable(t)) return;

  const email = `it_admin_med_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  await insertUserWithRole(email, password, "admin_medicamentos");
  const token = await loginAs(email, password);

  const suffix = String(Date.now());
  const medRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${token}`)
    .send(minimalMedicationPayload(suffix));
  assert.equal(medRes.status, 201);

  const pacRes = await request(app)
    .post("/pacientes")
    .set("Authorization", `Bearer ${token}`)
    .send(minimalPacientePayload(suffix, `IT_MED_${suffix}`));
  assert.equal(pacRes.status, 403);

  const eventosRes = await request(app)
    .get("/eventos")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(eventosRes.status, 200);

  const listRes = await request(app)
    .get("/pacientes")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  const lista = listRes.body as Array<{ identificadoresRedatados?: boolean }>;
  if (lista.length > 0) {
    assert.equal(lista[0]!.identificadoresRedatados, false);
  }
});

run("admin_pacientes: escreve pacientes, não escreve medicamentos", async (t) => {
  if (skipIfMongoUnavailable(t)) return;

  const email = `it_admin_pac_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  await insertUserWithRole(email, password, "admin_pacientes");
  const token = await loginAs(email, password);

  const suffix = String(Date.now());
  const medRes = await request(app)
    .post("/medications")
    .set("Authorization", `Bearer ${token}`)
    .send(minimalMedicationPayload(suffix));
  assert.equal(medRes.status, 403);

  const pacRes = await request(app)
    .post("/pacientes")
    .set("Authorization", `Bearer ${token}`)
    .send(minimalPacientePayload(suffix, `IT_MED_${suffix}`));
  assert.equal(pacRes.status, 201);
});

run("POST /identify reemite token com operador e registra evento", async (t) => {
  if (skipIfMongoUnavailable(t)) return;

  const email = `it_identify_${Date.now()}@example.com`;
  const password = "Teste@12345";
  createdEmails.push(email);

  const userId = await insertUserWithRole(email, password, "admin_medicamentos");
  const token = await loginAs(email, password);

  const identifyRes = await request(app)
    .post("/identify")
    .set("Authorization", `Bearer ${token}`)
    .send({ nome: "João Operador", cpf: "529.982.247-25" });
  assert.equal(identifyRes.status, 200);
  assert.equal(identifyRes.body.operador_nome, "João Operador");
  assert.ok(typeof identifyRes.body.token === "string");

  const newToken = identifyRes.body.token as string;
  const eventosRes = await request(app)
    .get("/eventos")
    .query({ acao: "usuario.identify", limit: 10 })
    .set("Authorization", `Bearer ${newToken}`);
  assert.equal(eventosRes.status, 200);

  const eventos = eventosRes.body as Array<{
    usuario_id: number;
    operador_nome: string | null;
    detalhes: Record<string, unknown>;
  }>;
  const identifyEvent = eventos.find((e) => e.usuario_id === userId && e.detalhes.nome === "João Operador");
  assert.ok(identifyEvent, "deve existir evento usuario.identify");
  assert.equal(identifyEvent!.operador_nome, "João Operador");
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

