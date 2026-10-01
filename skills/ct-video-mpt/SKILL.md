---
name: ct-video-mpt
description: "Gera videos faceless (sem rosto) na identidade do cliente ativo via MoneyPrinterTurbo vendorizado: clipes de banco (Pexels) + narracao TTS PT-BR + legenda automatica + trilha. Roteiro vem do ct-redator (MPT NAO escreve roteiro). Roda via CLI local (uv). Render MP4 local, com as cores do design-system do cliente ativo."
environment: local
---

# ct-video-mpt: Video faceless white-label (MoneyPrinterTurbo)

Ponte entre o Content Team AI e o MoneyPrinterTurbo (MPT), motor Python que
monta videos curtos a partir de roteiro + clipes de banco + TTS + legenda.
Vendorizado em `integrations/moneyprinter-turbo/`. Render MP4 local.

## Quando usar

- "video faceless", "video sem aparecer", "video narrado automatico"
- "reel com clipes de banco / b-roll / stock footage"
- "transforma esse texto/roteiro num reel rapido"

NAO usar pra: avatar falando (ct-video/HeyGen), cinematografico IA
(ct-video-higgsfield), motion por codigo (ct-video-remotion), carrossel (ct-carrossel-gen).

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui.

## Regra de ouro

O roteiro e SEMPRE do `ct-redator`. O MPT recebe o script pronto + os termos de
busca e so monta o video. O LLM interno do MPT fica desligado (passamos
`--video-script` e `--video-terms`, entao ele nao precisa gerar nada).

## Pre-requisitos

1. MPT instalado: `integrations/moneyprinter-turbo/` com `uv sync` feito (ver `docs/MPT_SETUP.md`)
2. ffmpeg no sistema (ja presente)
3. `config.toml` com `pexels_api_keys = ["..."]` preenchida
4. Node (pro wrapper `scripts/mpt/run-mpt.mjs`)

## Fluxo

### 1. Carregar contexto da marca ativa
Ler `.workspace` -> slug e o bloco "Ler a marca antes de produzir" abaixo. Cor e posicao da
legenda saem da "Legenda de reel" do `design-system.md`; a voz TTS e o padrao do kit (ver o mapa
no fim).

### 2. Receber roteiro do ct-redator
Script PT-BR pronto (o texto que vira narracao). Salvar em arquivo temporario,
ex: `output/mpt/<slug>-<nome>.txt`.

### 3. Definir termos de busca (Pexels)
3-6 palavras-chave em INGLES que representem o visual do video (Pexels indexa
melhor em ingles). Ex: "artificial intelligence, laptop, coding, office".

### 4. Rodar o wrapper (so apos aprovacao do usuario)
```bash
node scripts/mpt/run-mpt.mjs \
  --slug <slug> \
  --subject "<tema>" \
  --script-file output/mpt/<slug>-<nome>.txt \
  --terms "term1,term2,term3" \
  --name <nome>
```
O wrapper:
1. Le a "Legenda de reel" da marca -> monta os parametros MPT (voz, cor e posicao da legenda, formato 9:16)
2. Chama `uv run python cli.py --video-subject ... --video-script ... --video-terms ... --voice-name ... --video-aspect 9:16 --video-source pexels --stop-at video`
3. Move o MP4 de `integrations/moneyprinter-turbo/storage/tasks/<id>/` pra `content/<slug>/reels/<nome>/<nome>.mp4`
4. Imprime o caminho final + duracao

### 5. Devolver pro ct-diretor / o usuario
Caminho do MP4 + duracao. Status: rascunho local. Aprovacao manual antes de publicar.

### 6. Apos aprovacao -> registrar
INSERT em `ct_content_items` (ver agente `ct-video-mpt.md` secao 6).

## Mapa identidade -> MPT

Cor e posicao da legenda: secao "Legenda de reel" de `clients/{slug}/design-system.md`. Voz TTS
padrao do kit: `pt-BR-FranciscaNeural-Female`; voz propria da marca (opcional): arquivo
`skills/_shared/client-defaults/{slug}.cjs` com o campo `mpt` (`voice`, `text_fore_color`,
`stroke_color`, `font_size`, `subtitle_position`), que sobrepoe tudo. O TTS aqui e da ferramenta
faceless; a regra "nunca TTS" do avatar HeyGen (`ct-video`) nao se aplica.

## Parametros CLI uteis do MPT

| Flag | Uso |
|------|-----|
| `--video-subject` | tema (obrigatorio) |
| `--video-script` | roteiro pronto (desliga LLM) |
| `--video-terms` | termos busca Pexels (desliga LLM de termos) |
| `--video-source` | pexels / pixabay / local |
| `--voice-name` | ex: pt-BR-AntonioNeural-Male |
| `--video-aspect` | 9:16 / 16:9 |
| `--stop-at` | script/terms/audio/subtitle/materials/video |
| `--no-subtitle-enabled` | desliga legenda |

## Notas
- Sem chave Pexels: usar `--video-source local --video-materials <paths>` ou parar e avisar o usuario
- Modelos whisper e midia gerada ficam fora do git (.gitignore do MPT)
- EXCLUSIVO terminal local (nao roda por bot)
