# Creative Fatigue Framework, Meta Ads (Andromeda-aware)

<!-- Adaptado de claude-ads/ads/references/meta-audit.md (MIT) -->
<!-- Foco: detectar e prevenir fadiga criativa em campanhas Meta de clientes content-team-ai -->

Framework para identificar fadiga criativa em campanhas Meta Ads (Facebook +
Instagram) considerando o motor de retrieval Andromeda (out/2025), que
encurtou o ciclo de vida útil de criativos para 2-4 semanas.

## Sinais primários de fadiga

| Sinal | Threshold PASS | WARNING | FAIL |
|-------|----------------|---------|------|
| Queda de CTR ao longo de 14 dias | <10% | 10-20% | >20% |
| Frequência (prospecting, 7d) | <3,0 | 3,0-5,0 | >5,0 |
| Frequência (retargeting, 7d) | <8,0 | 8,0-12,0 | >12,0 |
| Idade do criativo sem refresh | <14 dias | 14-21 dias | >21 dias |
| CTR absoluto | ≥1,0% | 0,5-1,0% | <0,5% |
| Hook rate (vídeo, 3s) | skip <50% | 50-70% | >70% |
| Variantes "minor" no mesmo conjunto | <3 conceitos distintos | 3-5 | mais de 5 |

> **Regra Andromeda:** 100 variações pequenas do mesmo criativo NÃO performam
> melhor do que 10 conceitos genuinamente distintos. Andromeda agrupa ads
> com Similarity Score >60% e suprime retrieval.

## Cadência de refresh por plataforma

| Plataforma | Cadência |
|-----------|----------|
| TikTok | 7-10 dias |
| Meta (Reels/Feed) | 14-21 dias |
| LinkedIn | 4-6 semanas |
| Google / Microsoft | 8-12 semanas |

Para o content-team-ai, focar em **Meta**: produzir lote novo a cada 14 dias
quando a campanha estiver ativa com >R$ 50/dia.

## Diversidade que conta (Andromeda)

Variar pelo menos 3 dos 5 eixos abaixo a cada lote:

1. **Conceito narrativo** (problema/solução, prova social, demonstração, comparação, ASMR/POV).
2. **Motivador emocional** (medo de perder, ambição, pertencimento, alívio, curiosidade).
3. **Estilo visual** (UGC vs estúdio, ilustração vs foto, mockup vs vídeo real).
4. **Formato** (estático, carrossel, reel 9:16, vídeo curto 1:1).
5. **Hook/abertura** (pergunta, número, choque, histórico pessoal, CTA reverso).

## Score de fadiga (rápido)

```
fadiga_score = pesos:
  CTR drop 14d   ×  3
  Frequency      ×  2
  Idade criativo ×  2
  CTR absoluto   ×  1
  Hook rate      ×  1
  Variantes      ×  1
```

- 0-4 pontos FAIL → criativo saudável.
- 5-7 pontos FAIL → atenção, agendar refresh.
- 8+ pontos FAIL → pausar e produzir lote novo.

## Checklist de refresh (quando aplicar)

- [ ] CTR caiu mais de 20% em 14 dias OU
- [ ] Frequência > threshold da etapa (prospect/retarget) OU
- [ ] Criativo ativo > 21 dias E volume de impressões > 100k OU
- [ ] CPA subiu >30% nos últimos 7 dias mantendo orçamento.

Se algum dos itens marcado, criar novo lote (mínimo 3 conceitos novos) ANTES
de pausar o atual, overlap de 3-5 dias.

## Quick wins de fadiga

| Sintoma | Ação imediata | Tempo |
|---------|---------------|-------|
| 1 só formato ativo | Adicionar carrossel ou reel ao mesmo conjunto | 15 min |
| Sem UGC | Boostar 1 post orgânico via Spark Ad / Partnership Ad | 10 min |
| Frequência > 5 (prospect) | Excluir purchasers + ampliar audiência | 5 min |
| Idade >30 dias | Pausar variante mais antiga + lançar 1 nova | 30 min |
| Variantes idênticas (Andromeda) | Reescrever copy com motivador emocional diferente | 1 h |

## Referência cruzada

- `references/ads/conversion-tracking.md`: sinal de tracking afeta atribuição da fadiga.
- `references/ads/ppc-math.md`: calcular ROAS pré/pós-refresh.
- `references/copywriting-frameworks.md`: frameworks de novo hook.
- `references/platform-specs.md`: specs visuais por formato.
