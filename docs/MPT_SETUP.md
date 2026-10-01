# MPT_SETUP: MoneyPrinterTurbo no Content Team AI

Motor de **video faceless** (sem rosto): a partir de um roteiro, monta um Reel
com clipes de banco (Pexels) + narracao TTS PT-BR + legenda automatica + trilha,
na identidade do cliente ativo. Vendorizado em `integrations/moneyprinter-turbo/`.

> Tudo que e segredo (chaves) ou pesado (modelos/midia) fica fora do git.

## Arquitetura da integracao

```
ct-diretor
   └─ delega "video faceless" ─▶ agents/ct-video-mpt.md (bridge)
                                      │ (roteiro vem do ct-redator)
                                      ▼
                         scripts/mpt/run-mpt.mjs (wrapper Node)
                           - le o .workspace + a "Legenda de reel" do design-system
                           - mapeia identidade -> params MPT
                                      ▼
                         scripts/mpt/mpt_generate.py (driver Python)
                           - monta VideoParams completo (legenda/voz/cor)
                           - chama o motor (uv run, stop_at=video)
                                      ▼
                         integrations/moneyprinter-turbo/ (MPT vendorizado)
                                      ▼
                         content/{slug}/reels/{nome}/{nome}.mp4
```

Decisao-chave: o **roteiro e SEMPRE do ct-redator**. Passamos `--video-script`
e `--video-terms`, entao o LLM interno do MPT nao e acionado.

## Pre-requisitos (instalar 1x por maquina)

| Item | Status | Como instalar |
|------|--------|---------------|
| ffmpeg | normalmente ja tem | `winget install Gyan.FFmpeg` |
| uv (Python manager) | necessario | `winget install astral-sh.uv` |
| Python 3.12 | o uv baixa sozinho | (automatico no `uv sync`) |
| Node | ja tem (projeto Next) | nada a fazer |

## Instalacao do motor (1x)

```bash
cd integrations/moneyprinter-turbo
uv sync --frozen           # cria .venv com as deps (Python 3.12)
cp config.example.toml config.toml   # ja feito; config.toml fica no .gitignore
```

## Configurar a chave Pexels (necessaria pra video completo)

1. Criar conta gratis: https://www.pexels.com/api/
2. Copiar a API key
3. Editar `integrations/moneyprinter-turbo/config.toml`:
   ```toml
   pexels_api_keys = ["SUA_CHAVE_AQUI"]
   ```
   (aspas retas ASCII; multiplas chaves separadas por virgula evitam rate limit)

Sem chave: usar `--source local --materials "clip1.mp4,clip2.mp4"`.

## Smoke test (sem chave, so narracao)

```bash
cd integrations/moneyprinter-turbo
uv run python cli.py --video-subject "Teste" \
  --video-script "Se voce ouvir isso, instalou certo." \
  --video-terms "test" --voice-name "pt-BR-FranciscaNeural-Female" --stop-at audio
```
Gera `storage/tasks/<id>/audio.mp3`.

## Gerar um Reel completo (uso normal)

O ct-redator escreve o roteiro e salva num .txt. Depois:

```bash
node scripts/mpt/run-mpt.mjs \
  --slug acme \
  --subject "Como agentes de IA mudam o seu negocio" \
  --script-file output/mpt/meu-roteiro.txt \
  --terms "artificial intelligence,office,laptop,technology" \
  --name agentes-ia-negocio
```

Saida: `content/{slug}/reels/agentes-ia-negocio/agentes-ia-negocio.mp4`.

### Flags do wrapper

| Flag | Default | Uso |
|------|---------|-----|
| `--slug` | cliente ativo | slug do cliente (ver `clients/{slug}/`) |
| `--subject` | (obrigatorio) | tema do video |
| `--script-file` | (obrigatorio) | roteiro pronto do ct-redator |
| `--terms` | "" | palavras-chave Pexels (ingles, 3-6) |
| `--name` | {slug}-mpt | nome da pasta/arquivo |
| `--source` | pexels | pexels / pixabay / local |
| `--materials` | "" | clipes locais (quando source=local) |
| `--aspect` | 9:16 | 9:16 / 16:9 |
| `--no-subtitle` | (legenda on) | desliga legenda |

## Identidade por cliente

Mapeada em `scripts/mpt/run-mpt.mjs` (`CLIENT_STYLE`), espelhando
`clients/{slug}/design-system.md`:

| Cliente | Voz | Cor legenda | Stroke |
|---------|-----|-------------|--------|
| {slug} | ver `clients/{slug}/design-system.md` | ver design-system | ver design-system |

Novo cliente: adicionar entrada em `CLIENT_STYLE` com voz e cores do design-system.

## Fonte de legenda (opcional, marca)

O MPT so traz fontes CJK + Charm/Kabel em `resource/fonts/`. Pra usar a fonte da
marca (ex: Inter), copiar o `.ttf` pra `integrations/moneyprinter-turbo/resource/fonts/`
e setar `font_name` no driver/wrapper. Sem isso, usa `MicrosoftYaHeiBold.ttc`
(renderiza latim ok).

## O que NAO vai pro git (`.gitignore` do MPT)

- `config.toml` (tem chaves)
- `storage/` (tarefas/midia gerada), `models/` (whisper ~GB)
- `*.mp4 *.mp3 *.srt`, `.venv/`, `__pycache__/`

## Licenca e distribuicao

- MPT e MIT (`integrations/moneyprinter-turbo/LICENSE`).
- Pra entregar a outra pessoa: zip do repo SEM `config.toml`/`storage`/`.venv`;
  quem recebe roda `uv sync` e poe a propria chave Pexels.

## Limites / decisoes

- So CLI (sem WebUI Streamlit / API FastAPI por enquanto)
- So terminal local (nao roda em servidor remoto sem interface)
- TTS Edge gratis (Azure pago fica pra depois)
- Publicacao sempre manual (aprovacao humana)
