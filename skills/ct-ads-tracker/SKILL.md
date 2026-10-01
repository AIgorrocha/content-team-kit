---
name: ct-ads-tracker
description: "Analise completa de campanhas Meta Ads das contas do Content Team. Usar quando o usuario pedir para ver campanhas, analisar ads, verificar performance, pausar/ativar campanhas, ajustar orcamento, ou qualquer variacao de 'como estao os anuncios'."
---

# CT Ads Tracker - Analise de Campanhas Meta Ads

Coleta e analisa dados das contas Meta Ads dos clientes do Content Team, gera relatorio consolidado com recomendacoes.

## Credenciais

Ler do `.env` do repo (e `.env.local` como override):

| Variavel | Uso |
|---|---|
| `META_ACCESS_TOKEN` | Meta Marketing API (System User que cobre as contas configuradas) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | gravar snapshot |

Os Ad Account IDs NAO ficam fixos nesta skill: cada cliente declara o dele em
`clients/{slug}/brand-profile.md`, no campo `meta_ad_account` (ex: `meta_ad_account: act_XXXXXXXXXXXX`).
Se o cliente ativo nao tiver esse campo, tentar a env `META_AD_ACCOUNT_ID` como fallback.
Sem nenhum dos dois, perguntar ao usuario o Ad Account ID antes de coletar.

Notas:
- `ct_instagram_accounts.access_token` pode estar desatualizado em alguma conta.
  Se a Graph API devolver erro de OAuth, cair pra `META_ACCESS_TOKEN` como
  fallback de leitura.
- Uma mesma conta de anuncio (portfolio) pode servir mais de um cliente ao mesmo
  tempo (ver secao abaixo). Nesse caso, TODOS os clientes que compartilham a
  conta apontam o mesmo `meta_ad_account` no proprio brand-profile.

## Contas de Anuncio

Esta skill audita as contas dos clientes ativos deste repo (o `meta_ad_account`
de cada `clients/{slug}/brand-profile.md`). Conta de anuncio de outro produto ou
empresa fora deste framework nao entra aqui.

### Conta compartilhada por mais de um cliente

Quando dois clientes rodam campanhas na MESMA conta de anuncio (mesmo portfolio),
documentar isso explicitamente no brand-profile de cada um e usar o mesmo
`meta_ad_account` (ver `meta_ad_account` nos respectivos brand-profile.md).

### REGRA CRITICA: Diferenciacao dentro de uma conta compartilhada

Quando a conta tem campanhas de mais de um cliente no mesmo portfolio, diferenciar
pelo NOME da campanha/anuncio e pelo CONTEUDO, usando as palavras-chave de cada
cliente (ver `brand-profile.md`, secao pilares/nicho de cada um).

**SEMPRE** separar no relatorio: mostrar as campanhas de conta compartilhada divididas por cliente.
Se nao for possivel identificar, perguntar ao usuario.

### Objetivo das campanhas de impulsionamento de post

Quando a campanha e **impulsionamento de post** via Instagram (objetivo LINK_CLICKS, visita ao perfil),
a metrica principal e **engajamento e crescimento de seguidores**, NAO conversao/landing page.

Metricas relevantes pra essas campanhas:
- `page_engagement`: interacoes totais (curtidas + comentarios + saves + shares + views)
- `post_reaction`: curtidas
- `comment`: comentarios
- `onsite_conversion.post_save`: saves (indica conteudo valioso)
- `video_view`: views de video/reel
- `onsite_conversion.messaging_first_reply`: DMs recebidas

### Seguidores, como medir

A API do Meta NAO retorna seguidores ganhos por campanha pra objetivo LINK_CLICKS.
O endpoint `follower_count` period=day retorna delta 0 quando volume e baixo.

**Solucao: snapshot automatico de seguidores via API.**

SEMPRE rodar em paralelo com a coleta de ads, usando o Instagram Business ID de
cada cliente ativo (fonte: `skills/_shared/ig-accounts.cjs`, ou `ct_instagram_accounts` no banco):

```bash
curl -s "https://graph.facebook.com/v21.0/{IG_BUSINESS_ID}?fields=username,followers_count&access_token=$TOKEN"
```

Salvar o snapshot na memoria (`project_followers_snapshot.md`) toda vez que rodar.
Calcular delta comparando com o snapshot anterior.
Custo/seguidor = gasto da semana / (followers_atual - followers_anterior).

Custo por engajamento = gasto / page_engagement (bom: menor que R$ 0,10, ruim: maior que R$ 0,30)
Custo por seguidor = gasto / seguidores ganhos (bom: menor que R$ 1,00, ruim: maior que R$ 3,00)

## Workflow

### 1. Coleta de dados (TODAS as contas configuradas, em PARALELO)

Montar a lista de Ad Account IDs a partir do `meta_ad_account` de cada cliente
ativo (deduplicar quando mais de um cliente compartilha a mesma conta) e
executar os curls abaixo pra CADA ID, todos em paralelo (mesmo tool call):

