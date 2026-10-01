# Remotion - Projeto compartilhado do Content Team AI

Vídeos animados white-label por código (React). Um projeto único, composições
parametrizadas pelo tema da marca (`clients/{slug}/design-system.md`).

## Pré-requisitos

- Node 18+ instalado
- `npm install` na RAIZ do kit (as composições usam o `zod` de lá) e depois `npm install` aqui
- Skill oficial do Remotion: instalar com `npx skills add remotion-dev/skills` (o assistente instala, com permissao, na primeira vez que for fazer video por codigo)
- Google Chrome instalado. Se o Remotion não achar o navegador, ou se o download dele falhar
  (comum no Windows), aponte o Chrome do sistema no `.env.local`:
  `BROWSER_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe`

## Setup (uma vez)

```bash
cd remotion
npm install
```

## Tema da marca

Cada marca vira um tema (cores e fontes) lido de `clients/{slug}/design-system.md`:

```bash
node scripts/video/emit-theme.mjs {slug}    # grava remotion/src/themes.generated.json
```

O `run-editor.mjs` já faz isso sozinho. Para ajustar foto, @perfil ou selo de verificado
do cabeçalho, edite o tema da marca no `themes.generated.json`. Tema que não existe cai no
neutro `exemplo` com um aviso no console. Fonte do Google Fonts carrega sozinha; fonte
própria da marca precisa do arquivo (veja `rules/local-fonts.md` da skill oficial).

## Composições registradas

| Composição | O que faz | Quem usa |
|---|---|---|
| `AnimatedReel` | cenas de título e subtítulo animadas | `ct-video-remotion` |
| `CapCutSplit` | talking-head (rosto em cima, tela embaixo) + legenda palavra a palavra | `ct-video-editor` |
| `CapCutSplitAlt` | split alternado: rosto maior, alterna cima e baixo, legenda acima do rosto quando ele está embaixo | `ct-video-editor` |
| `NarratedReel` | reel narrado com a voz real: um visual por assunto + legenda frase a frase | `ct-reel-narrado-higgsfield` |
| `ReelCover` | capa de reel (quadro único 1080x1920) | `ct-reel-narrado-higgsfield`, `ct-reel` |
| `StoryScenes` e `StoryScenes16x9` | storytelling por cenas de texto grande sobre mídia real, infográfico com número que conta | `ct-remotion` |
| `BlurFillVideo` | vídeo horizontal vira vertical (fundo desfocado + vídeo contido) | `ct-remotion` |
| `DrawOn` | traços SVG que se desenham sozinhos | `ct-remotion` |
| `KenBurnsTest` | pan e zoom por código sobre uma imagem alta | teste de motion |
| `StaticCreativeStory`, `StaticCreativeFeed`, `StaticCreativeReel` | criativo estático e reel tipográfico | `ct-criativos-lote` |

Imagens de exemplo (`imagem-exemplo.png`, `placeholder/*.png`) são geradas sozinhas,
neutras, por `scripts/make-placeholders.mjs` antes de `studio`, `render` e `still`. Mídia da
marca vai em `public/` (vídeos e imagens ficam fora do git).

## Comandos

```bash
npm run studio                      # preview ao vivo no navegador
npm run typecheck                   # confere os tipos (tsc)

# Renderizar um reel de exemplo
npx remotion render AnimatedReel ../output/videos/meu-reel.mp4 \
  --props='{"themeSlug":"{slug}","showHandle":true,"scenes":[{"title":"Hook","subtitle":"linha de apoio","durationInFrames":90}]}'

# Capa
npx remotion still ReelCover ../output/capa.jpg --props='{"themeSlug":"{slug}","image":"foto.jpg","headline":["TITULO EM","DUAS LINHAS"],"highlight":"DESTAQUE"}'
```

## Estrutura

```
remotion/
├── package.json
├── remotion.config.ts
├── tsconfig.json
├── public/                     ← mídia da marca e placeholders (fora do git, exceto .gitkeep)
├── scripts/make-placeholders.mjs
└── src/
    ├── index.ts                ← registerRoot
    ├── Root.tsx                ← composições registradas
    ├── themes.ts               ← tema neutro + lê themes.generated.json
    ├── themes.generated.json   ← temas das marcas (gerado por emit-theme.mjs)
    ├── fonts.ts, color.ts      ← helpers compartilhados
    ├── CaptionText.tsx         ← legenda no estilo da marca (usada por CapCutSplit e Alt)
    └── (uma composição por arquivo)
```

## Como funciona no fluxo de agentes

1. `ct-diretor` delega pro agente `ct-video-remotion` (ou `ct-video-editor`)
2. O agente lê a marca ativa (`brand-profile.md`, `design-system.md`, `regras-cliente.md`)
3. Usa a skill `ct-remotion` + a skill oficial `remotion-best-practices`
4. Renderiza em `output/videos/` (temporário)
5. Devolve o MP4 pro ct-diretor revisar
6. Após aprovação: move pra `content/{cliente}/reels/{nome}/` + registra em `ct_content_items`

## Regras

- Animação só frame a frame (`useCurrentFrame` + `interpolate`/`spring`).
  Proibido CSS transition / classes de animação (não renderizam).
- Tema SEMPRE do `clients/{slug}/design-system.md` da marca ativa (cores e fontes).
- Legenda no estilo da seção "Legenda de reel" do `design-system.md` (padrão do kit: branca,
  maiúsculas, negrito, sem destaque).
- Vídeo dentro da composição: as composições novas usam `Video` de `@remotion/media`. Em
  alguns vídeos, no Windows, o `OffthreadVideo` (usado por `CapCutSplit` e `CapCutSplitAlt`)
  já saiu com quadro branco ou preto: se acontecer, troque por `Video`.
- Vídeo final aprovado vai em `content/{cliente}/`, nunca em `output/`.
