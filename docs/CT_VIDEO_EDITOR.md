# ct-video-editor: editor de Reels "CapCut por codigo"

Modulo do Content Team AI que transforma um **video gravado pelo talento**
(talking head, ex: gravado no celular) num **Reel/Short editado** estilo CapCut,
100% por codigo, local e gratis. Faz edicao de Reels com legenda automatica e
demonstracao de tela, sem depender de ferramenta paga (CapCut, Submagic, Veed).

## O que entrega
- Legenda automatica (transcricao WhisperX, palavra a palavra ou por frase), na lingua do video.
  Estilo da marca: secao "Legenda de reel" do `design-system.md` (cor, destaque da palavra
  falada, caixa, peso, posicao). Padrao do kit: branca sombreada, sem destaque.
- **Split dinamico**: talento em cima, a **tela de um produto** (proposta, app,
  dashboard, site) rolando embaixo; alterna com tela cheia + talento em PIP. Ou split
  **alternado** (`CapCutSplitAlt`): rosto maior, cima ou baixo por bloco, b-roll por bloco.
- Render **9:16 (1080x1920) 30fps** na **identidade visual da marca ativa**
  (le `clients/{slug}/design-system.md`; o tema vai para `remotion/src/themes.generated.json`).
- Anonimizacao de dados/precos do cliente na tela demonstrada.

## Arquitetura
```
video gravado ─┐
               ├─► run-editor.mjs (orquestrador)
URL do produto ┘        │
   1. normaliza video do talento  (ffmpeg, 1 passe, 30fps CFR, autorotate)
   2. transcreve                  (WhisperX, palavra-a-palavra)
   3. legendas CapCut             (build-captions.mjs -> captions.json)
   4. captura a tela              (Playwright screenshot full-page -> page.png)
   5. render                      (Remotion CapCutSplit ou CapCutSplitAlt -> MP4 9:16)
```
Motor de composicao: **Remotion** (`remotion/src/CapCutSplit.tsx`). A tela rola por
**pan deterministico de imagem** dentro do Remotion (nao video de scroll).

## Componentes
| Arquivo | Papel |
|--------|-------|
| `skills/ct-video-editor/SKILL.md` | skill (fluxo + regras criticas) |
| `agents/ct-video-editor.md` | bridge pro ct-diretor delegar |
| `scripts/video-editor/run-editor.mjs` | orquestrador |
| `scripts/video-editor/build-captions.mjs` | WhisperX json -> paginas de legenda |
| `scripts/video-editor/capture-page-image.mjs` | screenshot full-page + anon + hide |
| `remotion/src/CapCutSplit.tsx` | composicao (split + legenda + pan) |
| `remotion/src/CapCutSplitAlt.tsx` | composicao (split alternado, rosto maior) |
| `remotion/src/CaptionText.tsx` | legenda no estilo da marca |
| `scripts/video/_brand.mjs` | le cores, fontes e "Legenda de reel" do design-system |
| `integrations/video-editor/` | venv uv (WhisperX) |

## Regras criticas (lições aprendidas em producao)
1. **Rotacao**: video de celular vem `rotation=-90`; autorotate no ffmpeg antes.
2. **Tela piscando = frame preto periodico**. Causa: encadear varios re-encodes do
   video do talento. Aparece um frame preto a cada N frames (N = denominador do fps
   original, ex 600/19 = 31.58fps -> a cada 19). **Fix: normalizar em UM passe**
   (`fps=30,format=yuv420p -fps_mode cfr`). Validar `blackdetect` = 0.
3. **Tela = screenshot + pan no Remotion**, nao video de scroll do Chrome (25fps VFR
   gera judder ao reamostrar pra 30fps).
4. **Windows**: se o Remotion nao baixar o Chrome, use o do sistema: `BROWSER_EXECUTABLE` no
   `.env.local` (lido por `remotion/remotion.config.ts`).
5. **Composicao <= duracao do video do talento** (senao frame preto no fim).
6. **Legenda classica (padrao do kit)**: branca, sombra suave, sem contorno/stroke, sem
   realce de palavra, fixa no rodape. A "Legenda de reel" da marca sobrepoe.
7. **Gravacao de tela**: varredura de dado sensivel no arquivo inteiro antes de virar peca
   (skill `ct-video-editor`, secao 6c).

## Diagnostico de "piscar" (sempre verificar como usuario)
```bash
# conta frames pretos (tem que ser 0)
ffmpeg -i out.mp4 -vf "blackdetect=d=0.01:pic_th=0.95" -an -f null -
# montagem de frames consecutivos pra OLHAR
ffmpeg -i out.mp4 -vf "select='between(t,12,13)',tile=6x6" -vsync 0 montage.png
```
NAO confiar em brilho medio, esconde o frame preto.

## Exemplo de uso
Reel de exemplo sobre uma skill do produto; tela = proposta-modelo da marca ativa
anonimizada (cliente + precos mascarados).

## Proximos passos possiveis
- Auto-anonimizacao por seletor de preco/cliente.
- Templates de layout (depoimento, demo de produto, antes/depois).