```bash
TOKEN="TOKEN_DO_CREDENTIALS_MD"
AD_ACCOUNT="act_XXXXXXXXXXXX"

# Campanhas
curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/campaigns?fields=name,status,objective,daily_budget,lifetime_budget,created_time&access_token=$TOKEN"

# Insights por campanha (7d)
curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=campaign_name,impressions,reach,clicks,cpc,ctr,spend,actions,cost_per_action_type&level=campaign&date_preset=last_7d&access_token=$TOKEN"

# Insights por anuncio (7d)
curl -s "https://graph.facebook.com/v21.0/$AD_ACCOUNT/insights?fields=ad_name,impressions,reach,clicks,cpc,ctr,spend,actions&level=ad&date_preset=last_7d&access_token=$TOKEN"
```

### 2. Detalhamento (opcional, sob demanda)

```bash
# Demographics por idade/genero
curl -s "https://graph.facebook.com/v21.0/act_{ID}/insights?fields=impressions,clicks,spend&breakdowns=age,gender&level=campaign&date_preset=last_7d&access_token=$TOKEN"

# Por posicionamento (feed, stories, reels)
curl -s "https://graph.facebook.com/v21.0/act_{ID}/insights?fields=impressions,clicks,spend&breakdowns=publisher_platform,platform_position&level=campaign&date_preset=last_7d&access_token=$TOKEN"

# Por regiao
curl -s "https://graph.facebook.com/v21.0/act_{ID}/insights?fields=impressions,clicks,spend&breakdowns=region&level=campaign&date_preset=last_7d&access_token=$TOKEN"

# Timeline diaria de uma campanha
curl -s "https://graph.facebook.com/v21.0/{CAMPAIGN_ID}/insights?fields=impressions,reach,clicks,spend,cpc,ctr&time_increment=1&date_preset=last_7d&access_token=$TOKEN"
```

### 3. Acoes (REQUER APROVACAO do usuario)

```bash
# Pausar campanha
curl -s -X POST "https://graph.facebook.com/v21.0/{CAMPAIGN_ID}?status=PAUSED&access_token=$TOKEN"

# Ativar campanha
curl -s -X POST "https://graph.facebook.com/v21.0/{CAMPAIGN_ID}?status=ACTIVE&access_token=$TOKEN"

# Alterar orcamento diario da CAMPANHA (em centavos: R$20 = 2000)
curl -s -X POST "https://graph.facebook.com/v21.0/{CAMPAIGN_ID}?daily_budget={CENTAVOS}&access_token=$TOKEN"

# Alterar orcamento diario do ADSET (quando campanha usa budget de adset)
curl -s -X POST "https://graph.facebook.com/v21.0/{ADSET_ID}?daily_budget={CENTAVOS}&access_token=$TOKEN"

# Buscar adsets de uma campanha
curl -s "https://graph.facebook.com/v21.0/{CAMPAIGN_ID}/adsets?fields=id,name,daily_budget,status&access_token=$TOKEN"
```

## Formato do Relatorio

```markdown
# Relatorio Ads (data, 7 dias)

## Conta: [nome do portfolio], [@handle do cliente]

### Campanhas (filtrar pelas palavras-chave do cliente quando a conta e compartilhada)
| Campanha | Status | Imp | Alcance | Cliques | CTR | CPC | Gasto |
|----------|--------|-----|---------|---------|-----|-----|-------|

### Criativos (ranking por CTR)
| Criativo | Imp | Cliques | CTR | CPC | Gasto |
|----------|-----|---------|-----|-----|-------|

### Gasto total: R$ X. Budget diario: R$ X

[repetir bloco acima para cada cliente/conta]

## Consolidado (um cliente por coluna)

| Metrica | [Cliente A] | [Cliente B] | Total |
|---------|-------------|-------------|-------|
| Gasto 7d | R$ X | R$ X | R$ X |
| Impressoes | X | X | X |
| Cliques | X | X | X |
| CTR medio | X% | X% | X% |
| CPC medio | R$ X | R$ X | R$ X |

## Recomendacoes
- [acoes concretas baseadas nos dados]
```

## Metricas Importantes (cheat sheet)

| Metrica | O que significa | Bom | Ruim |
|---------|----------------|-----|------|
| CTR | % de quem viu e clicou | maior que 2% | menor que 1% |
| CPC | Custo por clique | menor que R$ 0,50 | maior que R$ 1,00 |
| LPV | Landing page views (chegou no site) | maior que 70% dos cliques | menor que 50% |
| CPM | Custo por 1000 impressoes | menor que R$ 15 | maior que R$ 30 |
| Engagement | Curtidas + comentarios + saves | maior que 3% | menor que 1% |

## Sync pro Supabase (dashboard)

```bash
curl -s -X POST "http://localhost:5000/api/ads/sync" \
  -H "Cookie: ct-auth={JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

## Regras

1. **SEMPRE** coletar TODAS as contas configuradas, nunca analisar uma so
2. **NUNCA** executar acoes (pausar/ativar/budget) sem aprovacao do usuario
3. **SEMPRE** separar relatorio por conta/cliente pra ficar claro de qual e
4. **SEMPRE** rankear criativos por CTR, facilita decisao de pausar/escalar
5. Dados sensiveis (tokens) nunca expostos no output
6. Ao recomendar pausar, sempre justificar com dados comparativos
7. Numa conta compartilhada, identificar de qual cliente e a campanha pelo nome/conteudo
