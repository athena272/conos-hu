import test from "node:test";
import assert from "node:assert/strict";
import {
  canWriteMedications,
  canWritePacientes,
  canWithdrawMedications,
  isElevated,
} from "../utils/permissions";
import type { UserRole } from "../types/roles";

test("isElevated reconhece papéis administrativos", () => {
  assert.equal(isElevated("admin"), true);
  assert.equal(isElevated("admin_medicamentos"), true);
  assert.equal(isElevated("admin_pacientes"), true);
  assert.equal(isElevated("viewer"), false);
  assert.equal(isElevated(undefined), false);
});

test("canWriteMedications e canWritePacientes respeitam escopo", () => {
  assert.equal(canWriteMedications("admin"), true);
  assert.equal(canWriteMedications("admin_medicamentos"), true);
  assert.equal(canWriteMedications("admin_pacientes"), false);
  assert.equal(canWriteMedications("viewer"), false);

  assert.equal(canWritePacientes("admin"), true);
  assert.equal(canWritePacientes("admin_pacientes"), true);
  assert.equal(canWritePacientes("admin_medicamentos"), false);
  assert.equal(canWritePacientes("viewer"), false);
});

test("canWithdrawMedications inclui admin_pacientes para dispensa na rotina", () => {
  assert.equal(canWithdrawMedications("admin"), true);
  assert.equal(canWithdrawMedications("admin_medicamentos"), true);
  assert.equal(canWithdrawMedications("admin_pacientes"), true);
  assert.equal(canWithdrawMedications("viewer"), false);
  assert.equal(canWithdrawMedications(undefined), false);
});

test("papéis desconhecidos são tratados como sem permissão", () => {
  const unknown = "superuser" as UserRole;
  assert.equal(isElevated(unknown), false);
  assert.equal(canWriteMedications(unknown), false);
  assert.equal(canWritePacientes(unknown), false);
  assert.equal(canWithdrawMedications(unknown), false);
});
