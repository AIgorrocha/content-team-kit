---
name: ct-republicar-twitter
description: Republica posts do LinkedIn do cliente ativo no Twitter/X (contas no brand-profile, conta LinkedIn -> conta X do cliente), adaptando formato (single tweet ou thread). Use quando o usuario pedir "republicar no Twitter", "cross-post LinkedIn pro X", ou "postar threads no Twitter".
---

# ct-republicar-twitter

Adapta o LinkedIn da peca pra thread X, **enfileira** e **publica com o "pode"**. O publicador oficial
e `scripts/publishing/publish-x.mjs`: posta pelo navegador, na sessao logada DESTA marca
(`~/.playwright-x-{slug}`), sem chave de API. A fila fica em `content/{slug}/fila-x/pending`.

```bash
node scripts/publishing/adapt-linkedin-to-x.mjs --slug {slug-da-peca}      # gera thread-twitter.txt
node scripts/publishing/enqueue-x.mjs --slug {slug-da-peca}                # coloca na fila
node scripts/publishing/publish-x.mjs --login                              # 1 vez: a pessoa entra no X na janela
node scripts/publishing/publish-x.mjs --slug {slug-da-peca}                # MOSTRA a thread, nao publica
# depois do "pode" da pessoa, sobre o texto que voce mostrou:
node scripts/publishing/publish-x.mjs --slug {slug-da-peca} --pode         # publica de verdade
```

Regras do publicador: sem `--pode` nunca vai pro ar; cada tweet tem no maximo 280 caracteres (senao
para e diz qual); item publicado vai para `fila-x/posted/` (nunca posta duas vezes); com o link do
post, registra a peca em `ct_content_items` (`registerPublication()`). Para capturar o link, use
`X_HANDLE` (conta da marca, sem @) ou deixe o script ler o nome da conta na tela.

`post.js` (nesta pasta) e o fluxo antigo, a partir do JSON do scrape do LinkedIn. Usa o mesmo perfil
de navegador. **Nunca rode `post.js` e `publish-x.mjs` para o mesmo conteudo**, senao duplica o post.
Pesquisa (`ct-twitter-research`) nao usa esta skill.

Prioridade de input:
1. `content/{slug}/{reels|carousels}/{slug-peca}/thread-twitter.txt` se o pedido nomear o slug
2. JSON do `ct-linkedin-analyzer` (fluxo antigo)

## Como funciona (analogia simples)

Pensa num "editor" que le o que o cliente publicou no LinkedIn e reescreve em formato Twitter: se couber em 280 caracteres, vira 1 tweet; se nao couber, quebra em varios tweets numerados (thread), tipo "1/5", "2/5".

## Dependencias que ja existem

- **Scraper LinkedIn:** `skills/ct-linkedin-analyzer/scrape.js`, gera JSON em `output/linkedin-analyzer/{handle-linkedin}-YYYY-MM-DD.json`
- **Sessao Twitter logada:** perfil Chrome da marca em `~/.playwright-x-{slug}` (fora do repositorio), com login ativo na conta X da marca. Criado por `publish-x.mjs --login` ou `skills/ct-twitter-research/login-setup.js` (e o mesmo perfil)

## Fluxo

```
1. Scrape LinkedIn (ct-linkedin-analyzer)
        ↓
2. adapt.js le ultimo JSON LinkedIn
        ↓
3. adapta texto (single tweet ou thread 1/N)
        ↓
4. salva output/republicar-twitter/adapted-YYYY-MM-DD.json
        ↓
5. post.js --dry-run (imprime o que faria)
        ↓
6. revisao manual do usuario
        ↓
7. post.js (publica de verdade)
        ↓
8. atualiza output/republicar-twitter/posted-history.json (URNs ja publicados)
```

## Uso

```bash
# Reel/carrossel com thread-twitter.txt
node adapt.js --slug {slug-peca}
# ou
node adapt.js --from content/{slug}/reels/{slug-peca}/thread-twitter.txt

# 1. Scrape LinkedIn (se ainda nao fez hoje)
cd skills/ct-linkedin-analyzer && node scrape.js personal --handle {handle-linkedin-do-cliente}

# 2. Adaptar pro formato Twitter (LinkedIn scrape)
cd ../ct-republicar-twitter && node adapt.js

# 3. Dry-run (nao publica, so imprime)
node post.js --dry-run --limit 3

# 4. Publicar de verdade (comeca com 1 pra seguranca)
node post.js --limit 1
```

## Regras de adaptacao

- Texto <= 270 chars → 1 tweet
- Texto > 270 chars → thread, quebra por paragrafo/sentenca, cada parte <= 270, numeracao "N/T" no final
- Remove URLs `https://lnkd.in/*` e `https://www.linkedin.com/*` que referenciam o proprio post
- Preserva hashtags `#xxx` e mentions `@xxx` que nao sejam LinkedIn-specific
- Pula posts que o cliente nao e autor (reposts de terceiros)
- Pula URNs ja presentes em `posted-history.json`

## Limitacoes conhecidas

- Nao posta midias (video/foto) do LinkedIn, so texto
- Se detectar captcha ou bloqueio do X, para e reporta
- Delay aleatorio 5-10s entre threads pra respeitar rate limit
- Default `--limit 1` no post.js pra evitar disparos em massa sem querer
- Login: `node scripts/publishing/publish-x.mjs --login` ou `node skills/ct-twitter-research/login-setup.js` (Chrome visivel, handle+senha, nao Google).

## Arquivos

- `adapt.js`: le JSON LinkedIn, gera JSON adaptado pro Twitter
- `post.js`: le JSON adaptado, publica via Playwright
- `package.json`: scripts npm
- `.gitignore`: ignora node_modules e output local

## Saida (arquivos gerados)

- `output/republicar-twitter/adapted-YYYY-MM-DD.json`: posts prontos pra publicar
- `output/republicar-twitter/posted-history.json`: historico de URNs ja publicados (evita duplicar). Depois do post, `permalink` (x.com/status/id) entra no entry. Registrar a publicacao com `registerPublication()` de `scripts/publishing/_lib/register.mjs`.
