---
name: ct-instagram-analyzer
description: "Analisa contas Instagram (Business/Creator) via Graph API. Pega ultimos N posts (caption, tipo, engagement, timestamp, permalink) + insights por media (reach, impressions, saves, shares quando disponivel). Classifica por tipo, ranqueia top posts por engagement rate. Outputs JSON + markdown. Suporta multi-conta via tokens separados (conta pessoal + conta de empresa)."
---

# ct-instagram-analyzer - Analise de contas Instagram

## Quando usar

- Pedidos: "analisar meu Instagram", "top posts", "o que ta performando", "benchmark contra concorrente"
- Input para `ct-pesquisador` (historico proprio como base de decisao)
- Snapshot periodico (semanal/mensal) salvo em `content/research/`

## Contas suportadas

Le credenciais primeiro de `.env`, depois de `.env.local` (override) e.

Cada cliente ativo tem sua conta (handle, token env var, user ID env var) documentada em
`clients/{slug}/brand-profile.md`. Ver mapeamento atual entre clientes deste repo e suas
env vars em `skills/_shared/ig-accounts.cjs`.

Se uma das contas nao tiver token configurado, pula com warning (nao falha).

## Uso

```bash
cd skills/ct-instagram-analyzer
npm install

# Analisar todas as contas configuradas
node analyze.js

# Uma conta especifica
node analyze.js --account <chave>   # chave da conta em skills/_shared/ig-accounts.cjs

# Limite custom (default 30)
node analyze.js --limit 50
```

## Output

- `output/instagram-analyzer/{handle}-{YYYY-MM-DD}.json` - dados brutos
- `content/research/{YYYY-MM-DD}-instagram-analysis.md` - resumo consolidado

## Dados extraidos por post

```json
{
  "id": "17...",
  "media_type": "IMAGE|VIDEO|CAROUSEL_ALBUM|REELS",
  "caption": "...",
  "permalink": "https://www.instagram.com/p/.../",
  "timestamp": "2026-04-15T...",
  "thumbnail_url": "...",
  "like_count": 0,
  "comments_count": 0,
  "insights": {
    "reach": 0,
    "impressions": 0,
    "saved": 0,
    "shares": 0,
    "plays": 0
  }
}
```

## Perfil de terceiro (concorrente) via RapidAPI

A Graph API so enxerga as contas configuradas do cliente ativo. Pra qualquer perfil publico
que nao seja nosso (concorrente, referencia, perfil citado pelo usuario), usar o
RapidAPI `instagram-looter2`. Precisa de `RAPIDAPI_KEY` no `.env`.

Pitfall verificado (ago/2026): o endpoint `/profile` devolve HTTP 500. Usar
`/profile2`.

```bash
curl -s "https://instagram-looter2.p.rapidapi.com/profile2?username={USERNAME}" \
  -H "Content-Type: application/json" \
  -H "x-rapidapi-host: instagram-looter2.p.rapidapi.com" \
  -H "x-rapidapi-key: $RAPIDAPI_KEY"
```

Campos do perfil: `follower_count` (nao e `edge_followed_by.count` no
`/profile2`), `full_name`, `biography`, `is_verified`, `media_count` (pode vir
`null`), `category`, `external_url`.

O `/profile2` NAO devolve posts: `edge_owner_to_timeline_media` vem vazio. Logo,
de concorrente da pra tirar perfil e frequencia declarada, nao ranking de post
por engajamento. Free tier RapidAPI: cerca de 100 requests por mes. Perfil
privado nao devolve dados.

Formato curto de saida por perfil de terceiro:

```
## @{handle} ({seguidores} seguidores)
- Bio: {bio}
- Categoria: {categoria}
- Link: {external_url}
```

## Persistencia no Supabase (ct_metrics_snapshots)

Alem dos JSONs locais, o analyzer tenta fazer upsert automatico das metricas
no Supabase via `metrics-writer`. Em set/2026 isso falhou silenciosamente
com 404 `PGRST205` - o PostgREST tinha o schema cache desatualizado e nao
reconhecia `ct_metrics_snapshots`, mesmo a tabela existindo no PostgreSQL.

