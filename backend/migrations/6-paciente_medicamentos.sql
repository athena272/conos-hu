-- Migration 6: Paciente com múltiplos medicamentos
-- Executar apenas em bases que já têm a tabela pacientes com as colunas
-- medicamento_nome, medicamento_concentracao, consumo_diario.
-- Novas instalações usam o schema criado no startup (db.ts).

-- 1. Criar tabela de vínculos paciente-medicamento
CREATE TABLE IF NOT EXISTS paciente_medicamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id INT NOT NULL,
  medicamento_nome VARCHAR(255) NOT NULL,
  medicamento_concentracao VARCHAR(100) NOT NULL,
  consumo_diario DECIMAL(10,2) NOT NULL,
  KEY idx_pm_paciente (paciente_id),
  KEY idx_pm_medicamento (medicamento_nome, medicamento_concentracao),
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- 2. Copiar dados atuais de pacientes para paciente_medicamentos
INSERT INTO paciente_medicamentos (paciente_id, medicamento_nome, medicamento_concentracao, consumo_diario)
SELECT id, medicamento_nome, medicamento_concentracao, consumo_diario
FROM pacientes
WHERE medicamento_nome IS NOT NULL AND medicamento_nome != ''
  AND medicamento_concentracao IS NOT NULL AND medicamento_concentracao != '';

-- 3. Remover colunas de medicamento da tabela pacientes
ALTER TABLE pacientes
  DROP COLUMN medicamento_nome,
  DROP COLUMN medicamento_concentracao,
  DROP COLUMN consumo_diario,
  DROP INDEX idx_pacientes_medicamento;
