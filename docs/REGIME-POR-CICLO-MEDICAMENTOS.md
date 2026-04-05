# Regime “por ciclo” nos medicamentos do paciente

Documento para alinhamento com equipe operacional e cliente: o que significam os campos e como o sistema usa esses dados.

---

## Contexto

Alguns medicamentos **não** são tomados todos os dias na mesma quantidade. Exemplos comuns:

- **Injetável de ação prolongada**: a cada visita a equipe dispensa **uma seringa** (ou um kit) e o paciente só volta daqui a várias semanas.
- **Esquema com entrega espaçada**: em uma ida à farmácia saem **2 ou 3 unidades** que devem durar até o **próximo retorno** (ex.: 28, 45 ou 60 dias).

Nesses casos, informar apenas “consumo por dia” no sentido literal **não** descreve o uso real. Por isso existe o regime **“Por ciclo”**: você informa **quantas unidades saem por período** e **quantos dias esse período costuma durar** até a próxima dispensação (ou retorno típico).

---

## O que é cada campo

### Unidades por ciclo

**Significado:** quantas **unidades de estoque** (comprimidos, ampolas, seringas aplicáveis, frascos—conforme como o item está cadastrado no sistema) são **dispensadas de uma vez** para cobrir aquele ciclo.

**Exemplos:**

| Situação | O que informar |
|----------|----------------|
| 1 seringa por aplicação, uma aplicação até o próximo retorno | **1** |
| Cada visita saem 2 ampolas | **2** |
| Entrega de 3 caixas por período (se “unidade” no estoque for caixa) | **3** |

**Importante:** o número deve refletir o que **efetivamente reduz o estoque** naquela entrega, na mesma unidade em que o medicamento é contabilizado no sistema (por exemplo, se o cadastro é por **seringa**, conte seringas; se for por **caixa**, conte caixas).

---

### Intervalo (dias)

**Significado:** quantos **dias**, em média, esse paciente **costuma levar** entre uma dispensação desse medicamento e a próxima (ou seja, a duração do “ciclo” até voltar a retirar).

**Exemplos:**

| Situação | O que informar |
|----------|----------------|
| Retorno agendado ~45 dias após a aplicação | **45** |
| Próxima retirada prevista em 28 dias | **28** |
| Esquema estável a cada 60 dias | **60** |

**Importante:** não é necessariamente a “meia-vida” do fármaco no corpo; para **estoque**, o que importa é **com que frequência o paciente tira unidades do estoque**. Use o intervalo que a equipe usa na prática (agenda de retorno, protocolo da unidade, etc.).

---

## Como o sistema usa isso (resumo)

Para **previsão de estoque** e **“meses de estoque”**, o sistema calcula uma **taxa média de unidades por dia**:

**taxa (unid./dia) = unidades por ciclo ÷ intervalo em dias**

**Exemplo:** 1 unidade a cada 45 dias → taxa ≈ **0,022** unid./dia (muito menor do que “1 por dia”, que inflaria o consumo).

Assim, o mesmo motor de cálculo que já existia para consumo diário continua válido, mas com um número que representa bem o uso **espaçado**.

---

## O que convém validar com a operação / cliente

1. **A “unidade” no cadastro do medicamento** é a mesma que a farmácia pensa ao dispensar? (seringa vs caixa vs frasco, etc.)
2. O **intervalo** deve ser o **tempo até o próximo retorno típico** ou outro critério (ex.: duração exata de um tratamento)? Ajustar o texto operacional se necessário.
3. Casos em que **no mesmo ciclo** a quantidade muda (às vezes 1, às vezes 2): hoje o cadastro é **um valor fixo por vínculo paciente–medicamento**; se isso for frequente, pode ser tema de evolução futura.

---

## Regime “Consumo diário” (comparação)

Quando o uso é **contínuo e estável por dia** (ex.: 2 comprimidos por dia, todos os dias), use **“Consumo diário”** e o campo **Consumo/dia**. Não é necessário preencher unidades por ciclo nem intervalo.

---

*Última atualização: documento de apoio ao produto; ajustar conforme feedback da unidade.*
