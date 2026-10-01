---
name: ct-reel-narrado-higgsfield
description: "Reel institucional com NARRACAO REAL do talento (voz do cliente) + visuais Higgsfield animados cena-por-assunto + legenda frase a frase sincronizada (WhisperX) + SFX de transicao, montado no Remotion (composicoes NarratedReel e ReelCover). Render MP4 9:16. White-label. Use quando o cliente quer um reel narrado com a propria voz e visual premium animado por IA."
metadata: { "engine": "Higgsfield + Remotion + WhisperX", "exclusivo": "terminal local", "custo": "~50-60 creditos Higgsfield" }
environment: local
---

# ct-reel-narrado-higgsfield

Pipeline completo de reel narrado com a PROPRIA voz e visual cinematografico animado por IA
(em vez de Remotion vetorial com voz sintetica). Tudo roda local.

## Conceito

`narracao real (1 arquivo) → WhisperX (texto+tempo por palavra) → fatiar por frase
→ Higgsfield gera/anima 1 visual por trecho → Remotion (NarratedReel) monta tudo sincronizado
(crossfade + SFX) + legenda frase a frase → MP4 9:16 → capa (ReelCover) → aprovacao → publicar`

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui
(por exemplo, palavra a palavra em vez de frase a frase). Gerar o tema da marca para o Remotion:
`node scripts/video/emit-theme.mjs {slug}`.

## REGRAS CRITICAS (padrao do kit, aprendidas na pratica)

1. **Roteiro primeiro, voz depois.** Escreve o roteiro em blocos (1 assunto por bloco),
   valida com o cliente, ele grava 1 arquivo continuo (micro-pausa entre assuntos
   ajuda a fatiar). NUNCA mudar o roteiro que o cliente validou.
2. **Legenda frase a frase (padrao do kit):** a frase aparece inteira de uma vez, troca pra
   proxima. Sem realce de palavra. A "Legenda de reel" da marca pode pedir outro estilo
   (`captionColor`, `captionUppercase` no NarratedReel).
3. **Tudo animado (video), nada de imagem estatica com so zoom.** Cada cena = clipe
   Higgsfield i2v (movimento sutil). Abre com o ENTREGAVEL pronto (ex: o produto ou
   resultado 100% finalizado), depois a evolucao, depois os demais assuntos.
4. **Sync ancorado na fala real.** Cada segmento comeca no tempo da 1a palavra real
   (WhisperX), nao em tempo estimado. Segmentos contiguos (sem gap). Crossfade curto.
5. **IA nao controla sequencia de construcao** (vira "demolicao"). Pra mostrar etapas
   em ordem: gerar IMAGENS das etapas (Seedream) e morfar entre elas com kling
   `--start-image`/`--end-image` (etapa A -> etapa B), depois concatenar.
6. **SFX de transicao** (whoosh) em cada troca de cena.

## Passo a passo

### 0. Roteiro (validar) + identidade
Escreve roteiro em blocos. Cliente aprova. Cliente grava 1 arquivo (mp3/m4a/wav).
Converter m4a para mp3 (o Remotion nao le m4a): `ffmpeg -i narracao.m4a -q:a 2 narracao.mp3`.
Copiar o mp3 para `remotion/public/`.

### 1. Transcricao (WhisperX)
```
cd integrations/video-editor
uv run whisperx "<audio>" --language pt --model small --compute_type int8 --output_format json --output_dir <out>
```
Da texto + `segments[].words[].start/end` (arquivo `<audio>.json`). Corrigir erros de
reconhecimento (nome proprio, termo tecnico) mantendo o tempo: arquivo `fix.json` com
`{"indice-da-palavra": "texto certo"}` ("" remove a palavra), passado ao script do passo 3.

### 2. Visuais Higgsfield (cena por assunto)
CLI Higgsfield (Windows): SEMPRE pre-upload `higgsfield upload create img.png` -> UUID
-> `--image <UUID>` (upload inline falha). SEM flag `--output` (usar `--wait`, pega URL,
baixa com Invoke-WebRequest). `input_images` array NAO funciona via CLI.
- Imagem polida: `higgsfield generate create seedream_v4_5 --prompt "..." --aspect_ratio 9:16 --quality high --wait` (1cr). Prompt: "ABSOLUTELY NO TEXT" senao a IA escreve labels errados.
- Animar imagem: `higgsfield generate create kling3_0 --image <UUID> --duration 5 --aspect_ratio 9:16 --mode std --sound off --prompt "<movimento sutil, no morphing>" --wait` (7.5cr).
- Morph etapa->etapa: `... kling3_0 --start-image <UUIDa> --end-image <UUIDb> ...` (7.5cr). Concatenar morphs via `ffmpeg -f concat`.
Salvar os clipes em `remotion/public/{nome-do-reel}/`. Custos e confirmacao: `agents/ct-video-higgsfield.md`
(spec sheet aprovada ANTES de gastar credito).

