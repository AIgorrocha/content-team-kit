---
name: ct-motion-code
description: "Motion graphics em codigo (rota A): HTML + canvas + window.seek(t) + Playwright + ffmpeg, sem framework. Gera reel/story/capa animada/anuncio na identidade do cliente ativo via mola matematica deterministica, sem depender de React/Remotion. Usar quando a peca e mais tipografia/dado/UI-morph do que timeline de video (rota B = ct-remotion). environment: local (precisa Playwright + ffmpeg + Node no PC)."
environment: local
---

# ct-motion-code: motion graphics em codigo (rota A)

Motor de motion graphics 100% em codigo: um HTML com `<canvas>`, uma funcao
`window.seek(t)` pura, Playwright tirando screenshot quadro a quadro e
ffmpeg juntando tudo em MP4. Sem React, sem Remotion, sem framework de
animacao. Render local, branco de identidade (le `design-system.md` do
cliente ativo).

## Quando usar (rota A) vs os outros agentes de video

| Ferramenta | Motor | Quando |
|---|---|---|
| **ct-motion-code** (esta skill) | HTML/canvas + Playwright + ffmpeg | Motion graphics "de designer": mola, morph de forma, tipografia cinetica, UI fake que nao existe (nao e screen recording), grafico/numero animado, showreel curto. Peca pequena e muito controlada visualmente |
| `ct-remotion` / `agents/ct-video-remotion.md` (rota B) | Remotion (React) | Series/templates repetiveis com props estruturadas, composicao que outro agente vai reusar em varias pecas parametrizadas, data-viz que precisa de biblioteca React |
| `ct-video-editor` | WhisperX + Remotion + Playwright | Editar um TALKING-HEAD gravado de verdade (rosto do talento falando). Nunca gera cena do zero |
| `ct-video-mpt` | MoneyPrinterTurbo | Video faceless com clipe de banco (Pexels) + narracao TTS |
| `ct-video-higgsfield` | Higgsfield AI | Cinematografico/IA generativa (nao e codigo determinismo) |

Regra de bolso: se a peca e "eu descrevo um estado inicial e um estado final
e quero a mola entre eles" vai pra ct-motion-code. Se a peca e "eu tenho 6
cenas com props que vou reusar em 20 clientes diferentes" vai pra
ct-remotion. Se a peca e "editar o video que o cliente gravou falando" vai pra
ct-video-editor.

## Inputs a coletar antes de comecar

1. **Marca ativa** (`.workspace` -> slug). Ler
   `clients/{slug}/design-system.md` (cores, fontes) e `brand-profile.md`
   (voz, pilares). Nunca inventar cor/fonte fora do design system do
   cliente.
2. **Formato**: 9:16 (1080x1920, reel/story), 1:1 (1080x1080, feed), 16:9
   (1920x1080, YouTube/LinkedIn video), ou 4:5 (1080x1350, feed vertical).
   Pode pedir mais de um formato da MESMA timeline (ver "Ship" nas regras).
3. **Duracao**: em segundos. Curto e regra, nao excecao (2 a 8s por peca ou
   por bloco dentro de um reel maior).
4. **Referencia**: um efeito do `efeitos.md` (ou combinacao de 2 a 3), OU
   uma referencia visual concreta do usuario/cliente (print, video, link). Sem
   referencia, NAO seguir com "vibe generica": pedir uma.
5. **Musica**: o cliente tem trilha pronta (arquivo) ou quer sintetizada em
   codigo (`engine/sfx.mjs`)? Se tem trilha, rodar `engine/beats.py` nela
   pra pegar a grade de batidas antes de animar.

## Pipeline (com portoes de aprovacao)

Cada portao abaixo e BLOQUEANTE: nao passa pro proximo passo sem ter
resolvido o anterior.

1. **Assets reais.** Se a cena mostra alguma "UI"/tela, ela tem que vir de
   captura real (Playwright screenshot do produto de verdade, foto, print
   do cliente) numa pasta de assets, listada ANTES de comecar a animar.
   Nunca redesenhar a interface de um produto de imaginacao.
