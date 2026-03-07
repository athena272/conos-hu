# Dados para testes – Conos

Use este documento para popular medicamentos, pacientes e validar cenários.

---

## 1. Medicamentos para cadastrar

Cada linha abaixo é um **lote** (registro na tela "Registrar medicação"). Forma: 1 = Comprimido, 2 = Injetável, 3 = Gotas, 4 = Outros.

| Nome        | Lote      | Quantidade | Classificação | Concentração | Forma | Data validade |
|------------|-----------|------------|---------------|--------------|-------|----------------|
| Paracetamol | L2024001  | 500        | Analgésico    | 500mg        | 1     | 2026-12-31     |
| Paracetamol | L2024002  | 300        | Analgésico    | 500mg        | 1     | 2026-06-30     |
| Dipirona    | L2025001  | 200        | Analgésico    | 500mg/ml     | 2     | 2027-03-15     |
| Omeprazol   | OMZ-2401  | 90         | Antiácido     | 20mg         | 1     | 2026-08-20     |
| Sugamadex   | 2500068a  | 50         | Anestesia     | 100mg/ml     | 2     | 2028-10-31     |
| Sugamadex   | 2500068b  | 30         | Anestesia     | 100mg/ml     | 2     | 2026-02-28     |
| Sugamadex   | 2500068c  | 47         | Anestesia     | 500mg        | 3     | 2026-02-28     |
| Loratadina  | LOR-2501  | 30         | Antialérgico  | 10mg         | 1     | 2026-11-15     |
| Amoxicilina | AMX-2502  | 21         | Antibiótico   | 500mg        | 1     | 2026-05-10     |
| Metformina  | MET-2403  | 60         | Antidiabético | 850mg        | 1     | 2026-09-01     |

**Resumo rápido (copiar e colar):**

- Paracetamol, L2024001, 500, A, 500mg, 1, 2026-12-31  
- Paracetamol, L2024002, 300, A, 500mg, 1, 2026-06-30  
- Dipirona, L2025001, 200, A, 500mg/ml, 2, 2027-03-15  
- Omeprazol, OMZ-2401, 90, B, 20mg, 1, 2026-08-20  
- Sugamadex, 2500068a, 50, C, 100mg/ml, 2, 2028-10-31  
- Sugamadex, 2500068b, 30, C, 100mg/ml, 2, 2026-02-28  
- Sugamadex, 2500068c, 47, C, 500mg, 3, 2026-02-28  
- Loratadina, LOR-2501, 30, D, 10mg, 1, 2026-11-15  
- Amoxicilina, AMX-2502, 21, E, 500mg, 1, 2026-05-10  
- Metformina, MET-2403, 60, F, 850mg, 1, 2026-09-01  

---

## 2. Pacientes para cadastrar

Use **medicamento (nome e concentração)** exatamente como aparece no dropdown (ex.: "Paracetamol - 500mg", "Sugamadex - 100mg/ml"). Cadastre primeiro os medicamentos acima para o dropdown ter opções.

| Nome              | Prontuário | APAC        | Diagnóstico           | Medicamento (nome + conc.) | Consumo diário | Observações     | Telefone      | Data liberação | Retorna? | Tipo retorno        |
|------------------|------------|-------------|------------------------|----------------------------|----------------|-----------------|---------------|----------------|----------|----------------------|
| Maria Silva      | 100001     | APAC-2024-001 | Dor crônica          | Paracetamol - 500mg        | 2              | Uso contínuo    | (11) 98765-4321 | 2025-01-15   | Sim      | Farmácia e médico    |
| João Santos      | 100002     | APAC-2024-002 | Pós-operatório        | Sugamadex - 100mg/ml       | 1              | —               | (11) 91234-5678 | 2025-02-01   | Sim      | Somente farmácia     |
| Ana Oliveira     | 100003     | APAC-2024-003 | Refluxo               | Omeprazol - 20mg           | 1              | Manhã em jejum  | (21) 99876-5432 | 2025-01-20   | Não      | —                    |
| Pedro Costa      | 100004     | APAC-2024-004 | Diabetes tipo 2       | Metformina - 850mg         | 2              | —               | (31) 97654-3210 | 2025-02-10   | Sim      | Farmácia e enfermagem |
| Carla Mendes     | 100005     | APAC-2024-005 | Alergia respiratória  | Loratadina - 10mg          | 1              | —               | (11) 96543-2109 | 2025-01-25   | Sim      | Somente farmácia     |
| Roberto Lima     | 100006     | APAC-2024-006 | Dor e febre           | Paracetamol - 500mg        | 3              | Tratamento 7 dias | (11) 95432-1098 | 2025-02-05   | Não      | —                    |
| Fernanda Rocha   | 100007     | APAC-2024-007 | Infecção bacteriana   | Amoxicilina - 500mg        | 3              | 7 dias          | (21) 94321-0987 | 2025-02-08   | Não      | —                    |
| Lucas Pereira    | 100008     | APAC-2024-008 | Dor pós-cirúrgica     | Dipirona - 500mg/ml        | 2              | —               | (31) 93210-9876 | 2025-02-12   | Sim      | Farmácia e médico     |