**Pitfall:** Nao concluir que a tabela nao existe so porque o PostgREST
devolve 404. Validar com conexao direta `pg` antes de criar tabela nova ou
desistir da persistencia.

**Workaround verificado:** Inserir via `pg` (conexao direta) com
`DATABASE_URL`/`POSTGRES_URL` do `.env`. Ver schema real e script de
referencia em `references/supabase-persistence.md`.

**Script pronto:** `scripts/persist-metrics.cjs` faz todo o pipeline -
carrega JSONs do `output/instagram-analyzer/`, busca `followers_count`
direto da Graph API (o JSON do analyzer nao expoe esse campo), faz
DELETE idempotente e reinsere posts + account summary. Rodar da
raiz do repo (precisa de `node_modules/pg`):

```bash
node skills/ct-instagram-analyzer/scripts/persist-metrics.cjs
node skills/ct-instagram-analyzer/scripts/persist-metrics.cjs --date 2026-09-28
```

## Limitacoes

- API Graph devolve `like_count` so pra media >=1 dia. Posts recentes podem vir sem.
- Insights exige permissao `instagram_manage_insights`. Se o token nao tiver scope, insights ficam vazios (skill reporta warning e segue).
- Token IGAA (conta pessoal) tem TTL de ~60 dias. Token EAAN (system user, conta de empresa) nao expira. Se der `OAuthException 190` na conta de empresa, NAO gerar IGAA novo no painel: copiar `META_ACCESS_TOKEN` para `INSTAGRAM_BUSINESS_ACCESS_TOKEN` (env da conta de empresa).
- Em token invalido/sessao expirada numa conta IGAA, pode aparecer `OAuthException 190`. Nao pare a rotina: use fallback publico via RapidAPI `instagram-looter2` para preservar snapshot basico (seguidores, bio, ultimos posts, likes, comments, legenda completa).
- **Pitfall (ago/2026):** o fallback `/profile2` do `instagram-looter2` passou a devolver apenas os dados do perfil; o campo `edge_owner_to_timeline_media` vem vazio. Portanto, quando `OAuthException 190` ocorrer numa conta IGAA, o snapshot do perfil (seguidores/bio) e salvo, mas os posts recentes nao sao recuperados pelo fallback. Renovar o token IGAA no Meta.
- Para contas com token `IGAA`, aceite analise mesmo sem `INSTAGRAM_USER_ID`: descubra perfil por `/me` e busque posts por `/me/media`.
- Resolver de credencial: `skills/_shared/ig-accounts.cjs`. Se uma conta tiver IGAA e system-user token configurados ao mesmo tempo, o analyzer ignora o IGAA e usa o `*_ACCESS_TOKEN` de system user.

## Aprendizados deste ambiente

- Contas com token IGAA respondem via `graph.instagram.com/me`.
- Contas com system user EAAN respondem via `graph.facebook.com` com user id proprio. O
  `OAuthException 190` tipico e IGAA de 60 dias vencido; RapidAPI so como fallback de
  emergencia, nao como fonte. Ver contas reais em `clients/{slug}/brand-profile.md`.
- Se `RAPIDAPI_KEY` faltar no `.env` do repo, checar outros arquivos de env da maquina antes de concluir que a conta ficou sem coleta.
- Para persistencia, os snapshots de Instagram entram bem em `ct_metrics_snapshots` (grain='post' + grain='account'). Ver `references/supabase-persistence.md` para schema real e workaround de inserção via `pg` quando PostgREST falha com PGRST205.
- **Pitfall (set/2026):** `impressions` pode vir zerado para todas as mídias mesmo com `reach` preenchido. Não é erro de coleta - é limitação de permissão/scope do token. Verificar se `instagram_manage_insights` está presente na renovação do token.
- **Pitfall (set/2026):** o JSON exportado pelo analyzer **não contém followers**. Para gravar no Supabase, buscar `followers_count` separado via `/me?fields=followers_count` (IGAA) ou `/{user-id}?fields=followers_count` (EAAN system user). O script `scripts/persist-metrics.cjs` já faz isso automaticamente.
