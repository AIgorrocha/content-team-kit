---
name: ct-pesquisa
description: "Pesquisa profunda de concorrentes e tendências para criação de conteúdo. Analisa perfis do Instagram via RapidAPI (Instagram Looter), busca tendências no Reddit/X/LinkedIn/GitHub, coleta posts virais com engagement real, e gera relatório com sugestões de adaptação. Usar quando o usuário pedir pesquisa de concorrentes, análise de mercado, tendências do nicho, posts que estão bombando, ou planejamento de conteúdo baseado em dados."
---

# Pesquisa de Concorrentes e Tendências

## Pré-requisitos

- `RAPIDAPI_KEY` no .env (Instagram Looter: instagram-looter2.p.rapidapi.com)
- Lista de concorrentes em `clients/{slug}/competitors.md`
- Brand profile em `clients/{slug}/brand-profile.md`

## Fluxo Completo

### 1. Carregar Contexto

Ler `clients/active-client.md` → slug do cliente ativo.
Ler `clients/{slug}/competitors.md` → lista de handles.
Ler `clients/{slug}/brand-profile.md` → público-alvo e filtros de relevância.
Ler `clients/{slug}/regras-cliente.md` → regras e correções da marca (vencem o padrão desta skill).

### 2. Pesquisa Instagram (via RapidAPI)

Para cada concorrente, fazer 1 chamada:

```bash
curl -s "https://instagram-looter2.p.rapidapi.com/profile?username={handle}" \
  -H "Content-Type: application/json" \
  -H "x-rapidapi-host: instagram-looter2.p.rapidapi.com" \
  -H "x-rapidapi-key: $RAPIDAPI_KEY"
```

Extrair da resposta:
- `edge_followed_by.count` → seguidores
- `biography` → bio
- `edge_owner_to_timeline_media.edges` → últimos 12 posts

Para cada post extrair:
- `node.__typename` → GraphVideo=Reel, GraphSidecar=Carrossel, GraphImage=Imagem
- `node.edge_media_preview_like.count` → likes
- `node.edge_media_to_comment.count` → comments
- `node.edge_media_to_caption.edges[0].node.text` → legenda COMPLETA
- `node.taken_at_timestamp` → data (converter de Unix timestamp)

Calcular por concorrente:
- Índice de empurrão = (likes + comments) / seguidores * 100. É proxy contaminado de alcance, NÃO "taxa de engajamento" (nunca apresentar com esse nome; ver regra R2 em `agents/ct-pesquisador.md`). Rankear pela MEDIANA dos posts, separando o fixado do recente
- Top posts = ordenar por (likes + comments) DESC
- Formato dominante = contar GraphVideo vs GraphSidecar vs GraphImage
- Frequência = posts por semana (baseado em datas)

### 3. Pesquisa de Tendências (WebSearch)

Buscar em paralelo com WebSearch:

| Plataforma | Query |
|------------|-------|
| LinkedIn | "{tema do nicho do cliente} trending {mês} {ano}" |
| Reddit | "reddit {subreddits do nicho} top posts {mês} {ano}" |
| X/Twitter | "{tema do nicho} trending {ano}" |
| GitHub | "github trending {tema do nicho} repos {ano}" (so se o nicho for tecnico) |

#### Fonte 5 (so cliente com Twitter/X no brand-profile): Twitter/X via skill `ct-twitter-research`

Quando o `brand-profile.md` do cliente ativo lista Twitter/X, adicionar a skill `ct-twitter-research` como 5a fonte. Ela usa a sessao autenticada da conta do cliente (ex: @conta_do_cliente) pra capturar:

- **Timeline** (feed curado pelo proprio cliente: alto sinal)
- **Bookmarks** (tweets que o cliente salvou: maior sinal ainda)
- **Search** por keywords do nicho do cliente (definidas no `brand-profile.md`)

Rodar assim:

```bash
cd skills/ct-twitter-research
node scrape.js timeline --limit 50
node scrape.js bookmarks --limit 100
node scrape.js search --keywords "palavra1,palavra2,palavra3"
```

Saidas JSON em `output/twitter-research/`. Claude faz pos-processamento: filtra por engagement, extrai repos GitHub citados, insere em `ct_competitor_posts` com `source_type='twitter_research'` e `client_slug='{slug}'`.

**NAO RODAR pra cliente sem Twitter/X listado no brand-profile.md.**

Setup inicial do login: ver `skills/ct-twitter-research/SKILL.md`.

Filtrar por relevância ao público-alvo do cliente (brand-profile.md).

### 4. Gerar Relatório

Salvar em `content/{slug}/posts/pesquisa-concorrentes-{data}.md`:

```markdown
# Pesquisa de Concorrentes: {data}

## Resumo Executivo
| # | Handle | Seguidores | Índice de empurrão (mediana) | Formato | Freq/sem |

## Top Posts por Engagement (top 10)
Para cada post:
- Concorrente, likes, comments, formato
- Legenda COMPLETA (NUNCA truncar)
- Análise do gancho/hook

## Tendências da Semana
1. Tema, por que importa pro nosso público

## Sugestões de Adaptação
Para cada post viral:
- Título adaptado pro nosso tom
- Formato (carrossel/reel/post)
- Plataforma primária
- Gancho/hook adaptado
```

### 5. Salvar no Banco

Via Supabase MCP, inserir em `ct_competitor_posts`:
- competitor_name, platform, post_text, post_type
- engagement_score (likes + comments)
- analyzed_at, source_type

Atualizar `ct_competitors`:
- `last_scraped_at` = NOW()
- `metadata.followers_count` = contagem atual

## Regras Críticas

1. SEMPRE trazer legenda COMPLETA dos posts (NUNCA truncar)
2. SEMPRE mostrar posts reais pro usuário ESCOLHER quais adaptar
3. NUNCA inventar temas do zero, adaptar do que bombou
4. Entregar no idioma e no tom adequados ao cliente ativo
5. O critério principal é a MEDIANA do índice de empurrão dentro da mesma faixa de seguidores (nunca a média sozinha)
6. Separar concorrentes BR dos internacionais

## Análise de Post Individual (link do Instagram)

Quando receber um link do Instagram pra analisar:

1. Extrair username da URL (`instagram.com/{user}/...`)
2. Buscar via API: `GET /profile?username={user}`
3. Se for post específico, buscar nos `edge_owner_to_timeline_media.edges`
4. Retornar: formato, likes, comments, legenda completa, data
5. Sugerir adaptação com tom do cliente ativo

## Rate Limits

- RapidAPI free tier: ~100 requests/mês
- Fazer batch de todos os concorrentes de uma vez (1 request por perfil)
- Não repetir pesquisa do mesmo perfil no mesmo dia
