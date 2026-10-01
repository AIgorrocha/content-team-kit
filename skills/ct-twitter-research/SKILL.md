---
name: ct-twitter-research
description: "Pesquisa no Twitter/X via scraping autenticado com Playwright, feed, bookmarks e buscas por keywords. Vale pra qualquer cliente com Twitter/X listado no brand-profile. Usa sessao persistente (storageState.json) pra evitar login a cada execucao. Extrai autor, texto, midia, engagement, links (com enfase em repos GitHub citados) e insere em ct_competitor_posts com source_type='twitter_research'."
environment: local
---

# ct-twitter-research: Pesquisa no X/Twitter via Playwright

## Nao publica

Esta skill so pesquisa (timeline, bookmarks, search). Nao le `fila-x/`.
Nao chama `post.js`. Nao posta peca do Content Team. A fila de publicacao do X fica em `content/{slug}/fila-x/pending` e e publicada pela skill `ct-republicar-twitter` (`scripts/publishing/publish-x.mjs`), nunca por esta.

## Quando usar

- Cliente ativo precisa listar Twitter/X no `brand-profile.md`. Sem essa secao, nao rodar.
- Frequencia sugerida: semanal (o cliente ja cura o feed que segue, entao o feed sozinho ja e insight de alta qualidade)
- Triggers:
  - Pedido explicito de "pesquisa no Twitter" / "o que ta bombando no X sobre {tema do nicho}"
  - Etapa 5 da skill `ct-pesquisa` quando o cliente ativo tem Twitter/X no brand-profile (Twitter e a 5a fonte, alem de Instagram, LinkedIn, Reddit e GitHub)

## Conta usada

- Handle e email da conta: ver `clients/{slug}/brand-profile.md`
- 2FA: nenhum
- Keywords de busca: definidas no `brand-profile.md` do cliente; passar em `--keywords` ou na variavel `X_KEYWORDS`

## Arquivos da skill

| Arquivo | Funcao |
|---------|--------|
| `SKILL.md` | Este documento |
| `login-setup.js` | Abre Chromium nao-headless pra o usuario logar manualmente. A sessao fica no perfil da marca (`~/.playwright-x-{slug}`). Rodar 1x (ou quando sessao expirar) |
| `scrape.js` | Script principal. Subcomandos: `timeline`, `bookmarks`, `search --keywords "termo1,termo2"` |
| `~/.playwright-x-{slug}/` | Perfil do navegador da marca, com a sessao logada (fora do repositorio, um por marca) |
| `.gitignore` | Garante que credenciais/sessao nao vazam |
| `package.json` | Dependencias (playwright) |

## Primeiro uso (setup inicial, o usuario roda)

```bash
cd skills/ct-twitter-research
npm install
node login-setup.js
```

Vai abrir uma janela do Chromium. o usuario faz login normal em x.com com a conta X do cliente. Depois de logado, volta no terminal e pressiona ENTER. A sessao fica salva no perfil da marca e serve tambem para o publicador (`publish-x.mjs`).

**Quando a sessao expira** (Twitter desloga depois de X semanas de inatividade ou detecta bot): rodar `login-setup.js` de novo.

## Uso normal (Claude roda)

```bash
# Feed (timeline home)
node scrape.js timeline --limit 50 --out ../../output/twitter-research/timeline-$(date +%Y-%m-%d).json

# Bookmarks (posts que o cliente salvou)
node scrape.js bookmarks --limit 100 --out ../../output/twitter-research/bookmarks-$(date +%Y-%m-%d).json

# Search por keywords (top tweets, ultimos 7 dias)
node scrape.js search --keywords "termo1,termo2,termo3" --out ../../output/twitter-research/search-$(date +%Y-%m-%d).json
```

## Dados extraidos por tweet

```json
{
  "tweet_id": "1834...",
  "url": "https://x.com/...",
  "author_name": "...",
  "author_handle": "@...",
  "text": "...",
  "created_at": "2026-04-19T...",
  "likes": 0,
  "reposts": 0,
  "replies": 0,
  "views": 0,
  "media": [{"type":"image|video","url":"..."}],
  "external_links": ["https://..."],
  "github_repos": ["owner/repo"],
  "is_bookmark": false,
  "is_repost": false
}
```

## Pos-processamento (Claude faz)

1. Ler JSON de saida
2. Filtrar por relevancia (keywords + engagement minimo)
3. Inserir em `ct_competitor_posts` via Supabase MCP:
   - `client_slug` = '{slug}'
   - `source_type` = 'twitter_research'
   - `competitor_name` = author_handle (ou 'bookmark'/'search' pros casos de curadoria)
   - `platform` = 'twitter'
   - `post_text` = text
   - `engagement_score` = likes + reposts + replies
   - `post_url`, `analyzed_at` = NOW(), `metadata` = {github_repos, external_links, views, media}
4. Gerar resumo em `content/{slug}/pesquisa/YYYY-MM-DD-twitter-insights.md` com:
   - Top 10 tweets por engagement
   - Repos GitHub mais citados na semana
   - Temas emergentes (agrupar por keyword)
   - Sugestoes de adaptacao pro tom do cliente

## Limitacoes conhecidas

- **Sessao expira.** Twitter invalida cookie de tempos em tempos. Quando scrape.js retornar erro "login redirect", rodar `login-setup.js` de novo.
- **Rate limit.** X limita navegacao rapida. Scrape.js ja tem delays (2-5s entre scrolls). Nao rodar em paralelo.
- **UI muda.** X muda layout de tempos em tempos. Se seletores quebrarem, atualizar `scrape.js` (seletores centralizados no topo do arquivo).
- **TOS do X.** Scraping autenticado da propria conta pra uso pessoal/pesquisa esta em zona cinza. Nao redistribuir conteudo sem atribuicao. Nao usar pra volume alto (>500 tweets/dia).
- **Headless = false recomendado em dev.** X detecta headless com relativa facilidade. Scripts usam `headless: false` quando em modo debug (flag `--debug`).

## Avisos de compliance

- Essa skill usa a conta PROPRIA do cliente. Nao scrape contas de terceiros sem relacao.
- Bookmarks sao privados, tratamos como insumo interno, nunca republica conteudo de terceiros sem consentimento.
- Respeitar LGPD: dados pessoais de autores (handle, nome) ficam apenas no banco interno `ct_competitor_posts`. Nao exportar pra logs publicos.

## Seletores criticos (ajustar quando X mudar UI)

No topo de `scrape.js`:

```js
const SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  likes: '[data-testid="like"]',
  reposts: '[data-testid="retweet"]',
  replies: '[data-testid="reply"]',
  timestamp: 'time',
  link: 'a[role="link"]'
};
```
