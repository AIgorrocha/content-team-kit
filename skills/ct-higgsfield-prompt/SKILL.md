---
name: ct-higgsfield-prompt
description: "Gera prompts MCSLA (Model + Camera + Subject + Look + Action) prontos pra Higgsfield AI CLI (kling3_0, seedance_2_0, veo3_1) pra produzir Reels cinematograficos automatizados. Suporta single-image, two-frame (start+end) e lipsync."
homepage: https://higgsfield.ai
metadata: { "kit": { "emoji": "🎬", "requires": { "cli": "@higgsfield/cli" } } }
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  applied: [tokens, anti-slop, media-prompt-gallery]
  mode: prototype
  scenario: marketing
  aspect_hint: "1080x1920 (9:16) ou 1920x1080 (16:9)"
  preview: { type: mp4 }
  design_system: { requires: false }
---
# ct-higgsfield-prompt - Gerador de Prompts MCSLA pra Higgsfield AI CLI

Converte briefing de Reel (tema + estilo + cliente) em prompt MCSLA pronto pra alimentar
o agente `ct-video-higgsfield`, que executa via CLI oficial `@higgsfield/cli` + skills
`higgsfield-generate` / `higgsfield-soul-id`.

**MIGRADO 2026-05-10:** MCP local `higgsfield_ai_mcp` aposentado. Toda execucao via CLI.