### 3. Legendas e cenas sincronizadas
```
node scripts/video-editor/build-narrated-captions.mjs <out>/<audio>.json output/narrado/props.json \
  --theme {slug} --audio {nome-do-reel}/narracao.mp3 \
  --media {nome-do-reel}/abertura.mp4,{nome-do-reel}/cena2.mp4,... --clip-sec 5 [--fix fix.json]
```
Cria uma cena por frase falada (`--per-scene N` junta N frases numa cena), cada uma comecando na
1a palavra real, contiguas, com a legenda ja quebrada em frases (`--max-words`). `--media` lista o
visual de cada cena em ordem (imagem png/jpg ou video); `--clip-sec` e a duracao nativa dos clipes
(ajusta a velocidade ao tempo da cena). Abra `props.json` e confira o texto das legendas contra a
fala (WhisperX erra nomes) e o `captionAnchor` ("mid" no fecho, se quiser).

### 4. Montagem Remotion: composicao `NarratedReel`
Ja registrada em `remotion/src/Root.tsx` (`remotion/src/NarratedReel.tsx`):
1 `<Audio>` raiz (a narracao), 1 `<Sequence>` por segmento com crossfade de 8 frames, clipe com
`playbackRate` ajustado a cena, legenda frase a frase na cor e caixa da marca, veu na cor de fundo
da marca, rodape opcional (`footerText`, por exemplo o @perfil) e SFX opcional (`sfxSrc`).
SFX whoosh (gerar uma vez em `remotion/public/sfx/whoosh.wav`):
`ffmpeg -f lavfi -i "anoisesrc=d=0.45:c=pink:a=0.6" -af "highpass=f=250,lowpass=f=7000,afade=t=in:st=0:d=0.04,afade=t=out:st=0.18:d=0.27,volume=0.5" remotion/public/sfx/whoosh.wav`
e passar `"sfxSrc":"sfx/whoosh.wav"` no props.json.
Render (dentro de `remotion/`; o `props.json` fica em `output/`, fora do git):
```
cd remotion
npx remotion render NarratedReel ../output/narrado/{nome}.mp4 --props=../output/narrado/props.json --video-bitrate=11M --audio-bitrate=192k
```
Antes do render full, conferir 1 quadro por cena: `npx remotion still NarratedReel ../output/narrado/q.png --props=... --frame=N`
e LER a imagem. Depois do render: QA de video da secao 6 do `references/viral-playbook.md`
(assistir inteiro com audio, legenda contra a fala, sem frame preto no fim).

### 5. Capa: composicao `ReelCover`
Quadro unico 1080x1920 com foto ou frame do entregavel + titulo + @perfil:
```
cd remotion
npx remotion still ReelCover ../output/narrado/capa.jpg --props='{"themeSlug":"{slug}","image":"{nome-do-reel}/pronto.png","eyebrow":"","headline":["TITULO EM","DUAS LINHAS"],"highlight":"DESTAQUE","handle":"@perfil"}'
```
Regras de capa (`references/aprendizados-de-producao.md`, secao 5): texto fora do rosto, canto
superior esquerdo livre, tamanho do titulo fixo da marca (`fontSize`), JPEG.

### 6. Aprovacao e publicacao
NUNCA publicar sem o "pode" do cliente sobre video, legenda e capa. Depois do "pode", publicar pela
skill `ct-publicar-ig` (`node scripts/publishing/publish-ig-reel.mjs --video-url ... --caption-file
legenda-instagram.txt --cover capa.jpg --client {slug} --slug {nome}`): ele exige capa, le a legenda
de ARQUIVO UTF-8 (passar texto inline no terminal quebra os acentos), sobe a capa para o Supabase
e usa a conta Instagram configurada (principal ou business, conforme o `.env.local`). O video
precisa estar em URL publica (por exemplo no bucket `content-media` do Supabase; veja `ct-publicar-ig`).
Registrar em `ct_content_items`.

## Custos (referencia)
6 imagens Seedream (~6cr) + 5-6 i2v kling (~45cr) + 3 morphs construcao (~22cr) ≈ 50-60cr.
