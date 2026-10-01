---
name: ct-social-cockpit
description: Painel unificado de performance por cliente que o ct-diretor le ANTES de produzir/publicar. Consolida num so lugar (content/{cliente}/cockpit.md + Supabase) - metricas atuais por rede, top posts, melhor horario/dia, formato campeao e concorrente bombando. E o dashboard caseiro que substitui o Metricool. Use quando pedirem "como estao minhas redes", "o que esta funcionando", "panorama", "dashboard", ou antes de planejar pauta.
---

# ct-social-cockpit: Painel unificado de performance

O "dashboard Metricool" caseiro. Reune o que os agentes precisam saber sobre o estado
real das redes, num arquivo so por cliente. O `ct-diretor` le isso ANTES de planejar
pauta, escolher formato ou agendar.

## Fontes (tudo gratis, ja existente)
- `ct_metrics_snapshots`: metricas proprias por post (Fase 1)
- `ct_social_insights` (kind=best_time), melhor horario/dia/formato (Fase 2)
- `ct_competitor_posts`: concorrentes monitorados (populado por `competitor-snapshot.js`)

## Concorrentes (igual get_network_competitors do Metricool)
`node skills/ct-social-cockpit/competitor-snapshot.js [--client all] [--limit 5]`
Le os @handles de `clients/{slug}/competitors.md`, busca perfil publico + ultimos posts
via RapidAPI instagram-looter2 (precisa `RAPIDAPI_KEY`), upsert ct_competitors
(metadata.client_slug) + grava posts em `ct_competitor_posts` (external_id `snap:`). Roda antes do build.js.

## Tendencias / repos (Twitter research, so clientes com esse pilar ativo)
`node skills/ct-social-cockpit/trends-snapshot.js [--days 30]`
Agrega os JSON de `output/twitter-research/` (gerados por ct-twitter-research) em
repos GitHub em alta + temas quentes + top tweets. Grava em ct_social_insights
(platform=twitter, kind=trends). Twitter aqui e PESQUISA, nao metrica propria.
Ver `clients/{slug}/brand-profile.md` se o cliente ativo usa esse pilar; o cockpit
renderiza a secao "Tendencias / repos pra conteudo" so quando aplicavel.

## Como roda

```bash
node skills/ct-social-cockpit/build.js [--client {slug}|all]
```

Gera:
- `content/{cliente}/cockpit.md`: humano + agente leem
- linha em `ct_social_insights` (kind=`cockpit`, payload jsonb), leitura via SQL

## O que mostra (por rede)
- Posts e interacoes nos ultimos 30 dias + engajamento medio
- Top 3 posts recentes (formato, data, interacoes, link)
- Melhor horario + dia (do best_time) com nivel de confianca, **sujeito ao gate de amostra abaixo**
- Formato campeao (carrossel/reel/video/short/post)
- Concorrentes bombando (top 3 por engagement_score)
- **Desempenho das nossas pecas** (ver abaixo)

## Secao "Desempenho das nossas pecas" (join)

`pieces.cjs` casa a peca que NOS produzimos com o desempenho real dela:
`ct_content_items.publish_url` x `ct_metrics_snapshots.post_url`. Sem esse join, nenhum agente sabe como as PROPRIAS pecas
performaram, so a media da rede.

Por peca: formato, tema/pilar, agente que produziu, data, alcance, shares, saves, engajamento.
Depois, cortes por formato, por agente e por tema, cada um com `n` e `n_medido`.

Regras de redacao (o leitor e agente, nao analista):
- metrica ausente sai como **"sem dado"**, NUNCA como 0. Zero e medicao, ausencia nao e.
- corte com `n < 20` sai com o selo de amostra insuficiente (mesmo dono da regra do best-time,
  `skills/_shared/best-time-gate.cjs`) e e DESCRITIVO, nao recomendacao.
- correlacao nunca vira causa: "nas N pecas medidas, X aparece junto de maior alcance".
- LinkedIn casa por proximidade de timestamp: o publisher grava `urn:li:share:...` e o analyzer
  raspa `urn:li:activity:...`, ids diferentes da mesma peca. Ver `skills/_shared/post-key.cjs`.
