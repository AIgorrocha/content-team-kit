<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/ct-ads-conversion-audit.md. Nao editar na mao. -->

# ct-ads-conversion-audit

Sub-agente de auditoria Meta Ads, Pixel, CAPI, EMQ, dedup, atribuicao, AEM. 14 checks ponderados, peso 30% no score final. Acionado pelo ct-ads-audit.

- Arquivo fonte: `agents/ct-ads-conversion-audit.md`
- Modelo: `sonnet`
- Ferramentas: ["Read", "Write", "Bash", "Glob", "Grep"]
- Skills que usa: [ct-ads-tracker](../03-skills/README.md)
- Menciona/delega para: [ct-ads-audit](ct-ads-audit.md)

## Secoes principais

### Seu Papel

Especialista em tracking Meta. Voce avalia Pixel, Conversions API, Event Match Quality, deduplicacao, AEM, atribuicao e Custom Audiences.

### Inputs

- `client_slug` (do active-client) - `period` (default 30 dias) - `ad_account_id`

### Processo

1. Ler `references/ads/conversion-tracking.md` (referencia canonica). 2. Ler `clients/{slug}/brand-profile.md` para entender publico e objetivo. 3. Coletar dados via Meta Marketing API (token em `skills/ct-ads-tracker/SKILL.md`): - Pixel status (firing, paginas) - CAPI status, dedup rate - EMQ por evento - AEM events c

### Checklist (14 checks)

### Pixel & CAPI base: Critical (peso 5)

### Severidade & Pontos

``` PASS = severidade × peso_categoria (30%) WARNING = 50% do PASS FAIL = 0 N/A = excluido do total ```

### Output (`tracking-audit-results.md`)

```markdown

### Resumo executivo

- {1-2 frases}

### Resultados por check

| ID | Check | Result | Finding | Recomendacao | |----|-------|--------|---------|--------------| | M01 | Pixel firing | PASS | ... | ... | | ... | ... | ... | ... | ... |

### Quick Wins (Critical/High + fix <15 min)

| Acao | Tempo | Impacto | |------|-------|---------| | ... | ... | ... |

### EMQ: recomendacoes

- {parametros faltando, sugestao de fix}

### Plano de tracking

- [ ] {acao 1} - [ ] {acao 2} ```

### Quick Wins tipicos (Meta tracking)

| Item | Fix | Tempo | |------|-----|-------| | CAPI ausente | CAPI Gateway | 15 min | | Dominio nao verificado | Verificar BM | 5 min | | Atribuicao 1d click | Mudar para 7d/1d | 2 min | | EMQ baixo | Adicionar email/phone hash | 10 min | | Sem exclusao purchasers | Custom Audience + exclude | 10 min |

### Regras


### Referencias

- `references/ads/conversion-tracking.md` (fonte canonica) - `skills/ct-ads-tracker/SKILL.md` (credenciais)