Baseado na Claude Skill oficial OSideMedia (https://github.com/OSideMedia/higgsfield-ai-prompt-skill).

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui.

## REGRAS ABSOLUTAS

- **SEMPRE retornar prompt em INGLES** (Higgsfield foi treinado em ingles - PT-BR degrada qualidade drasticamente)
- **Max 200 palavras** no prompt final
- **Ordem recomendada:** Subject -> Action -> Camera -> Style
- **NUNCA inventar IDs de modelo/motion** - usar apenas os catalogados em `references/models.md` e `references/motions.md` OU rodar `higgsfield model list --video` / `higgsfield model get <id>` pra confirmar
- **CONFIRMAR** o prompt gerado com o usuario antes de chamar `higgsfield generate create`

## A Formula MCSLA

Toda geracao Higgsfield segue 5 camadas:

| Letra | Significado | Exemplo |
|-------|-------------|---------|
| **M** | Model (motor de geracao) | `Kling 3.0`, `Veo 3.1`, `Seedance 2.0`, `Soul 2.0` |
| **C** | Camera (enquadramento + movimento) | `Medium Close-Up Dolly In`, `Extreme Wide Shot Crane Up` |
| **S** | Subject (o que aparece) | `Sectioned floating 3D model of a product` |
| **L** | Look (estilo visual + luz) | `Photorealistic cinematic, volumetric light, cold blue shadows` |
| **A** | Action (o que acontece) | `Camera slowly dollies in as outer layers peel away revealing internal components` |

## Modelos Recomendados por Caso

| Caso | Modelo CLI (job_set_type) | Notas |
|------|---------------------------|-------|
| Single-image reveal (camera) | `kling3_0` ou `veo3_1` ou `cinematic_studio_video_v2` | usa `--image` |
| Two-frame (desenho 2D -> render 3D) | `kling3_0` ou `seedance_2_0` ou `marketing_studio_video` | usa `--start-image` + `--end-image` |
| Lipsync (case com voz do cliente) | `seedance_2_0` | usa `--image` + `--audio` |
| Acao / fisica / VFX | `seedance_2_0` ou `minimax_hailuo` | std mode |
| Soul (rosto do cliente consistente) | `text2image_soul_v2` ou `soul_cinema_studio` | chain `higgsfield-soul-id` antes |
| Social rapido baixo custo | `kling2_6` ou `seedance1_5` | mode fast |

Ver catalogo completo em `references/models.md`.

## Camera Presets (Higgsfield DoP)

Os mais usados pra Reels de produto e demonstracao tecnica:
- **Dolly In Slow** - revela gradualmente
- **Crane Over The Head** - top-down, mostra planta
- **Robo Arm** - arco mecanico de precisao
- **Bullet Time** - slow-motion 360
- **Rack Focus** - transicao de foco
- **Crash Zoom In** - impacto visual abrupto

Ver catalogo completo em `references/motions.md` (ou `higgsfield://motions` via MCP).

## Input Esperado

Invocar com briefing estruturado:

```yaml
cliente: {slug}
tema: "Evolucao de esboco a render final em modelo 3D seccionado"
duracao: 5
aspect_ratio: 9:16  # pra Reel
flow_type: single-image  # single-image | two-frame | lipsync
modelo_sugerido: kling3_0  # job_set_type CLI
estilo: cinematografico volumetrico
assets:
  image: path/to/render.png       # se single-image
  start_image: path/to/desenho.png # se two-frame
  end_image: path/to/render.png    # se two-frame
  audio: path/to/voz-cliente.mp3      # se lipsync
```

## Output (formato obrigatorio)

JSON estruturado:

```json
{
  "mcsla_prompt_en": "Medium Close-Up Dolly In Slow of a sectioned floating 3D product model...",
  "mcsla_prompt_pt": "Plano medio com camera deslizando lentamente pra frente sobre modelo 3D de produto seccionado...",
  "model_suggested": "kling3_0",
  "flow_type": "single-image",
  "aspect_ratio": "9:16",
  "duration": 5,
  "mode": "std",
  "negative_prompt": "no logos, no text, no watermarks",
  "estimated_credits": 9,
  "cli_command": "higgsfield generate create kling3_0 --image $UPLOAD_ID --prompt \"...\" --aspect_ratio 9:16 --duration 5 --mode std --wait"
}
```

**OBRIGATORIO:** sempre retornar `mcsla_prompt_en` E `mcsla_prompt_pt`. o usuario valida tom
+ cena olhando a traducao PT-BR antes de aprovar gasto de credito.

## Fluxo CLI Recomendado

### Single-Image Reveal 
```bash
UID=$(higgsfield upload render.png --json | jq -r .id)
higgsfield generate create kling3_0 --image $UID \
  --prompt "<MCSLA>" --aspect_ratio 9:16 --duration 5 --mode std --wait
```

### Two-Frame (desenho 2D -> render 3D)
```bash
S=$(higgsfield upload desenho.png --json | jq -r .id)
E=$(higgsfield upload render.png --json | jq -r .id)
higgsfield generate create kling3_0 --start-image $S --end-image $E \
  --prompt "<descricao da transicao>" --aspect_ratio 9:16 --duration 5 --mode std --wait
```

### Lipsync (dublar case)
```bash
F=$(higgsfield upload foto-cliente.png --json | jq -r .id)
A=$(higgsfield upload voz.mp3 --json | jq -r .id)
higgsfield generate create seedance_2_0 --image $F --audio $A \
  --prompt "<contexto>" --aspect_ratio 9:16 --resolution 720p --wait
```

`--wait` faz polling automatico ate completed e devolve URL do MP4. Sem polling manual.

## Templates de Prompt Prontos (Produto / Tecnico)

### Template 1: Reveal Layer

```
Model: Kling 3.0
Aspect: 9:16 | Duration: 10s | Style: Product Cinematic

Medium Close-Up Dolly In Slow of a sectioned floating 3D model of a wearable device.
Layers peel away sequentially: casing, then circuit board, then battery, then key components glowing orange.
Dark studio background, volumetric light rays from above, subtle dust particles.
Photorealistic rendered, cold blue key light with warm amber accent on the glowing parts.
Ultra-sharp detail, cinematic depth of field.
```

### Template 2: Evolution

```
Model: Veo 3.1
Aspect: 9:16 | Duration: 8s | Style: Technical Cinematic

Extreme Wide Shot Crane Up of a single product that morphs through levels of detail:
stage 1 (gray blockout) transforms into stage 2 (colored volumes),
then stage 3 (detailed parts), then stage 4 (fully rendered with textures and materials).
Clean white infinite background, soft shadow beneath.
Product visualization style, crisp lines, parametric aesthetic, 4K.
```

### Template 3: Highlight

```
Model: Kling 3.0
Aspect: 9:16 | Duration: 10s | Style: Technical Thriller

Close-Up Robo Arm Arc around an exposed internal mechanism model.
Pipes, cables and gears intersect. Red pulsing spheres highlight three critical points.
Camera circles 180 degrees revealing the full mechanism in 3D space.
Dark cinematic lighting, red accent light on the critical points, cold white fill.
Photorealistic engineering visualization, ultra-sharp, volumetric atmosphere.
```

## Regras de Qualidade (Copiadas da Skill Oficial)

- **Seja especifico** - nomeie camera preset, descreva VFX concretamente
- **Verbos ativos** - `dollies in`, `peels away`, `revealing` (NAO: `shows`, `displays`)
- **Iluminacao nomeada** - `volumetric light`, `cold blue key`, `warm amber accent`
- **Style grade explicita** - `photorealistic`, `product cinematic`, `technical thriller`
- **NUNCA** `cool`, `nice`, `amazing` - descreva o que especificamente torna cool
- **Negative prompt** - sempre incluir `no logos, no text, no watermarks` pra conteudo corporativo

## Integracao com ct-video-higgsfield (bridge)

Este skill NAO chama o CLI diretamente. Gera o JSON + comando pronto que o agente
`ct-video-higgsfield.md` (ver `agents/ct-video-higgsfield.md`) executa:

1. `higgsfield upload <asset>` -> upload_id
2. `higgsfield generate create <model> ... --wait` -> URL MP4 (Higgsfield, retencao 7 dias)
3. NAO baixa local. NAO sobe Supabase Storage. Video fica na URL Higgsfield.
4. INSERT em `ct_content_items` SO conteudo editorial (title, concept, hook, cta, pillar,
   caption_instagram, post_linkedin, hashtags) + metadata leve (job_id, url, model, flow,
   credits, expires_at, prompt_en, prompt_pt). Sem media_urls. `hashtags` vazio quando a peca
   for so de LinkedIn (ZERO hashtag no LinkedIn).
5. Devolve URL Higgsfield pro usuario revisar manual.

## Referencias

- `references/models.md` - catalogo modelos
- `references/motions.md` - camera presets DoP
- `references/mcsla-formula.md` - formula detalhada + antes/depois
- Skill original: https://github.com/OSideMedia/higgsfield-ai-prompt-skill
- CLI oficial: https://www.npmjs.com/package/@higgsfield/cli
- Skills oficiais: https://github.com/higgsfield-ai/skills
