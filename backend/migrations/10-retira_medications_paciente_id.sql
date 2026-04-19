-- Retiradas opcionalmente vinculadas a paciente (total mg acumulado por paciente).
ALTER TABLE retira_medications
  ADD COLUMN paciente_id INT NULL,
  ADD KEY idx_retira_paciente (paciente_id),
  ADD CONSTRAINT fk_retira_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE SET NULL;