2. **style_guide a partir do design-system do cliente.** Ler
   `clients/{slug}/design-system.md` e montar o `brand.json` (bg, surface,
   text, textMuted, accent, fontDisplay, fontBody) que vai pro
   `render.mjs --brand`. Nao inventar hex fora da tabela do cliente.
3. **Beats.** Se tem trilha: `engine/beats.py` gera `beats.json` (bpm,
   beats, downbeats, hits). Se nao tem: decidir a grade de tempo a mao
   (grid de 2 a 4s por "batida" narrativa), documentar os instantes que vao
   virar cues de SFX.
4. **Shotlist na grade de batidas.** Lista curta: de/ate segundos, o que
   acontece, qual efeito do `efeitos.md`, qual preset de mola. Uma linha
   por beat.
5. **MOSTRAR a shotlist e ESPERAR "pode" do usuario antes de escrever
   qualquer `draw()`.** Isso e o gate mais importante do pipeline: shotlist
   errada custa 10x menos corrigir que cena renderizada errada.
6. **Build.** Copiar `engine/template.html` + `engine/motion.js` pra pasta
   de trabalho (`output/{coisa}/` durante o teste, `content/{slug}/...`
   depois de aprovado), escrever as `SCENES` seguindo as regras duras
   abaixo.
7. **Contact sheet + critica, ate nota 8+ (maximo 3 rodadas).** Rodar
   `render.mjs`, depois `critique.mjs`, LER contact sheet, tira de 12
   quadros e os frames 360px com a tool Read (nao so confiar no numero do
   SSIM). Rodar o **prompt de critica** abaixo, corrigir os 3 piores
   problemas, re-renderizar, repetir. Documentado no teste real deste
   motor (ver `output/motion-test/`): a 1a rodada de um clipe com 3 blocos
   pegou um bug real (bloco anterior nao sumia quando o proximo entrava,
   os dois ficavam sobrepostos), so visivel no contact sheet, nao no
   codigo.
8. **Render final** nos formatos pedidos, da MESMA timeline (reposicionar
   layout por funcao, nunca so cortar/croppar pixel fixo).
9. **SFX/mix.** `engine/sfx.mjs` sintetiza click/pop/thump/whoosh a partir
   de `cues.json` alinhado na grade de batidas; normalizar com
   `ffmpeg -af loudnorm=I=-14:TP=-1.5:LRA=11` pra -14 LUFS. Se tem trilha
   real do cliente, mixar ela com o SFX (nunca so a trilha crua sem os
   acentos nos beats).
10. **Entrega.** MP4 final, contact sheet e hash de determinismo (2
    renders, mesmo sha256) pro usuario revisar. So depois do "pode": mover pra
    `content/{slug}/...` e seguir a integracao com as regras do cliente
    (abaixo).

## Regras duras

0. **Tem referencia com codigo ou kit de adaptacao? Adapte o original, nao refaca.**
   Copie a animacao da referencia (mesmo movimento, timing, molas, composicao) e troque so
   texto e cor pro cliente. Criterio de aceite: contact sheet lado a lado original x nosso
   batendo. Motor proprio do zero so quando nao houver codigo de referencia. Creditar o autor.
   Refazer do zero uma animacao que ja existe pronta costuma ficar muito inferior ao original.
1. **`seek(t)` e SEMPRE funcao pura de `t`.** Sem `Date.now()`/
   `performance.now()` dentro de `draw()`. Sem `setTimeout`/`setInterval`/
   `requestAnimationFrame` dentro de `draw()` (o loop de preview em
   `template.html` fica FORA do modo headless, so pra visualizar). Sem
   transicao CSS (tudo desenhado no canvas quadro a quadro).
2. **Sem `Math.random()`.** Ruido/jitter/variacao usa `Motion.mulberry32`
   com semente fixa. Mesma semente, mesmo video sempre.
3. **So UI/tela real, nunca inventada.** Qualquer coisa que pareça
   interface de produto vem de captura real (Playwright/screenshot/foto),
   nunca "reimaginada" pela cabeca do modelo.
