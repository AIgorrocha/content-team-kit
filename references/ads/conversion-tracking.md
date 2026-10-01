# Conversion Tracking Checklist, Meta Ads

<!-- Adaptado de claude-ads/ads/references/conversion-tracking.md (MIT), Meta-only -->

Checklist técnico de tracking de conversões para campanhas Meta Ads do
content-team-ai. Usar antes de subir campanha e em auditorias periódicas.

## Stack obrigatória (Meta)

```
1. Meta Pixel, código base em todas as páginas + standard events
2. Conversions API (CAPI), server-side event forwarding
3. Event deduplication, event_id idêntico entre Pixel e CAPI
4. EMQ optimization, passar email, phone, fbp, fbc, external_id
5. Aggregated Event Measurement (AEM), top 8 events priorizados
```

## Event Match Quality (EMQ)

Score de 0-10 por evento. **87% dos anunciantes têm EMQ ruim**: corrigir
gera +20-40% de performance.

| Score | Avaliação | Ação |
|-------|-----------|------|
| <4,0 | Crítico | Perda severa. Corrigir já. |
| 4,0-5,9 | Atenção | Lacunas relevantes. |
| 6,0-7,9 | Aceitável | Algumas otimizações possíveis. |
| 8,0-10,0 | Excelente | Sinal máximo. |

**Targets por tipo de evento:**
- Purchase: ≥8,5
- AddToCart / Lead: ≥6,5
- PageView: ≥5,5

**Parâmetros por impacto no EMQ:**
- Email: +4,0 pontos
- Phone: +3,0
- External ID: relevante
- fbp (browser ID): importante
- fbc (click ID): importante

## Event deduplication

```
Mesmo event_id + mesmo event_name = deduplicado (correto)
event_id ausente = double-counting (quebrado)

Onde checar: Events Manager > Overview > Deduplication Rate
Target: ≥90%
```

## Janela de atribuição (pós-Jan/2026)

Janelas de **view-through 7 dias e 28 dias foram REMOVIDAS em janeiro/2026**.
Restam:
- 7-day click (recomendado)
- 1-day view (recomendado)
- 1-day click (mínimo aceitável)

Verificar todas as campanhas após Jan/2026, settings antigos podem estar
quebrados.

## CAPI, performance & migração

- Sem CAPI: 30-40% de perda de dados pós iOS 14.5 (Pixel-only é insuficiente).
- Com CAPI: +15-20% de performance vs Pixel-only.
- Bypassa ad blockers e ATT iOS.
- **Offline Conversions API foi descontinuada em maio/2025.** Tracking offline
  agora deve usar CAPI com `action_source="physical_store"`.

### Como deployar (rápido)

1. **CAPI Gateway** (15 min), solução simplificada Meta, sem código backend.
2. **CAPI direta** (algumas horas), chamada server-side custom (Node, Python).
3. **GTM Server-Side**: recomendada para stacks com multi-pixel + analytics.

## AEM, Aggregated Event Measurement

- Configurar os 8 eventos prioritários por domínio em Events Manager.
- Domínio precisa estar verificado no Business Manager.
- Reordenar eventos quebra otimização por 24-48h, fazer com plano.

## Custom Audiences, manutenção

| Item | Threshold |
|------|-----------|
| Website Custom Audience refresh | <180 dias |
| Lookalike source | ≥1.000 usuários, eventos high-value |
| Customer list (1st-party) | Refresh a cada 90 dias |

## Checklist completo (uso em auditoria)

- [ ] **M01** Pixel disparando em todas as páginas relevantes
- [ ] **M02** CAPI ativa e enviando eventos server-side
- [ ] **M03** event_id presente, dedup ≥90%
- [ ] **M04** EMQ Purchase ≥8,5, AddToCart ≥6,5, PageView ≥5,5
- [ ] **M05** Domínio verificado no Business Manager
- [ ] **M06** AEM com top 8 eventos configurados e priorizados
- [ ] **M07** Standard events (Purchase, AddToCart, Lead), não custom replicando padrão
- [ ] **M09** Atribuição 7-day click / 1-day view configurada
- [ ] **M10** Eventos chegando em <1h no Events Manager (sem lag)
- [ ] **M20** Custom Audiences refresh <180 dias
- [ ] **M23** Purchasers excluídos de prospecting
- [ ] **M24** Customer list 1st-party uploaded para CA + Lookalike
- [ ] **M35** Atribuição revisada após Jan/2026 (sem 7d/28d view-through)
- [ ] **M39** UTM params em todas as URLs de anúncio (para GA4)

## Quick Wins (Meta tracking)

| Item | Fix | Tempo |
|------|-----|-------|
| CAPI ausente | Deploy via CAPI Gateway | 15 min |
| Domínio não verificado | Verificar no Business Manager | 5 min |
| Atribuição 1-day click | Mudar para 7d click / 1d view | 2 min |
| Sem exclusão purchasers | Custom Audience purchasers + excluir | 10 min |
| UTM ausente | Template UTM no nível de campanha | 5 min |

## Referência cruzada

- `references/ads/creative-fatigue.md`: fadiga depende de sinal de tracking confiável.
- `references/ads/ppc-math.md`: fórmulas de CPA/ROAS.
- Meta Marketing API: https://developers.facebook.com/docs/marketing-api
