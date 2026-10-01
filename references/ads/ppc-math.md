# PPC Math, Calculadora Financeira de Tráfego Pago

<!-- Adaptado de claude-ads/skills/ads-math (MIT), focado em Meta Ads e clientes BR (R$) -->

Referência matemática para análises de campanhas Meta Ads do content-team-ai.
Usar sempre que `ct-trafego` ou `ct-ads-audit` precisar quantificar CPA, ROAS,
break-even, projeção de orçamento ou unit economics.

## Fórmulas Essenciais

| Métrica | Fórmula |
|---------|---------|
| CPA | Gasto / Conversões |
| ROAS | Receita / Gasto |
| ROAS % | (Receita − Gasto) / Gasto × 100 |
| CTR | Cliques / Impressões × 100 |
| CVR | Conversões / Cliques × 100 |
| CPC | Gasto / Cliques |
| CPM | (Gasto / Impressões) × 1.000 |
| CPL | Gasto / Leads |
| Break-Even CPA | AOV × Margem% |
| Break-Even ROAS | 1 / Margem% |
| LTV | ARPU × Tempo médio de vida |
| CAC | Marketing total / Novos clientes |
| MER | Receita total / Marketing total |
| IS Opportunity | Receita atual × (1/IS − 1) |

> AOV = ticket médio. ARPU = receita média por usuário. IS = impression share.

## 1. CPA, Custo por Aquisição

```
CPA = Gasto Total / Conversões Totais
```

**Inputs:** gasto e conversões no mesmo período.
**Outputs:** CPA, tendência (se houver histórico), comparação vs benchmark.

## 2. ROAS, Return on Ad Spend

```
ROAS  = Receita / Gasto                 → ex.: 3,5x
ROAS% = (Receita − Gasto) / Gasto × 100 → ex.: 250%
```

Cruzar com break-even ROAS antes de declarar "lucrativo".

## 3. Break-Even

```
Break-Even CPA   = AOV × Margem
Break-Even ROAS  = 1 / Margem
Headroom         = (CPA atual − Break-Even CPA) / Break-Even CPA
```

- Headroom positivo: campanha lucrativa, há margem para escalar.
- Headroom negativo: cortar ou revisar oferta/funil.

## 4. Impression Share Opportunity

```
Receita potencial extra = Receita atual × (1 / IS_atual − 1)
```

Decidir entre **subir orçamento** (IS lost to budget alto) ou **melhorar
qualidade/oferta** (IS lost to rank alto).

## 5. Projeção de Orçamento

```
Gasto projetado       = Orçamento diário × Dias
Conversões projetadas = Gasto projetado / CPA histórico
Receita projetada     = Conversões × AOV
```

Cenários recomendados:
- **Conservador:** +20% orçamento (regra dos 20%, nunca subir mais que isso de uma vez).
- **Moderado:** +50% (alerta de retornos decrescentes, exige re-validação semanal).
- **Agressivo:** +100% (sai da fase de aprendizado, exige novo CPA observado).

## 6. LTV : CAC

```
CAC          = Marketing total / Novos clientes
LTV          = ARPU × Tempo médio de vida
LTV : CAC    = LTV / CAC
Payback (m)  = CAC / ARPU mensal
```

Interpretação:
- `<1:1`: perdendo dinheiro por cliente. Parar e reestruturar.
- `1:1-2:1`: break-even ou marginal. Otimizar antes de escalar.
- `3:1`: saudável (benchmark SaaS).
- `5:1+`: pode estar sub-investindo em aquisição.

## 7. MER, Marketing Efficiency Ratio

```
MER = Receita Total / Marketing Total (todos os canais)
```

Captura eficiência blended (orgânico + pago + retenção).

| Tipo de negócio | MER típico | MER excelente |
|-----------------|-----------|---------------|
| E-commerce      | 3-5x      | 8x+           |
| SaaS            | 5-10x     | 12x+          |
| Serviço local   | 3-8x      | 10x+          |

## Regras de Escala (Meta Ads)

- **Regra dos 20%:** nunca aumentar orçamento de uma campanha em fase de aprendizado em mais de 20% por vez (reseta o aprendizado).
- **Regra do 3x Kill:** pausar campanha/conjunto com CPA > 3× target.
- **Sufficiência de orçamento:** orçamento diário ≥ 5× CPA target por conjunto (Meta).
- **Saída do aprendizado:** Meta exige ~50 conversões/conjunto em 7 dias.

## Output Padrão

Quando `ct-trafego` ou `ct-ads-audit` apresentar cálculo:

```markdown
### [Nome do cálculo]

**Inputs:**
- [valor 1]
- [valor 2]

**Resultado:**
| Métrica | Valor | Benchmark | Status |
|---------|-------|-----------|--------|
| ...     | ...   | ...       | PASS / WARNING / FAIL |

**Interpretação:** 1-2 frases.

**Recomendação:** ação concreta.
```

## Quando pedir mais dados

Se o input estiver incompleto, perguntar:
- Plataforma e tipo de campanha (Meta, Sales / Leads / Traffic).
- Período da análise.
- Gasto e conversões.
- Receita (se ROAS/break-even).
- Margem (se break-even/LTV).
- Tipo de negócio (para escolher benchmark).
