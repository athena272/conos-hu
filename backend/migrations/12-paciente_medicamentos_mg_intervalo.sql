-- Regime por miligrama com intervalo: "X mg a cada Y dias".
-- Reaproveita a coluna existente intervalo_ciclo_dias para guardar Y (dias) no
-- regime por_miligrama; consumo_mg_diario passa a representar X (mg administrados
-- no intervalo). Taxa diária derivada: mg/dia = consumo_mg_diario / (intervalo_ciclo_dias || 1).
--
-- Compatibilidade: linhas antigas têm intervalo_ciclo_dias NULL no regime
-- por_miligrama, tratado como 1 → mg/dia == consumo_mg_diario (comportamento
-- idêntico ao anterior). Nenhum backfill obrigatório.
--
-- Referência MySQL (o app roda em MongoDB schemaless; este arquivo documenta o
-- contrato de dados e mantém o histórico de migrações consistente).

-- Opcional (apenas padronização): normalizar intervalos nulos para 1 no regime por_miligrama.
UPDATE paciente_medicamentos
  SET intervalo_ciclo_dias = 1
  WHERE regime_consumo = 'por_miligrama'
    AND (intervalo_ciclo_dias IS NULL OR intervalo_ciclo_dias < 1);
