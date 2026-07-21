import test from "node:test";
import assert from "node:assert/strict";
import { getJwtSecret, signAuthToken, verifyAuthToken } from "../services/authToken";

const originalJwtSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

test.after(() => {
  process.env.JWT_SECRET = originalJwtSecret;
  process.env.NODE_ENV = originalNodeEnv;
});

test("signAuthToken + verifyAuthToken roundtrip", () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";

  const token = signAuthToken({
    userId: 42,
    email: "user@example.com",
    role: "admin",
  });

  const payload = verifyAuthToken(token);
  assert.deepEqual(payload, {
    sub: 42,
    email: "user@example.com",
    role: "admin",
  });
});

test("signAuthToken inclui operador_nome quando informado", () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";

  const token = signAuthToken({
    userId: 1,
    email: "admin@conos.com",
    role: "admin",
    operador_nome: "Maria Silva",
  });

  const payload = verifyAuthToken(token);
  assert.equal(payload.operador_nome, "Maria Silva");
});

test("verifyAuthToken aceita papéis especializados", () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";

  for (const role of ["admin_medicamentos", "admin_pacientes"] as const) {
    const token = signAuthToken({
      userId: 2,
      email: "scoped@example.com",
      role,
    });
    assert.equal(verifyAuthToken(token).role, role);
  }
});

test("verifyAuthToken rejects tampered signatures", () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  const token = signAuthToken({
    userId: 7,
    email: "viewer@example.com",
    role: "viewer",
  });
  const tampered = `${token.slice(0, -1)}x`;
  assert.throws(() => verifyAuthToken(tampered), /Invalid token signature/);
});

test("getJwtSecret requires explicit secret in production", () => {
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  assert.throws(() => getJwtSecret(), /JWT_SECRET is required in production/);
});
