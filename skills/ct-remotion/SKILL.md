---
name: ct-remotion
description: "Gera videos animados por codigo (Remotion/React) na identidade visual do cliente ativo. Usa o projeto compartilhado remotion/ + a skill oficial remotion-best-practices. Pra reels animados, aberturas, lower-thirds, data-viz animada. Tema da marca gerado de clients/{slug}/design-system.md (node scripts/video/emit-theme.mjs {slug})."
---

# ct-remotion: Videos animados white-label (Remotion)

Ponte entre o Content Team AI e o Remotion (framework React pra video).
Gera videos animados na identidade do cliente ativo, renderiza MP4 local.

## Quando usar

- "fazer video animado", "abertura animada", "reel motion"
- "animar esses numeros/dados", "data-viz em video"
- "lower-third animado", "card animado pro reel"
- Qualquer video por codigo (nao avatar/HeyGen, nao Higgsfield cinematografico)

NAO usar pra: avatar falando (ct-video/HeyGen), video cinematografico IA
(ct-video-higgsfield), carrossel estatico (ct-carrossel-gen).

## Pre-requisitos

1. Skill oficial `remotion-best-practices`: instalar com `npx skills add remotion-dev/skills` (o assistente instala, com permissao, na primeira vez que for fazer video por codigo)
   (instalar com `npx skills add remotion-dev/skills` se faltar)
2. Projeto compartilhado em `remotion/` (ja versionado)
3. `cd remotion && npm install` (uma vez)

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui.

## Composicoes prontas (em `remotion/src/Root.tsx`)

| Composicao | Use para | Props principais |
|---|---|---|
| `AnimatedReel` | reel de titulos e subtitulos por cena | `themeSlug`, `showHandle`, `scenes[]` |
| `StoryScenes`, `StoryScenes16x9` | storytelling por cenas de texto grande sobre midia real (mudo ou com trilha), infografico com numero que conta, cartao final com logo. Mesmas props em 9:16 e 16:9 | `scenes[]` (kind video, image ou infographic), `endCard`, `audioSrc` |
| `BlurFillVideo` | video horizontal (16:9) virar vertical 9:16, fundo desfocado + video contido, texto e credito opcionais | `src`, `srcWidth`, `srcHeight`, `durationSec`, `topText`, `credit` |
| `DrawOn` | tracos SVG que se desenham sozinhos: assinatura, fluxo, contorno | `paths[]`, `caption` |
| `NarratedReel` | reel narrado com a voz real (skill `ct-reel-narrado-higgsfield`) | `segments[]`, `audioSrc` |
| `ReelCover` | capa do reel, quadro unico (skill `ct-reel-narrado-higgsfield`) | `image`, `headline[]`, `highlight` |
| `CapCutSplit`, `CapCutSplitAlt` | talking-head editado (skill `ct-video-editor`) | via `run-editor.mjs` |

Midia da marca vai em `remotion/public/` (caminho relativo nas props). Imagens neutras de exemplo
sao geradas sozinhas por `remotion/scripts/make-placeholders.mjs`. Catalogo de tecnicas de motion
(receitas, efeitos, o que e externo): `skills/ct-motion-code/efeitos.md`.

## Fluxo

### 1. Carregar contexto da marca ativa
Ler `.workspace` -> slug e o bloco "Ler a marca antes de produzir" acima. Gerar o tema da marca
(cores e fontes do `design-system.md`):
```bash
node scripts/video/emit-theme.mjs {slug}     # grava remotion/src/themes.generated.json
```
Sem tema, o Remotion usa o neutro "exemplo" e avisa no console. Foto, @perfil e selo do
cabecalho do `AnimatedReel` editam-se no tema gerado. Fonte do Google Fonts carrega sozinha.

### 2. Montar a spec do video (cenas)
Quebrar o roteiro em cenas. Cada cena = `{title, subtitle, durationInFrames}`.
30fps: 90 frames = 3s. Reel tipico: 5-7 cenas, 30-45s total.

### 3. Escrever/ajustar a composicao
Pra reel simples: usar `AnimatedReel`. Pra storytelling com midia real, horizontal para vertical ou tracos
animados: `StoryScenes`, `BlurFillVideo`, `DrawOn` (tabela acima).
Pra algo custom (data-viz, transicoes especiais): criar nova composicao em
`remotion/src/` SEGUINDO a skill `remotion-best-practices` (animacao frame-a-frame
com `useCurrentFrame` + `interpolate`/`spring`; NUNCA CSS transition).
Registrar a composicao nova em `remotion/src/Root.tsx`.

