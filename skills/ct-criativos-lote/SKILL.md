---
name: ct-criativos-lote
description: "Fabrica de lote de criativo estatico/reel white-label (story, feed, reel) via Remotion, na identidade do cliente ativo. Gera stories/feeds/reels em serie a partir de um presets.json (texto + assets do cliente). Modo gratis (Remotion) por padrao; Higgsfield so com HIGGSFIELD_ENABLED=true. Use quando o usuario pedir lote de criativo de anuncio, varios stories/feeds/reels de uma vez, ou anuncio novo pro Instagram Ads do cliente ativo."
environment: local
---

# ct-criativos-lote (lote de criativo estatico/reel)

Dono: `ct-designer`. Gera peca de anuncio (story 1080x1920, feed 1080x1350,
reel 9:16 cinetico) em lote, na identidade do CLIENTE ATIVO desta pasta,
a partir de um arquivo de presets (texto) e assets (imagens) do cliente.

## Quando usar

- "gera um lote de criativo pro anuncio", "novo story/feed/reel de anuncio"
- "preciso de mais variacoes de anuncio pro Instagram Ads"

NAO usar pra: carrossel de feed organico (`ct-carrossel-gen`), reel
institucional/motion graphics (`ct-remotion`), video cinematografico IA
(`ct-video-higgsfield`).

## Tecnica x dado

A TECNICA (layout, animacao, componentes React) mora neste repo, generica e
white-label: `remotion/src/StaticCreative.tsx`, registrada em `remotion/src/Root.tsx`
como 3 composicoes: `StaticCreativeStory`, `StaticCreativeFeed`, `StaticCreativeReel`.
Nenhuma cor, texto, logo ou nome de marca fixo ali: tudo vem de props.

O DADO de cada cliente fica em `clients/{slug}/criativos/`:
- `presets.json` (tema + assets + textos de cada peca)
- `assets/` (as imagens: logo, foto, mockup)

## Schema de `clients/{slug}/criativos/presets.json`

```json
{
  "theme": {
    "bg": "#f2f4f3", "ink": "#1a1a1a", "grey": "#41504d",
    "accent": "#01878E", "accentDark": "#0a6a70",
    "bubble": "#dff2d4", "watermark": "#e7ecea"
  },
  "assets": {
    "logo": "{slug}/logo-full.png",
    "logoIcon": "{slug}/logo-icon.png",
    "workerPhoto": "{slug}/worker.png",
    "appMockup": "{slug}/appmockup.png"
  },
  "stories": {
    "chave-do-preset": {
      "variant": "worker",
      "persona": "Trecho em destaque,",
      "headline": "resto da frase.",
      "subhead": [{ "t": "texto normal " }, { "t": "texto em negrito", "bold": true }],
      "cta": "Texto do botao",
      "workerSrc": "{slug}/foto-alternativa.png",
      "cleanPhoto": false,
      "hfImagePrompt": "prompt em ingles pro Higgsfield (opcional)"
    }
  },
  "feeds": { "...": "mesmo shape de stories" },
  "reels": {
    "chave-do-preset": {
      "persona": "...", "headline": "...", "subhead": [...], "cta": "...",
      "captions": ["legenda 1", "legenda 2", "..."],
      "hfVideoPrompt": "prompt em ingles pro Higgsfield i2v (opcional)"
    }
  }
}
```

- `variant`: `"worker"` (foto de pessoa, bleed direita) ou `"appmockup"` (banda
  com imagem de produto). Reel sempre usa `"worker"`.
- `stories`/`feeds` usam o mesmo shape. `reels` nao tem `variant` (fixo worker)
  e ganha `captions`.
- `hfImagePrompt`/`hfVideoPrompt` sao opcionais: so obrigatorios se for gerar
  aquele preset em modo Higgsfield (pago).

`assets/` do cliente (`clients/{slug}/criativos/assets/`) e copiado pra
`remotion/public/{slug}/` antes de cada render (o script faz isso sozinho).

## Fluxo

1. Confirmar cliente ativo (`clients/active-client.md` -> slug).
2. Se `clients/{slug}/criativos/presets.json` nao existir, criar com o usuario
   (persona/headline/subhead/cta/captions na voz do cliente, ver
   `brand-profile.md`). Assets (logo, foto, mockup) em
   `clients/{slug}/criativos/assets/`.
3. Listar presets disponiveis:
   ```bash
   node scripts/criativos/emit-props.mjs
   ```
4. Gerar o lote (modo gratis, Remotion, zero credito):
   ```bash
   node scripts/criativos/generate-batch.mjs --angle <chave>                # story + reel
   node scripts/criativos/generate-batch.mjs --angle <chave> --still-only   # so a story
   node scripts/criativos/generate-batch.mjs --angle <chave> --format feed  # so o feed
   node scripts/criativos/generate-batch.mjs --angle <chave> --format reel  # so o reel
   ```
5. Saida em `output/{slug}/criativos/`. Se `R2_*` estiver configurado no `.env`,
   sobe tambem pro Cloudflare R2 (`social/gen/{slug}-{tipo}-{angle}.{ext}`);
   sem env, fica em dry-run (so mostra onde subiria).
6. Rodar `node scripts/criativos/verify-asset.mjs <arquivo>` se quiser conferir
   um arquivo isolado (dimensao, imagem nao-preta, video sem frame preto/pisca;
   ja roda sozinho dentro do generate-batch).
7. Mostrar os arquivos gerados pro usuario. NUNCA publicar sem aprovacao.

## Modo gratis (default) x modo pago (Higgsfield)

- **Gratis (default):** renderiza tudo local via Remotion, a partir do
  `presets.json`. Zero credito.
- **Higgsfield (`HIGGSFIELD_ENABLED=true`):** usa `nano_banana` pra imagem e
  `kling2_6` i2v pro video, via CLI oficial `higgsfield`. Exige que o preset
  do angulo tenha `hfImagePrompt` (e `hfVideoPrompt` pro reel). O script
  calcula o custo REAL (`higgsfield generate cost`) e aborta se passar do
  teto (30 creditos por lote). SEMPRE aprovar com o usuario antes de rodar com
  a flag ligada (vai gastar credito de verdade).

## Upload R2

`scripts/criativos/upload-r2.mjs` so sobe de verdade com as env `R2_*`
configuradas (`.env.local` ou `.env`). Sem elas, dry-run (mostra o que subiria
e sai 0, sem erro).

## Regras

- Tema, assets e copy SEMPRE do `clients/{slug}/criativos/` do cliente ativo.
  Nunca hardcodar cor/texto/logo na tecnica (`StaticCreative.tsx`).
- Copy: PT-BR, sem travessao, voz do `brand-profile.md` do cliente.
- Video final/imagem final em `output/{slug}/criativos/`, nunca versionado
  direto no repo pra cliente de fora (cliente com pasta propria gera na pasta dele).
- NUNCA publica automatico. Aprovacao do usuario antes de subir credito pago ou
  publicar a peca.

## Referencias

- Tecnica: `remotion/src/StaticCreative.tsx`, registrada em `remotion/src/Root.tsx`.
- Scripts: `scripts/criativos/{emit-props,generate-batch,hf-invoke,upload-r2,verify-asset}.mjs`.
- Cliente ativo: `scripts/_lib/workspace-client.mjs`.
- Agente dono: `agents/ct-designer.md`.
