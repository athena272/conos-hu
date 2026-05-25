-- Regime por miligrama e campo consumo_mg_diario (referência MySQL; Mongo usa campo opcional equivalente)

ALTER TABLE paciente_medicamentos
  MODIFY COLUMN regime_consumo ENUM('diario', 'por_ciclo', 'por_miligrama') NOT NULL DEFAULT 'diario';

ALTER TABLE paciente_medicamentos
  ADD COLUMN consumo_mg_diario DECIMAL(12, 4) NULL AFTER intervalo_ciclo_dias;
