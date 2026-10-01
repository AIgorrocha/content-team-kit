# Catalogo de tecnicas de motion graphics e animacao

Inventario de TODAS as tecnicas que o kit cobre, em que arquivo estao, se sao genericas e de onde
vieram. Serve para escolher a tecnica antes de montar a peca (`ct-motion-code`, `ct-remotion`,
`ct-video-editor`, `ct-reel-narrado-higgsfield`). Os 16 efeitos de interface, dado e tipografia
ficam em `efeitos.md`; aqui entram as tecnicas de composicao, edicao e acabamento.

Legenda de origem: **proprio** = escrito neste projeto; **inspirado** = ideia de terceiro recriada em
codigo proprio (nenhum codigo copiado); **externo** = ferramenta de terceiro que o usuario instala
(nao vem no kit).

## 1. Motor HTML e canvas (`ct-motion-code`, rota A)

| Tecnica | Onde | Origem |
|---|---|---|
| Mola matematica de forma fechada (`springStep`, `track`), presets `fast`, `standard`, `heavy`, `playful` | `engine/motion.js` | proprio |
| Indicador que estica (`stretchIndicator`) e crossfade de saida e entrada (`swapAlpha`), loop limpo (`loopT`) | `engine/motion.js` | proprio |
| Ruido deterministico com semente (`mulberry32`), nunca `Math.random` | `engine/motion.js` | proprio |
| `seek(t)` puro de `t`, render quadro a quadro, mesmo hash em dois renders | `engine/render.mjs`, `template.html` | proprio |
| Grade de batidas de uma trilha (bpm, batidas, tempos fortes) | `engine/beats.py` | proprio (usa librosa) |
| SFX sintetizado (click, pop, thump, whoosh) alinhado as batidas | `engine/sfx.mjs` | proprio |
| Contact sheet, tira de quadros, SSIM de loop, hash de determinismo, critica dura ate nota 8 | `engine/critique.mjs`, `SKILL.md` | proprio |
| 16 efeitos (botao vira player, busca vira resultados, card vira workspace, abas, grafico morfando, zoom no dashboard, pilha com mola, dock magnetico, tipografia mascarada, elastica, texto vira layout, revelacao de imagem, mudanca de perspectiva, foco em vidro, fluxo de caminhos, logo de particulas) | `efeitos.md` | inspirado (kit de motion de terceiro) |
| Slide de carrossel em video: 4:5 (1080x1350), 3 a 6 s, mudo, ultimo quadro igual ao primeiro | `render.mjs --format 4:5`, `critique.mjs` (SSIM de loop) | proprio |

## 2. Composicoes Remotion (`remotion/src/`, rota B)

| Tecnica | Composicao | Generica | Origem |
|---|---|---|---|
| Cenas de titulo e subtitulo com mola, cabecalho da marca | `AnimatedReel` | sim | proprio |
| Pan deterministico de imagem alta (screenshot full-page rola por codigo, sem judder) | `CapCutSplit` (`ScreenImagePan`) | sim | proprio |
| Video do rosto em UMA instancia persistente (nunca desmonta, sem quadro preto no corte) e geometria interpolada por mola | `CapCutSplit`, `CapCutSplitAlt` | sim | proprio |
| Split com bandas assimetricas (rosto maior), alternando cima e baixo por bloco | `CapCutSplitAlt` | sim | proprio |
| Legenda condicional a posicao do rosto (acima do rosto quando ele esta embaixo) | `CapCutSplitAlt` | sim | proprio |
| Legenda no estilo da marca: frase inteira ou palavra a palavra com destaque da palavra falada, caixa, peso, posicao | `CaptionText` | sim | proprio |
| PiP redondo do rosto sobre tela cheia | `CapCutSplit` modo `screen` | sim | proprio |
| Ken Burns (pan e zoom lentos sobre imagem alta) | `KenBurnsTest`, `StoryScenes`, `NarratedReel` | sim | proprio |
| Um visual por assunto sincronizado com a narracao (cena por frase, crossfade de 8 quadros, veu na cor da marca, SFX de transicao, ajuste de velocidade do clipe) | `NarratedReel` + `build-narrated-captions.mjs` | sim | proprio |
| Capa de reel com foto, titulo de tamanho fixo e scrim opaco opcional | `ReelCover` | sim | proprio |
| Storytelling por cenas de texto grande sobre midia real, cartao final com logo, mesmo roteiro em 9:16 e 16:9 | `StoryScenes`, `StoryScenes16x9` | sim | proprio |
| Infografico a partir de prancha ou print tecnico: zoom na regiao, o resto escurece, numero grande que conta (count-up) | `StoryScenes` (kind `infographic`) | sim | proprio |
| Video horizontal vira vertical: fundo desfocado + video contido, texto de abertura e credito | `BlurFillVideo` | sim | proprio |
| Tracos SVG que se desenham sozinhos (draw-on), preenchimento depois do traco, brilho opcional | `DrawOn` | sim | proprio |
| Criativo estatico e reel tipografico em lote (logo, headline, CTA, mockup) | `StaticCreative*` | sim | proprio |