### 3b. Estrutura narrativa (regra dura)
- Storytelling CORRIDO seguindo o processo real: uma frase por cena que puxa a proxima. NUNCA usar selos "PASSO 1/2/3" (engessa).
- Abertura = VISTA GERAL do resultado (o todo), nao elemento isolado.
- Cada animacao aparece 1x, no momento certo; nao repetir a mesma animacao.
- CAPA obrigatoria pra todo reel.
- Aprovar storytelling/textos/visual com o usuario ANTES de gerar/gastar credito.
- Prancha, planta ou print tecnico NUNCA aparece cru: vira infografico (`StoryScenes`, kind `infographic`: zoom na regiao, resto escurece, numero grande que conta).

### 4. Render
```bash
cd remotion
npx remotion render AnimatedReel ../output/videos/{slug}-{nome}.mp4 \
  --props='{"themeSlug":"<slug>","showHandle":true,"scenes":[...]}'
```
Saida em `output/videos/` (temporario). Validar 1 frame antes do render full:
```bash
npx remotion still AnimatedReel ../output/videos/preview.png --frame=30 --props='...'
```

### 4b. QA FRAME-A-FRAME OBRIGATORIO (nao pular)

Regra dura: NUNCA entregar sem rodar um loop de verificacao
visual. Render sem olhar = defeito na cara do cliente. O fluxo:

1. Antes do render full, renderizar STILLS nos frames-chave de cada cena
   (inicio pos-fadein, meio, fim) com `npx remotion still <Comp> out.png --frame=N`.
2. LER cada still com a Read tool (sao imagens) e inspecionar de verdade.
3. Depois do render full, EXTRAIR frames do MP4 com ffmpeg cobrindo inicio/meio/
   fim de CADA cena + transicoes + end-card, e LER de novo:
   `ffmpeg -y -ss <seg> -i reel.mp4 -frames:v 1 qa-frames/frame-cNx.png`
4. Cacar estes defeitos e corrigir sozinho, re-renderizando ate ZERO defeito:
   - Faixa/borda BRANCA ou letterbox (cover que nao cobre, gap lateral/vertical)
   - Frame preto/branco (se aparecer no Windows com OffthreadVideo -> usar @remotion/media `Video`)
   - Logo com fundo/quadrado branco (usar PNG com fundo removido via ffmpeg
     `colorkey=0xFFFFFF:0.14:0.04,format=rgba`; se sumir no fundo, dar
     `brightness()` + glow radial suave, NUNCA caixa branca)
   - Texto estourando a safe area
   - Ken Burns pegando margem branca/barra de titulo: PRE-CROPAR o PNG pra
     regiao util (ffmpeg `crop=w:h:x:y`) e panar so dentro dela
5. BUG CLASSICO do cover-pan: a formula
   `tx = overX/2 - overX*px` deixa GAP lateral quando `px < 0.5` (vira faixa
   branca/preta na borda). O correto e mapear a borda de 0 a -over:
   `tx = -overX * clamp01(px)` e `ty = -overY * clamp01(panY)`, com pan em [0,1].
   E fundo do container = cor da marca, nunca #FFFFFF, pra nao
   vazar branco caso a imagem nao cubra.
6. Salvar os frames extraidos em `<saida>/qa-frames/` pra o usuario conferir, e
   previews representativos (1 por cena chave) em `<saida>/previews/`.

Iterar (corrigir asset/codigo -> re-render -> re-ler frames) ate limpo. So
entao devolver.

### 5. Devolver pro ct-diretor revisar
Mostrar caminho do MP4 + descricao das cenas + confirmar que rodou o loop de QA
frame-a-frame (quantos frames leu, defeitos achados/corrigidos). NAO publicar.

### 6. Apos aprovacao do usuario
- Mover MP4 pra `content/{slug}/reels/{nome}/`
- Registrar em `ct_content_items` (type=reel, status=draft, source_agent=ct-remotion,
  metadata com {engine:"remotion", composition, theme, duration_s, scenes})

## Regras

- Tema SEMPRE do design-system da marca ativa (`emit-theme.mjs` gera o tema)
- Animacao so frame-a-frame (regra do remotion-best-practices)
- Copy nas cenas segue voz do cliente: PT-BR, sem travessao, sem jargao,
  hashtags lowercase (quando houver)
- Video final em content/{cliente}/, nunca em output/
- NUNCA publica automatico

## Referencias

- Projeto: `remotion/` (+ `remotion/README.md`)
- Skill oficial `remotion-best-practices`: instalar com `npx skills add remotion-dev/skills` (o assistente instala, com permissao, na primeira vez que for fazer video por codigo)
- Temas: `remotion/src/themes.ts` + `remotion/src/themes.generated.json`
- Agente que orquestra: `agents/ct-video-remotion.md`