---

## 3. Cenários de teste

### 3.1 Medicamentos

| Cenário | Passos | Resultado esperado |
|---------|--------|--------------------|
| Cadastrar primeiro lote | Registrar medicação → Novo lote → Paracetamol L2024001, 500 un, 500mg, Comprimido, validade 31/12/2026 | Medicamento aparece na Home; status "Em estoque". |
| Cadastrar segundo lote do mesmo medicamento | Registrar medicação → Novo lote → Paracetamol L2024002, 300 un, 500mg, Comprimido, validade 30/06/2026 | Na Home aparecem duas linhas (dois lotes); no cadastro de paciente, dropdown mostra uma opção "Paracetamol - 500mg". |
| Adicionar quantidade a lote existente | Registrar medicação → Adicionar a lote existente → escolher Paracetamol 500mg → quantidade 100 | Quantidade do lote escolhido aumenta em 100. |

### 3.2 Pacientes

| Cenário | Passos | Resultado esperado |
|---------|--------|--------------------|
| Novo paciente – modal de impacto | Pacientes → Novo paciente → preencher (ex.: Maria Silva, pront. 100001, Paracetamol 500mg, consumo 2) → Salvar e confirmar | Abre modal com resumo e "Impacto no estoque": estoque total, pacientes vinculados, consumo diário atual/com novo, meses de estoque atual e com novo paciente. |
| Confirmar cadastro | Na modal de confirmação → Confirmar cadastro | Paciente aparece na lista; toast de sucesso. |
| Editar paciente | Na lista → Editar em um paciente → alterar telefone ou tipo retorno → Salvar | Dados atualizados; sem modal de impacto. |
| Excluir paciente | Na lista → Excluir → confirmar | Paciente some da lista; toast de sucesso. |
| Prontuário duplicado | Novo paciente com prontuário já existente (ex. 100001) | Backend retorna erro; toast com mensagem de prontuário já existente. |
| Retorno ao serviço | Novo paciente → "O paciente vai retornar?" Sim → escolher "Somente farmácia" | Tipo retorno salvo; na lista aparece "Sim" e "Somente farmácia". |

### 3.3 Estoque e impacto

| Cenário | Passos | Resultado esperado |
|---------|--------|--------------------|
| Resumo por medicamento | Ter ao menos um paciente vinculado a um medicamento → abrir Pacientes | Seção "Estoque por medicamento (comprometido)" com tabela: medicamento, estoque total, qtd pacientes, consumo diário total, "Estoque dá para (meses)". |
| Múltiplos pacientes no mesmo medicamento | Cadastrar Maria (Paracetamol 500mg, consumo 2) e Roberto (Paracetamol 500mg, consumo 3) | Resumo mostra Paracetamol 500mg com 2 pacientes e consumo diário total 5; meses de estoque = estoque_total / (5 * 30). |
| Medicamento sem estoque | Cadastrar paciente para um medicamento que não existe ou tem 0 em todos os lotes | Dropdown só mostra medicamentos que existem (com pelo menos um lote). Impacto pode mostrar 0 meses. |

### 3.4 Fluxo completo sugerido

1. Cadastrar 3 lotes de medicamentos (ex.: 2 Paracetamol 500mg, 1 Sugamadex 100mg/ml).  
2. Ir em Pacientes → Novo paciente → preencher com medicamento Paracetamol 500mg, consumo 2 → Salvar e confirmar.  
3. Na modal, conferir impacto (estoque total, 0 pacientes antes, 1 depois, meses de estoque).  
4. Confirmar cadastro.  
5. Cadastrar segundo paciente também com Paracetamol 500mg, consumo 3.  
6. Na lista, ver os dois pacientes; na seção "Estoque por medicamento", ver Paracetamol com 2 pacientes e consumo diário 5.  
7. Editar um paciente e excluir outro; conferir que a lista e o resumo por medicamento atualizam.

---

## 4. Valores de referência (formas e tipos)

- **Forma farmacêutica (medicamento):** 1 = Comprimido, 2 = Injetável, 3 = Gotas, 4 = Outros  
- **Tipo retorno (paciente):** Farmácia e médico | Somente farmácia | Farmácia e enfermagem  

APAC e diagnóstico podem ser texto livre; use os exemplos acima ou variações conforme sua necessidade.
