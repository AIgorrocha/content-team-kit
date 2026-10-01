---
name: ct-reel
description: "Gera Reels completos: audio real → avatar HeyGen → telas Playwright → edicao final"
agent: ct-video
triggers:
  - "gerar reel"
  - "criar reels"
  - "fazer video reels"
  - "reel sobre"
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  applied: [tokens, anti-slop, device-frames]
  mode: prototype
  scenario: marketing
  aspect_hint: "1080x1920 (9:16)"
  preview: { type: mp4 }
  design_system: { requires: true }
---

# Reels Generator

## O que faz

Gera todos os assets necessarios pra criar um Reel profissional:
1. Video do avatar falando (HeyGen)
2. Telas de demonstracao (Playwright)
3. Tela de CTA (Playwright)

## Ler a marca antes de produzir (BLOQUEANTE)

Marca ativa em `.workspace`. Ler `clients/{slug}/brand-profile.md` (secao **Preferencias de
formato**), `clients/{slug}/design-system.md` (cores, fontes e secao **Legenda de reel**) e
`clients/{slug}/regras-cliente.md`. O que a marca definiu vence o padrao do kit descrito aqui.

## Fluxo Completo

### Etapa 1: Roteiro
- Redator cria o roteiro seguindo o formato:
  - HOOK (0-3s): frase impactante com numeros
  - PROBLEMA (3-7s): situacao antes da IA
  - COMO FEZ (7-17s): mostrar o processo
  - RESULTADO (17-25s): numeros e impacto
  - CTA (25-30s): pedir comentario com palavra-chave

### Etapa 2: Audio
- Usuario grava o audio (celular, WhatsApp, gravador) e coloca o arquivo (m4a, ogg ou mp3) na pasta de trabalho
- Conferir creditos e confirmar o roteiro, depois rodar:
  `node scripts/video/heygen-audio-to-video.mjs <audio> [--avatar ID]`
  (precisa de `HEYGEN_API_KEY` e `HEYGEN_AVATAR_ID` no `.env.local`; a voz e SEMPRE o audio real, nunca TTS)
- Video fica em: `output/videos/heygen-{id}.mp4` (dentro do repositorio)

### Etapa 3: Telas B-roll
- Escrever o texto das telas num JSON (modelo: `scripts/video/telas-exemplo.json`; tipos lista,
  campos, numeros, cta) e rodar `node scripts/video/screen-recordings.mjs <telas.json>`
- As cores vem do `design-system.md` da marca; o texto e numero vem do JSON (dado de demonstracao
  marcado como EXEMPLO; numero real so com fonte na mao)
- Minimo 3 telas: problema, solucao, resultado
- Saida (1080x1920): `output/screens/*.png`

### Etapa 4: Edicao final (manual ou por codigo)
- Opcao A (app de edicao que o usuario ja usa, por exemplo Captions ou CapCut): importar o video do
  avatar como principal, as telas como B-roll, aplicar legendas, zoom e split, exportar o MP4 final
- Opcao B (local, sem app pago): Remotion do kit (`ct-remotion`, `ct-video-editor`)
- Legenda no estilo da marca (secao "Legenda de reel" do `design-system.md`)

## Arquivos Gerados

```
output/
├── videos/heygen-{id}.mp4     # Avatar falando
├── screens/
│   ├── 01-lista.png            # Tela do problema (nomes vem do telas.json)
│   ├── 02-campos.png           # Tela da solucao
│   ├── 03-numeros.png          # Tela do resultado
│   └── 04-cta.png              # Tela do CTA
└── audios/{timestamp}.mp3      # Audio convertido
```

## Scripts

- `scripts/video/heygen-audio-to-video.mjs`: Pipeline audio → HeyGen (converte, sobe, gera, baixa)
- `scripts/video/screen-recordings.mjs`: Gera telas com Playwright na identidade da marca
- `scripts/video/heygen-check.mjs`: Verifica status do video

### Etapa 5: Legendas e Posts para TODAS as plataformas (automatico)

Apos roteiro aprovado, o Otimizador (ct-otimizador) gera AUTOMATICAMENTE:

| # | Arquivo | Plataforma | Formato |
|---|---------|------------|---------|
| 1 | `legenda-instagram.txt` | Instagram + Threads | Max 500 chars, 5 hashtags populares, CTA com palavra-chave |
| 2 | `legenda-tiktok.txt` | TikTok | Curta, casual, emoji no titulo, CTA com palavra-chave |
| 3 | `youtube-shorts.txt` | YouTube Shorts | Titulo (max 100 chars) + descricao + tags separadas por virgula |
| 4 | `post-linkedin.txt` | LinkedIn | Texto puro independente, storytelling, max 2000 chars, CTA conversacional |

#### Regras por plataforma:

**Instagram + Threads:**
- Legenda max 500 chars (funciona no Threads tambem)
- No maximo 5 hashtags, especificas ao tema (busca, nao alcance). Ver `references/instagram-algoritmo.md` secao 3
- CTA: "Comenta [PALAVRA] que te mando" (valido: IG tem DM automatica)

**TikTok:**
- Legenda IDENTICA a do Instagram (mesmo texto e hashtags PT-BR)
- Unica troca: "Comenta [PALAVRA]" vira "link na bio" + comentario fixado (TikTok nao tem resposta automatica)

**YouTube Shorts:**
- Titulo: max 100 chars, chamativo
- Descricao: 3-5 paragrafos explicando o conteudo
- Tags: separadas por virgula, pra copiar direto no YouTube (nao e hashtag)
- ZERO hashtag na descricao
- CTA: "Comenta [PALAVRA] que te mando" e valido aqui (Shorts tem DM automatica)

**LinkedIn:**
- Texto puro independente (funciona sozinho sem video)
- Max 2000 chars, paragrafos curtos 1-2 linhas
- Hook forte nas 2 primeiras linhas (max 110 chars)
- 70% pessoal / 30% tecnico, storytelling primeira pessoa
- CTA: pergunta aberta conversacional ou convite direto pro direct. NUNCA "comenta PALAVRA" (LinkedIn nao tem DM automatica) nem engagement bait
- ZERO hashtag
- SEM links no corpo (colocar no 1o comentario)
- SEM travessao

## Arquivos Finais por Reel

```
content/{slug}/reels/{nome}/
├── roteiro.md              # Roteiro com transcricao
├── legenda-instagram.txt   # Instagram + Threads
├── legenda-tiktok.txt      # TikTok
├── youtube-shorts.txt      # YouTube Shorts (titulo + descricao + tags)
├── post-linkedin.txt       # LinkedIn (texto independente)
└── reels editado.mp4       # Video final (manual)
```

## Uso

```
"Gera um reel sobre [tema]"
→ Redator cria roteiro
→ Usuario aprova e grava audio
→ Video coordena avatar + telas
→ Otimizador gera legendas pra TODAS as plataformas
→ Usuario faz a edicao final (app de edicao ou Remotion)
```

```
"Transcrição de reel que gravei: [texto]"
→ Assumir a transcrição como contexto base da tarefa
→ Redator formata roteiro, títulos, capas e hooks necessários
→ Otimizador gera legendas pra TODAS as plataformas (IG, TikTok, Shorts, LinkedIn)
→ Se o usuario informar que já postou em Instagram e TikTok, registrar esse status e seguir com o que falta
→ Salva tudo em content/{slug}/reels/{nome}/
```