## 3. Tecnicas de edicao e acabamento (ffmpeg e fluxo)

| Tecnica | Onde | Generica |
|---|---|---|
| Normalizar video de celular em UM passe (autorotate, 30 fps CFR) | `run-editor.mjs`, skill `ct-video-editor` regra 2 | sim |
| Corte semantico por EDL (hesitacao, gagueira, take refeito), um unico encode | `build-edl-llm.mjs`, `apply-edl.mjs` | sim |
| Self-eval: detecta quadro preto e flicker nas fronteiras de corte e desloca 2 quadros | `self-eval.mjs` | sim |
| Captura de pagina com anti-flicker, anonimizacao e seletores escondidos | `capture-page-image.mjs` | sim |
| Janela pequena sobre o tronco (contra-plongée) via overlay ffmpeg | skill `ct-video-editor` secao 1g | sim (receita) |
| Camada grafica transparente (Remotion em ProRes 4444 ou WebM com alfa) composta depois sobre o video original por ffmpeg, para nao mexer na cor do master | regra transparent-videos da skill oficial remotion-best-practices | sim |
| Punch-in ritmado no rosto: a cada corte a escala "bate" em 1,14 e assenta em 1,045 com mola (`damping 14`, `stiffness 120`, 14 quadros), depois deriva devagar | receita abaixo | sim |
| Audio continuo: renderizar pedacos sem audio, concatenar e colar UMA faixa de audio no passe final | `references/aprendizados-de-producao.md` item 5.6 | sim |
| SFX whoosh por ffmpeg (`anoisesrc` + filtros) | skill `ct-reel-narrado-higgsfield` passo 4 | sim |
| Varredura de dado sensivel em gravacao de tela (tarja, webcam ampliada, corte) | skill `ct-video-editor` secao 6c | sim |
| Conversao de HDR de iPhone: tonemap so no caminho com concat, nunca no overlay | skill `ct-video-editor` secao 1e | sim |
| Mascote ou avatar falando com audio real (HeyGen) | `scripts/video/heygen-audio-to-video.mjs` | sim (exige conta propria) |
| Clipes de banco + TTS + legenda automatica (faceless) | `scripts/mpt/run-mpt.mjs` (MoneyPrinterTurbo, MIT) | sim |
| Imagem para video, dois quadros (inicio e fim) e lipsync por IA | agente `ct-video-higgsfield` (Higgsfield CLI) | sim (exige conta propria) |
| Cortes de video longo em clipes | skill `ct-openshorts` (OpenShorts, MIT, externo) | sim |

### Receita do punch-in (Remotion)

```tsx
// "local" = quadro desde o inicio do bloco atual (corte). O zoom bate e assenta a cada corte.
const punch = spring({ frame: local, fps, config: { damping: 14, stiffness: 120 }, durationInFrames: 14 });
const settle = interpolate(punch, [0, 1], [1.14, 1.045]);
const drift = interpolate(local, [14, 150], [0, 0.02], { extrapolateRight: "clamp" });
// aplicar scale(settle + drift) no MESMO elemento do video do rosto (instancia unica)
```
Use so onde a marca pede zoom marcante (`brand-profile.md`, "Preferencias de formato"). Sem corte
no bloco, sem punch-in.

