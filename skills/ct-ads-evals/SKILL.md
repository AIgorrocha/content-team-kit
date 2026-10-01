---
name: ct-ads-evals
description: "Checks sinteticos rapidos de saude para campanhas Meta Ads. Roda 14 verificacoes ponderadas (Pixel/CAPI, fadiga, estrutura, audiencia) e retorna score 0-100 + top issues. Usar quando o usuario pedir 'eval rapido', 'health check ads', 'auditoria express', 'ta tudo certo nos ads', 'sanity check campanha'."
---

# CT Ads Evals, Sanity check de campanhas Meta

Skill de **avaliacao rapida** (5-10 min) das campanhas Meta de um cliente
ativo. NAO substitui a auditoria completa do agente `ct-ads-audit`: serve
pra decidir se vale rodar a auditoria pesada agora.

## Quando usar

- "Da uma olhada rapida nas campanhas do {cliente}"
- "Ta tudo certo com os ads?"
- "Sanity check antes de subir orcamento"
- "Vale rodar auditoria completa hoje?"

## Quando NAO usar

- Auditoria formal pra cliente, usar `ct-ads-audit` (50+ checks).
- Analise de criativo individual, usar `ct-trafego` direto.
- Investigacao de tracking quebrado, usar `references/ads/conversion-tracking.md`.

## Inputs minimos

1. **Cliente** (slug). Se nao passado, perguntar.
2. **Periodo** (default: ultimos 7 dias).
3. Acesso Meta Marketing API via System User Token (skill `ct-ads-tracker`).

## Processo (14 checks ponderados)

Le `references/ads/conversion-tracking.md` e `references/ads/creative-fatigue.md`
antes de avaliar. Cada check retorna PASS / WARNING / FAIL.

### Tracking, peso 30%

| ID | Check | FAIL se |
|----|-------|---------|
| E01 | Pixel disparando | <90% paginas |
| E02 | CAPI ativa | nao configurada |
| E03 | Dedup rate | <70% |
| E04 | EMQ Purchase | <6,0 |

### Fadiga criativa, peso 30%

| ID | Check | FAIL se |
|----|-------|---------|
| E05 | Diversidade de formato | so 1 formato ativo |
| E06 | Idade do criativo top-spender | >21 dias |
| E07 | Frequencia prospect (7d) | >5,0 |
| E08 | CTR drop 14d | >20% |

### Estrutura, peso 20%

| ID | Check | FAIL se |
|----|-------|---------|
| E09 | Learning Limited | >50% conjuntos |
| E10 | Orcamento por conjunto | <2x CPA target |
| E11 | Atribuicao configurada | nao revisada pos Jan/2026 |

### Audiencia, peso 20%

| ID | Check | FAIL se |
|----|-------|---------|
| E12 | Overlap entre conjuntos | >40% |
| E13 | Exclusao de purchasers | sem exclusao |
| E14 | Custom Audience freshness | >365 dias |

## Score (formula)

```
S = SUM(C_pass × W_sev × W_cat) / SUM(C_total × W_sev × W_cat) × 100

C_pass: 1 (PASS), 0,5 (WARNING), 0 (FAIL)
W_sev:  Critical=5, High=3, Medium=1,5, Low=0,5
W_cat:  peso da categoria (30/30/20/20)
```

Severidade default por check:
- E01-E04 (tracking), Critical
- E05-E08 (fadiga), High exceto E08 = Critical
- E09-E11 (estrutura), High exceto E10 = Medium
- E12-E14 (audiencia), High exceto E14 = Medium

## Output (formato fixo)

```markdown
# Eval Express, {cliente}, {periodo}

**Score:** {0-100} ({grade A/B/C/D/F})

## Resumo
- {1-2 frases sobre estado geral}

## Top issues (sorted por severidade × impacto)
1. [CRITICAL] E0X, {check}, {finding} → {fix sugerido}
2. [HIGH]     E0X, {check}, {finding} → {fix sugerido}
3. ...

## Recomendacao
- [ ] Rodar auditoria completa (`ct-ads-audit`) se score <70
- [ ] {acao 1}
- [ ] {acao 2}
```

## Grade thresholds

| Grade | Score | Acao |
|-------|-------|------|
| A | 90-100 | OK, manter |
| B | 75-89 | Pequenos ajustes |
| C | 60-74 | Atencao, agendar fixes |
| D | 40-59 | Pausar e revisar |
| F | <40 | Critico, auditoria completa hoje |

## Quick Win flag

Marcar issue como **Quick Win** se:
- Severidade Critical ou High E
- Tempo estimado de fix <15 min

Exemplos: setar atribuicao 7d click, criar exclusao de purchasers,
adicionar 1 formato novo a um conjunto so com imagem.

## Referencias

- `references/ads/conversion-tracking.md`
- `references/ads/creative-fatigue.md`
- `references/ads/ppc-math.md`
- Agente: `agents/ct-trafego.md`
- Skill irma (auditoria completa): `agents/ct-ads-audit.md` (auditoria completa, agente)
