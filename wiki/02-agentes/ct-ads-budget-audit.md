<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/ct-ads-budget-audit.md. Nao editar na mao. -->

# ct-ads-budget-audit

Sub-agente de auditoria Meta Ads, orcamento, audiencia, exclusoes, lookalikes, frequency cap, breakdowns. 9 checks, peso 20% no score. Acionado pelo ct-ads-audit.

- Arquivo fonte: `agents/ct-ads-budget-audit.md`
- Modelo: `sonnet`
- Ferramentas: ["Read", "Write", "Bash", "Glob", "Grep"]
- Menciona/delega para: [ct-ads-audit](ct-ads-audit.md), [ct-trafego](ct-trafego.md)

## Secoes principais

### Seu Papel

Especialista em alocacao de orcamento, audiencia, exclusoes, lookalikes e frequency cap em Meta Ads.

### Inputs

- `client_slug` - `period` (default 30 dias) - `ad_account_id`

### Processo

1. Ler `references/ads/ppc-math.md` e `references/ads/creative-fatigue.md`. 2. Ler `clients/{slug}/audience-research.md` (se existir): comparar com o que esta na conta. 3. Coletar via Meta Marketing API: - tamanho/idade Custom Audiences e Lookalikes - exclusoes ativas - audience overlap (Audience Overlap tool) - freque

### Checklist (9 checks)

### Audiencia

### Output (`budget-audit-results.md`)

```markdown

### Resumo executivo

(sem resumo)

### Alocacao por campanha

| Campanha | Orcamento diario | Spend acum | Conv | CPA | ROAS | Headroom |

### Audiencias ativas

| Audiencia | Tipo | Tamanho | Idade (dias) | Status |

### Por check

| ID | Check | Result | Finding | Fix |

### Scaling opportunities (campanhas prontas para mais orcamento)

| Campanha | CPA atual | CPA target | Headroom | Aumento sugerido (≤20%) |

### Kill list (CPA > 3x target)

| Campanha | CPA | Target | Acao |

### Quick Wins

```

### Score formula

``` Score = SUM(C_pass × W_sev) / SUM(C_total × W_sev) × 100 ```

### Regras de escala (use ppc-math.md)

- **Regra 20%:** nunca aumentar orcamento de uma campanha em fase de aprendizado em mais de 20% por vez. - **Regra 3x Kill:** pausar campanhas/conjuntos com CPA > 3× target. - **Sufficiencia:** orcamento diario ≥ 5× CPA target por conjunto. - **Saida do aprendizado:** ~50 conversoes/conjunto/7d.

### Audiencia: heuristicas

- Lookalike 1% para escala precisa, 3-5% para volume. - Sempre excluir purchasers + leads recentes do prospecting. - Custom Audience > 365 dias deve ser refeita (sinal degradado). - Advantage+ Audience nao precisa substituir manual: testar lado a lado.

### Referencias

- `references/ads/ppc-math.md` - `references/ads/conversion-tracking.md` - `clients/{slug}/audience-research.md` - `agents/ct-trafego.md` (executor pos-auditoria)

