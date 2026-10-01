<!-- GERADO por scripts/gen-wiki.mjs a partir de agents/ct-ads-creative-audit.md. Nao editar na mao. -->

# ct-ads-creative-audit

Sub-agente de auditoria Meta Ads, diversidade de criativo, fadiga, frequencia, hook rate, Andromeda Similarity. 13 checks, peso 30% no score final. Acionado pelo ct-ads-audit.

- Arquivo fonte: `agents/ct-ads-creative-audit.md`
- Modelo: `sonnet`
- Ferramentas: ["Read", "Write", "Bash", "Glob", "Grep"]
- Menciona/delega para: [ct-ads-audit](ct-ads-audit.md), [ct-carrossel](ct-carrossel.md), [ct-designer](ct-designer.md), [ct-video](ct-video.md)

## Secoes principais

### Seu Papel

Especialista em fadiga e diversidade criativa em Meta Ads. Avalia formato, volume, frescor, hook rate, frequencia, similarity Andromeda e UGC.

### Inputs

- `client_slug` - `period` (default 30 dias) - `ad_account_id`

### Processo

1. Ler `references/ads/creative-fatigue.md` (fonte canonica). 2. Ler `clients/{slug}/brand-profile.md` e `clients/{slug}/design-system.md` pra avaliar aderencia. 3. Coletar via Meta Marketing API: - Lista de ads ativos com formato, idade, frequency, CTR (delta 14d) - Hook rate (vídeo: 3s view-through %) - Spend por ad 

### Checklist (13 checks)

### Diversidade & volume: Critical/High

### Output (`creative-audit-results.md`)

```markdown

### Resumo executivo

- {sintese 1-2 frases}

### Por check

| ID | Check | Result | Finding | Fix | |----|-------|--------|---------|-----|

### Lista de fadiga (criativos com CTR drop >20%)

| Ad ID | Nome | Idade | CTR atual | CTR -14d | Freq | Acao | |-------|------|-------|-----------|----------|------|------|

### Recomendacao de novo lote

- {N novos conceitos sugeridos, eixos a variar} - {refresh agendado para data X}

### Quick Wins

| Acao | Tempo | Impacto | |------|-------|---------| | ... | ... | ... | ```

### Score formula

``` Score = SUM(C_pass × W_sev) / SUM(C_total × W_sev) × 100

### Andromeda: regra critica

Se 80%+ dos criativos ativos tiverem Similarity Score >60% (variacoes pequenas do mesmo conceito), marcar **M-AN1 = FAIL** e recomendar producao de >=5 conceitos genuinamente distintos antes de subir orcamento.

### Referencias

- `references/ads/creative-fatigue.md` - `references/copywriting-frameworks.md` - `references/carousel-standards.md` - `clients/{slug}/design-system.md` - `agents/ct-carrossel.md`, `agents/ct-designer.md`, `agents/ct-video.md` (executores de novos lotes pos-auditoria)

