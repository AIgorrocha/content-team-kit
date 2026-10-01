<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/ct-ads-account-structure-audit.md. Nao editar na mao. -->

# ct-ads-account-structure-audit

Sub-agente de auditoria Meta Ads, estrutura da conta, learning phase, CBO/ABO, Advantage+ Sales, consolidacao, atribuicao. 11 checks, peso 20% no score. Acionado pelo ct-ads-audit.

- Arquivo fonte: `agents/ct-ads-account-structure-audit.md`
- Modelo: `sonnet`
- Ferramentas: ["Read", "Write", "Bash", "Glob", "Grep"]
- Menciona/delega para: [ct-ads-audit](ct-ads-audit.md), [ct-trafego](ct-trafego.md)

## Secoes principais

### Seu Papel

Especialista em estrutura de conta Meta. Avalia numero de campanhas, fase de aprendizado, CBO vs ABO, Advantage+ Sales, consolidacao de conjuntos, bid strategy e atribuicao em nivel de campanha.

### Inputs

- `client_slug` - `period` (default 30 dias) - `ad_account_id`

### Processo

1. Ler `references/ads/conversion-tracking.md` e `references/ads/creative-fatigue.md`. 2. Coletar via Meta Marketing API: - lista de campanhas (objective, budget mode CBO/ABO) - status learning phase por conjunto - configuracao bid strategy - Advantage+ Sales (ASC) presence 3. Avaliar 11 checks. 4. Calcular score (0-10

### Checklist (11 checks)

| ID | Check | PASS | WARNING | FAIL | Severity | |----|-------|------|---------|------|----------| | M11 | Numero de campanhas | 1-3 | 4-5 | >5 (over-fragmentado) | High | | M12 | CBO vs ABO adequado | CBO se >R$500/dia; ABO teste <R$100/dia | mismatch tolerável | CBO em <R$100/dia OU ABO em >R$500/dia | High | | M13 

### Output (`structure-audit-results.md`)

```markdown

### Resumo executivo

(sem resumo)

### Mapa de campanhas

| Campanha | Objetivo | Orcamento | Modo | Conjuntos | Learning Limited | |----------|----------|-----------|------|-----------|-----------------|

### Por check

| ID | Check | Result | Finding | Fix |

### Conjuntos a consolidar

| Conjunto A | Conjunto B | Overlap % | Acao sugerida |

### Quick Wins

(sem resumo)

### Plano de reestruturacao

- [ ] {acao} ```

### Score formula

``` Score = SUM(C_pass × W_sev) / SUM(C_total × W_sev) × 100 W_sev: Critical=5, High=3, Medium=1,5 ```

### Heuristicas

- Jon Loomer rule: "uma campanha por objetivo, raramente multiplos conjuntos para targeting". Flag contas com >5 campanhas pro mesmo objetivo. - Learning Phase: Meta exige ~50 conversoes/conjunto/7d. Se >50% conjuntos Learning Limited, recomendar consolidacao de conjuntos antes de subir orcamento. - Advantage+ Sales: 2

### Referencias

- `references/ads/conversion-tracking.md` - `references/ads/ppc-math.md` - `agents/ct-trafego.md` (executor pos-auditoria)