4. **Looks proibidos** (genericos demais, ja virou clichê de IA): titulo
   centralizado sobre gradiente colorido vibrante, tudo com fade-in
   identico, rotulo/etiqueta de canto decorativo, moldura ao redor do
   frame, glow em cima de UI, particulas genericas sem funcao (particula
   so entra no efeito 16, logo de particulas, com proposito). Uma fonte
   display mais uma fonte de corpo, nunca mais que isso por peca.
5. **Uma cor de destaque do cliente.** So o `accent` do design-system do
   cliente pinta o que importa (numero, barra, CTA). Nao usar `accent2` ou
   qualquer cor fora da paleta do cliente pra "dar variedade".
6. **Algo novo a cada 2 a 4s.** Nenhum trecho da peca fica mais que 4s sem
   um elemento novo entrando, saindo ou mudando de estado.
7. **Overshoot leve em UI, zero em tipografia.** Presets `fast`/`playful`
   (com overshoot) sao pra elementos de interface (bordas, cards, icones).
   Titulo/numero grande usa o preset `heavy` (critico/superamortecido, sem
   passar do alvo).
8. **Determinismo antes de entregar.** Rodar `render.mjs` duas vezes e
   comparar sha256 (o proprio script imprime o hash). Hash diferente
   significa que alguma coisa na cena nao e pura de `t`: achar e corrigir
   antes de continuar.
9. **`-threads 1` no ffmpeg e deliberado** (ver comentario em
   `render.mjs`): tira a variavel de nao-determinismo de encode
   multi-thread. Custa velocidade, nao qualidade. Nao remover sem motivo.

## Prompt de critica (usar literalmente na rodada de contact sheet)

```
Voce e o diretor duro desta peca. Olhe o contact sheet (2fps), a tira de 12
quadros e os 3 frames em 360px. De uma nota de 1 a 10. Liste os 3 MAIORES
problemas, cada um com o timestamp aproximado. Cace especificamente:
- texto sobreposto ou cortando outro elemento (dois blocos visiveis ao
  mesmo tempo que deveriam ter feito crossfade)
- deslize sem easing (movimento linear onde devia ter mola)
- rotulo/etiqueta de canto decorativo, moldura, glow em UI
- gradiente colorido atras de titulo centralizado
- texto borrado ou saindo da safe area em algum frame
- "batida morta": mais de 4s sem nada novo acontecendo
- engasgo no loop (se a peca e pra fechar em loop): ultimo frame diferente
  do primeiro
Corrija so os 3 piores achados, re-renderize e repita a critica. So entrega
quando a nota for 8 ou mais, no maximo 3 rodadas (se ainda nao chegou em 8,
parar e mostrar pro usuario o que continua faltando em vez de insistir sozinho).
```

## Integracao com regras do cliente

- **Cliente ativo:** ler `clients/{slug}/regras-cliente.md` inteiro antes de
  produzir (formato por rede, texto na tela, o que borrar, QA frame a frame,
  legenda queimada com posicao fixa) e a tabela de cores/fontes em
  `clients/{slug}/design-system.md` (accent e cores proibidas, por exemplo
  evitar roxo/violeta como cor principal, valem tambem pro Remotion). Regra de
  cliente sempre vence regra generica desta skill.
- **Qualquer cliente:** NUNCA publicar sem "pode" explicito do usuario.
  Entrega desta skill e sempre
  `output/` ou `content/{slug}/.../draft`, nunca publicacao direta.
- Numero em cena: ver o cabecalho do
  `efeitos.md`. So numero real com fonte na mao vira claim publicavel;
  numero de teste/demo sempre marcado "EXEMPLO"/"ILUSTRATIVO".

## Motor (`engine/`)

