---
name: ct-story
description: "Renderiza Stories do Instagram como PNG (1080x1920) via HTML + Playwright. O conteudo e o arco vem do ct-story."
agent: ct-story
triggers:
  - "gerar stories"
  - "criar stories"
  - "story instagram"
  - "fazer story"
---

# Story Generator - Renderizar Stories Instagram via HTML + Playwright

Renderiza Stories do Instagram em 2 formatos: texto puro e texto com imagem.
Metodo UNICO: HTML renderizado no Playwright + screenshot PNG 1080x1920.

## Esta skill NAO decide conteudo

Esta skill e o BRACO DE RENDER. Quem decide o que vai em cada tela, em que ordem e
por que, e o agente `ct-story` (`agents/ct-story.md`), seguindo
`references/stories-playbook.md` (arco, tipos, voz) e
`references/instagram-stories-algorithm.md` (o que a plataforma premia).

Se voce chegou aqui sem textos aprovados pelo usuario, PARE e devolva pro `ct-story`.

## REGRAS ABSOLUTAS

- **UNICO METODO:** HTML + Playwright screenshot
- **PROIBIDO:** nano-banana, Pillow, IA generativa, canvas manual
- Sequencia PADRAO: 3 a 5 telas com arco narrativo (gancho, tensao, virada, insight,
  fechamento). Story avulso sem arco nao existe. Ver `stories-playbook.md`
- Os 4 tipos: BASTIDOR, ROTINA, DISCUSSAO, INSIGHT. Storytelling e o ponto, nao enfeite
- **NAO vender** nestes 4 tipos. Sem link, sem "arraste pra cima", sem oferta.
  Fechamento e pergunta aberta ou caixinha nativa
- "Comenta PALAVRA" nao existe em Story (esse CTA e de legenda de post IG/TikTok/YouTube Shorts)
- Tom natural, salvo registro formal definido no `brand-profile.md` (a marca manda)
- O texto da tela e para o SEGUIDOR: nunca linguagem de processo da producao ("versao", "ajuste", "briefing")
- Zero travessao e traco longo. Acentuacao completa, UTF-8
- SEM @handle no template (so texto)
- **CONFIRMAR textos com o usuario ANTES de renderizar.** Regra dura: aprovar antes de gerar
- Definir o cliente antes de montar os stories: cada cliente usa contextos diferentes (ver design-system.md)
- Imagem e prova, nao decoracao. Sem imagem e melhor que imagem generica

Historico: ate jul/2026 esta skill dizia "maximo 2-3 stories" e "sempre informativos,
nunca storytelling". Foi substituido pelo arco de 3-5 telas do `stories-playbook.md`.

## Adaptação por cliente

A adaptacao por cliente (tom, fundo, temas preferidos, linguagem a evitar) fica em
`clients/{slug}/brand-profile.md` e `clients/{slug}/design-system.md` de cada cliente.

## Design System

Fundo, cor do texto e fonte vem dos tokens da marca em `clients/{slug}/design-system.md` (leia antes de montar o HTML e preencha `${bg}`, `${fg}`, `${fontFamily}` e `${fontImport}` dos templates). Sem tokens definidos, use o padrao neutro abaixo e avise o usuario.

| Propriedade | Valor (padrao neutro, quando a marca nao define) |
|-------------|-------|
| Dimensao | 1080 x 1920 px |
| Fundo | #0D0D0D (`${bg}`) |
| Texto | #FFFFFF (`${fg}`) |
| Fonte | Inter, sans-serif (`${fontFamily}`) |
| Peso fonte | 400 (regular) |
| Tamanho fonte | 46px |
| Line-height | 1.5 |
| Padding container | 80px 72px |

## Formato 1: Texto Puro (sem imagem)

