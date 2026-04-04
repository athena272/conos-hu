-- Regime de consumo: diário (padrão) ou por ciclo (unidades / intervalo em dias)
-- Seguro rodar mais de uma vez: só adiciona colunas se ainda não existirem.

SET @db := DATABASE();

SET @has_regime := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'paciente_medicamentos' AND COLUMN_NAME = 'regime_consumo'
);

SET @sql_regime := IF(
  @has_regime = 0,
  "ALTER TABLE paciente_medicamentos ADD COLUMN regime_consumo ENUM('diario', 'por_ciclo') NOT NULL DEFAULT 'diario'",
  'SELECT 1'
);
PREPARE stmt FROM @sql_regime;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_unidades := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'paciente_medicamentos' AND COLUMN_NAME = 'unidades_por_ciclo'
);

SET @sql_unidades := IF(
  @has_unidades = 0,
  'ALTER TABLE paciente_medicamentos ADD COLUMN unidades_por_ciclo DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql_unidades;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_intervalo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'paciente_medicamentos' AND COLUMN_NAME = 'intervalo_ciclo_dias'
);

SET @sql_intervalo := IF(
  @has_intervalo = 0,
  'ALTER TABLE paciente_medicamentos ADD COLUMN intervalo_ciclo_dias INT NULL',
  'SELECT 1'
);
PREPARE stmt3 FROM @sql_intervalo;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