## 4. Tecnicas da skill oficial do Remotion (`remotion-best-practices`, instalada com `npx skills add remotion-dev/skills`)

Nao sao nossas: ficam como referencia para compor com o Remotion. Topicos: transicoes entre cenas
(`transitions.md`: fade, slide, wipe, overlays), light leaks, animacao de texto (maquina de escrever,
destaque de palavra), graficos de barras animados, visualizacao de audio (espectro), legendas (SRT,
transcricao, exibicao), 3D (Three.js), Lottie, GIFs, mapas (MapLibre), Tailwind, fontes (Google e
locais), medir texto e elementos, trechos de silencio, videos transparentes, voz em off, SFX, metadados
dinamicos e sequenciamento. Antes de escrever uma composicao, leia o arquivo do topico.

## 5. Ferramentas externas (nao vendorizadas)

| Ferramenta | O que oferece | Licenca | Como usar |
|---|---|---|---|
| **HyperFrames** (HeyGen), HTML para video | Escreve-se HTML com animacoes buscaveis (GSAP e outras) e renderiza MP4 deterministico. Biblioteca grande de blocos e componentes: legendas (karaoke, neon, glitch, particulas, destaque editorial), transicoes (shaders, wipes, flash), camera (shake, dolly, zoom), texto cinetico, graficos (barras, corrida de barras, linha, donut, count-up), telas de produto (navegador, celular, cursor, clique), efeitos de codigo, vidro liquido, cartoes e carrosseis, logo de fechamento | Apache 2.0 | `npx skills add heygen-com/hyperframes` (instala as skills) e `npx hyperframes` (CLI). Exige Node 22 ou mais novo. O usuario instala na propria maquina; creditar o autor nas pecas adaptadas |
| **Lottie** | Animacao vetorial pronta (JSON) dentro do Remotion | depende do arquivo | ver `rules/lottie.md` da skill oficial |

O kit NAO copia o repositorio do HyperFrames (e grande e de terceiro). Se a marca quiser um bloco de
la, aplique a regra dura 0 da `SKILL.md`: adapte o original (mesmo movimento e tempo), troque so texto e
cor, credite o autor e compare com contact sheet lado a lado.

## 6. O que NAO entrou no kit, e por que

| Item da operacao de origem | Motivo |
|---|---|
| Composicoes de reel de casos reais (uma por assunto) e suas legendas geradas | pessoais: conteudo, cores, nomes de cliente e midia de marca. As tecnicas genericas delas (split alternado, punch-in, storytelling por cenas, infografico com count-up, legenda condicional) entraram como composicoes e receitas acima |
| Cenas de "extracao de dados", "evolucao de modelo 3D em isometrico e wireframe" e cenas de faixa (b-roll dentro do split) | especificas da operacao de origem (assunto e identidade). A tecnica de tracos que se desenham entrou como `DrawOn`; a de camada por camada e o brilho de wireframe ficam como ideia: use `DrawOn` com varios caminhos |
| Amostras de cena hibrida (clipe gerado por IA de fundo + titulo da marca por cima) | pessoais; a tecnica e `NarratedReel` (visual de fundo + texto da marca) |
| Demos de tela de caso especifico (tarefas, financeiro) | caso especifico do dono, removidas; receita generica na secao 1g da skill `ct-video-editor` |
| Kit de animacoes de terceiro (7 prompts e pagina de download) | texto e identidade do dono, inspirado em kit de terceiro sem licenca de redistribuicao. As 16 ideias equivalentes estao em `efeitos.md`, reescritas |
| Skill de video com voz sintetica (TTS de borda e de provedor pago) | contradiz a regra "nunca TTS no avatar"; o caminho com TTS do kit e o faceless (`ct-video-mpt`) |
| Repositorio HyperFrames completo, diagram-design, BMAD | ferramentas de terceiro, grandes; o usuario instala se quiser (secao 5) |
| Videos adaptados de kit de terceiro (slides de carrossel de motion) | dependem da licenca do kit original; nao redistribuir sem permissao do autor |
| Experimentos (`BimEvolutionSamples`, `*Sketch`, versoes v2 a v6 de reels) | experimentais e superados por versoes finais pessoais |