Template HTML completo:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fontImport}  /* padrao neutro: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); */

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1080px;
    height: 1920px;
    background: ${bg};
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ${fontFamily}; /* padrao: 'Inter', 'Segoe UI', system-ui, sans-serif */
  }

  .container {
    width: 100%;
    padding: 80px 72px;
  }

  .text {
    font-size: 46px;
    line-height: 1.5;
    color: ${fg};
    font-weight: 400;
    white-space: pre-wrap;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="text">${text}</div>
  </div>
</body>
</html>
```

## Formato 2: Texto com Imagem

A imagem ocupa a metade superior (1080x960) e o texto fica na metade inferior com padding.

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${fontImport}  /* padrao neutro: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); */

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1080px;
    height: 1920px;
    background: ${bg};
    display: flex;
    flex-direction: column;
    font-family: ${fontFamily}; /* padrao: 'Inter', 'Segoe UI', system-ui, sans-serif */
  }

  .image-area {
    width: 1080px;
    height: 960px;
    overflow: hidden;
  }

  .image-area img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text-area {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 60px 72px;
  }

  .text {
    font-size: 42px;
    line-height: 1.5;
    color: ${fg};
    font-weight: 400;
    white-space: pre-wrap;
  }
</style>
</head>
<body>
  <div class="image-area">
    <img src="${imagePath}" alt="">
  </div>
  <div class="text-area">
    <div class="text">${text}</div>
  </div>
</body>
</html>
```

**Nota:** No formato com imagem, o font-size e 42px (menor que texto puro) pra caber bem na metade inferior.

## Step 1: Receber textos dos stories

O usuario fornece os textos separados por STORY 1, STORY 2, etc.
Se o pedido vier só como "faz um story", "frase do story" ou "capa", sem contexto suficiente, pedir antes: cliente, tema, objetivo e se haverá imagem.
Exemplo:

```
STORY 1:
Se voce ja e cliente do plano anual, olha isso...

A empresa esta dando um desconto ate sexta.

STORY 2:
Pra ativar e simples: entra na sua conta, abre a area de beneficios, pronto.

O desconto fica valido por 7 dias.
```

Antes de gerar qualquer imagem:
1. Listar TODOS os textos dos stories
2. Indicar o formato de cada um (texto puro ou texto com imagem)
3. Mostrar ao usuario para aprovacao
4. SO gerar imagens apos confirmacao

## Step 2: Gerar HTML de cada story

Para CADA story, criar um arquivo HTML usando o template adequado (texto puro ou texto com imagem).
Salvar em pasta temporaria de trabalho.

## Step 3: Screenshot com Playwright

Para CADA arquivo HTML, tirar screenshot PNG 1080x1920:

```javascript
const { chromium } = require('playwright');
const path = require('path');

async function generateStories(stories) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1 // 1 = PNG 1080x1920 (com 2 sairia 2160x3840, fora do padrao do Instagram)
  });

  for (let i = 0; i < stories.length; i++) {
    const page = await context.newPage();
    await page.setContent(stories[i].html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const num = String(i + 1).padStart(2, '0');
    await page.screenshot({
      path: `story-${num}.png`,
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1920 }
    });

    console.log(`Story ${num} gerado`);
    await page.close();
  }

  await browser.close();
}
```

Ou via CLI:

```bash
npx playwright screenshot \
  --browser chromium \
  --viewport-size "1080,1920" \
  --full-page \
  "file:///caminho/story-01.html" \
  "story-01.png"
```

## Step 4: Salvar conteudo final

Salvar os PNGs na pasta do cliente:

```
content/{cliente}/stories/{nome-do-story}/
  story-01.png
  story-02.png
  generate-stories.js   (script pra regenerar)
```

## Step 5: Upload pro Supabase Storage (OPCIONAL: so para publicar)

A Graph API do Instagram so aceita URL publica de imagem. Por isso o upload so e necessario quando o usuario for publicar (Step 7). Para so renderizar e entregar os PNGs, pule este passo e o Step 6.

Bucket: `content-media` (o mesmo do resto do kit; `scripts/publishing/sync-content-media.mjs` cria o bucket publico se ele nao existir). Chave de servico: `SUPABASE_SERVICE_ROLE_KEY` (em `.env.local`, nunca em commit). Nao ha bucket `story-images` nem migration para ele.

```bash
for f in story-*.png; do
  FILENAME=$(basename "$f")
  curl -s -X POST "$SUPABASE_URL/storage/v1/object/content-media/{slug}/stories/{nome}/$FILENAME" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: image/png" \
    -H "x-upsert: true" \
    --data-binary "@$f"
done
```

URL publica de cada PNG: `$SUPABASE_URL/storage/v1/object/public/content-media/{slug}/stories/{nome}/story-01.png`.

## Step 6: Registrar no banco (se o kit usa Supabase)

Registrar cada story no banco `ct_content_items` (`media_urls` so existe depois do upload do Step 5; sem upload, deixe vazio):

```sql
INSERT INTO ct_content_items (
  client_slug,
  content_type,
  title,
  status,
  platform,
  scheduled_date,
  scheduled_time,
  media_urls
) VALUES (
  '{slug}',
  'story',
  '{titulo-descritivo}',
  'ready',
  'instagram',
  '{data}',
  '{hora}',
  ARRAY['{url_story_01}', '{url_story_02}']
);
```

## Step 7: Publicar (quando aprovado)

Publicar so com o "pode" explicito do usuario, pela skill `ct-publicar-ig` (`skills/ct-publicar-ig/SKILL.md`), que usa o script:

```bash
node scripts/publishing/publish-ig-stories.mjs --client {slug} --slug {nome} \
  --image-url <url-story-01.png> --image-url <url-story-02.png> ...
```

- As URLs sao as do Step 5, repetidas na ordem de publicacao (o script publica 1 por vez, com intervalo).
- `--dry-run` confere token e permissao sem publicar.
- Story de imagem nao tem legenda pela API: o texto ja esta na imagem.

## Fluxo Completo Resumido

1. Receber textos dos stories (STORY 1, STORY 2, etc)
2. Definir formato de cada um (texto puro ou texto com imagem)
3. Confirmar com usuario
4. Gerar HTML para cada story
5. Screenshot Playwright -> PNG (1080x1920)
6. Salvar em `content/{cliente}/stories/{nome}/`
7. (Opcional, so para publicar) Upload Supabase Storage (bucket `content-media`)
8. Registrar no banco `ct_content_items` (content_type='story')
9. (Quando aprovado, com "pode") Publicar via `ct-publicar-ig` / `scripts/publishing/publish-ig-stories.mjs`

## Arquivo de Referencia

Sem exemplo pronto numa instalacao nova: use o script do Step 3 como base. Em marca ja rodada, ver `content/{slug}/stories/*/generate-stories.js` de qualquer cliente ja rodado.

## Troubleshooting

- **Fonte da marca nao carrega:** Verificar internet. Fallback: `font-family: 'Inter', Arial, sans-serif`
- **Playwright nao instalado:** Rodar `npx playwright install chromium`
- **Texto cortado:** Reduzir texto ou font-size. Maximo ~150 palavras por story texto puro
- **Imagem nao aparece:** Verificar caminho absoluto da imagem no HTML
- **Tamanho errado (2160x3840):** `deviceScaleFactor` tem que ser 1 no context