| Arquivo | Faz |
|---|---|
| `motion.js` | Mola em forma fechada (`springStep`, `track`, `stretchIndicator`, `swapAlpha`, `loopT`), rng `mulberry32`. Script classico (sem `import/export`), carrega via `<script src>` sem esbarrar em CORS de modulo ES no `file://` |
| `template.html` | Esqueleto pra copiar por peca: canvas, `window.seek(t)`, `BRAND`/`CONFIG` injetaveis via CLI, preview ao vivo fora do Playwright |
| `render.mjs` | Playwright + ffmpeg por pipe. `--html --out --format ou --width/--height --fps --duration` (mais `--sub --seed --brand --audio` opcionais). H.264 yuv420p CRF 16, determinismo forcado (`-threads 1 -fflags +bitexact`) |
| `beats.py` | `librosa`: bpm/beats/downbeats (heuristico)/hits de uma trilha real, via `uv run --with librosa --with soundfile --with numpy` (venv descartavel, nada instalado no sistema) |
| `sfx.mjs` | Sintetiza click/pop/thump/whoosh em WAV puro a partir de `cues.json`, seed deterministico. Normalizar LUFS depois com `ffmpeg -af loudnorm` |
| `critique.mjs` | Contact sheet 2fps, tira de 12 quadros, 3 frames em 360px, SSIM de loop (primeiro contra ultimo quadro), sha256 do mp4 |

`catalogo-tecnicas.md` (nesta mesma pasta): inventario de TODAS as tecnicas de motion e animacao do
kit (motor, composicoes Remotion, edicao, skill oficial, ferramentas externas como o HyperFrames, e o
que ficou de fora). Consulte antes de escolher a rota.

**Slide de carrossel em video:** formato `--format 4:5` (1080x1350), 3 a 6 s, toca mudo, loop limpo
(ultimo quadro igual ao primeiro: o `critique.mjs` mede o SSIM de loop). Use quando o slide E a
demonstracao; slide de texto, guia ou CTA segue estatico (`references/aprendizados-de-producao.md`
item 4.1). Marca que definiu outro padrao de carrossel em `brand-profile.md` vence.

`efeitos.md` (nesta mesma pasta): catalogo dos 16 efeitos de referencia,
quando usar cada um, e como pedir pro motor (parametros/presets). Ler antes
de montar a shotlist quando faltar uma referencia visual concreta do usuario.

### Playwright neste worktree

Este repo pode estar em worktree separado do checkout principal (sem
`node_modules`). `render.mjs` tenta resolver `playwright` na ordem: pacote
local, depois `CT_MOTION_PLAYWRIGHT_PATH` (variavel de ambiente).
Rodar os comandos a partir de uma pasta com `node_modules` (o checkout
principal resolve de cara) ou exportar `CT_MOTION_PLAYWRIGHT_PATH`. Nunca
rodar `npm install` neste repo so por causa disso.

### Exemplo de comando completo

```bash
node skills/ct-motion-code/engine/render.mjs \
  --html output/minha-peca/scene.html \
  --out output/minha-peca/render.mp4 \
  --format 9:16 --fps 30 --duration 6 --sub 1 --seed 1 \
  --brand output/minha-peca/brand.json

node skills/ct-motion-code/engine/critique.mjs \
  --in output/minha-peca/render.mp4 \
  --out-dir output/minha-peca/critique
```

## Teste real do motor

Rodado em `output/motion-test/` (gitignored, nao versionado): clipe de 6s,
1080x1920, 30fps, design system de uma marca de exemplo (fundo escuro mais accent azul,
Space Grotesk/Inter), 3 blocos (titulo com mola, 3 cards em
stagger, numero contando, todos exercitando `track`/`stretchIndicator`/
`swapAlpha`). Primeira rodada do contact sheet pegou um bug real (cards sem
crossfade de saida, sobrepondo o numero); corrigido e re-renderizado.
Determinismo confirmado (2 renders, mesmo sha256) antes e depois da
correcao. Render: cerca de 10 a 12s pra 180 frames em CPU comum. Segundo
teste, efeito "05. Grafico morfando" do `efeitos.md`, 3s/1080x1080, cerca
de 3.7s de render, determinismo confirmado. Motor validado ponta a ponta
antes de entrar em producao de peca real.