- Story do IG fica fora do join (sem permalink, metrica agregada por dia), contado a parte.

Self-checks: `node skills/ct-social-cockpit/pieces.cjs` e `node skills/_shared/post-key.cjs`.
Guarda do fluxo: `npm run check:join`.

## REGRA DURA: best-time com n<20 NAO e recomendacao

`[MECANICA]` Um `best_time` apoiado em amostra pequena demais nao orienta decisao, e a maioria dos clientes novos comeca assim. Ver amostra real por cliente/rede em `clients/{slug}/brand-profile.md` (secao Cockpit) quando registrada.

**Amostra baixa normalmente nao e falta de coleta. E falta de post** (cadencia real abaixo do volume que gera n suficiente).

`[HIPOTESE]` Quando a analise direta nao mostra sinal (n=1 ou n=2 nas horas de melhor mediana, diferenca entre horarios dentro do ruido), o cockpit trata como amostra insuficiente, nunca como recomendacao. Validar com os dados do cliente.

### O que o cockpit DEVE fazer

1. **O n que decide o gate e o n DA CELULA, nunca o total da plataforma.** `[MECANICA]` Erro a evitar: publicar `Melhor horario: Ter 13h (base: 30 posts)` (exemplo ilustrativo) enquanto a celula "Ter 13h" tinha **n=1**. Trinta posts espalhados em 7x24 celulas nao sao trinta amostras de terca as 13h. O gate ja fazia certo em `by_format` e errado em horario e dia; agora os tres usam o `n` do proprio corte (`best_slots[0].n`, `by_weekday[0].n`, `by_format[0].n`). Celula sem `n` (payload velho) conta como insuficiente: herdar o total era exatamente o bug.
2. **Se o n da celula < 20: NAO apresentar como recomendacao.** Renderizar `AMOSTRA INSUFICIENTE (n=X)`, e nunca "melhor horario: Xh". Na pratica isso significa que hoje **nenhuma celula hora-dia do Instagram passa**, e isso e o resultado correto, nao um defeito a contornar.
3. **Nunca omitir o n, e nunca exibir um n que nao seja o daquele corte.** Dono unico da regra: `skills/_shared/best-time-gate.cjs`. Check executavel: `npm test`.
3. **Nao inventar confianca.** "Nivel de confianca" derivado de n<20 e decoracao. Se n e baixo, o campo diz insuficiente, nao "baixa".
4. O `ct-diretor` le este painel **antes de produzir**. Um best-time de n=6 apresentado como recomendacao vira decisao editorial baseada em ruido, com cara de dado.

### Alternativa mais barata que acumular N

`[HIPOTESE]` `GET /me/insights?metric=online_followers&period=lifetime` pode responder com distribuicao por hora, e **nao depende de acumular posts nossos**. Ressalva critica que bloqueia o uso hoje: **a resposta nao documenta o fuso das chaves**. Se forem BRT, a leitura ("pico das 14h as 17h") e plausivel; se forem UTC, vira "pico das 11h as 14h BRT", implausivel pro Brasil. **Resolver o fuso antes de usar** (cruzar com o painel nativo do app).

### Divida de infra conhecida

`[HIPOTESE]` Se o `ct_social_insights` parar de ser atualizado, o cockpit que o `ct-diretor` le serve dado velho sem avisar. **Serie temporal** exige snapshot semanal rodando de verdade: com 2 a 3 dias de snapshot por conta, sem espacamento util, nao ha curva. Validar a data do ultimo snapshot de cada cliente.

## Ordem de execucao (pipeline completo)
1. Analyzers populam metricas: `ct-instagram-analyzer`, `ct-linkedin-analyzer`,
   `ct-youtube-analyzer`, `ct-tiktok-analyzer`
2. `ct-social-intel/compute.js` calcula best-time
3. `ct-social-cockpit/build.js` monta o painel
(No cron da Fase 4 isso roda automatico toda semana.)

## Leitura via SQL (agente)
```sql
SELECT payload FROM ct_social_insights
WHERE client_slug = '{slug}' AND kind = 'cockpit'
ORDER BY computed_at DESC LIMIT 1;
```

## Dependencias
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Sem deps npm (fetch nativo).
