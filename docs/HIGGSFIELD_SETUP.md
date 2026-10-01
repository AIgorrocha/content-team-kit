# Higgsfield AI: setup completo (CLI)

Integracao Higgsfield AI pra geracao automatizada de Reels cinematograficos via Claude Code
e dashboard frontend.

Tudo roda via CLI oficial `@higgsfield/cli` + skills `higgsfield-ai/skills`.

---

## Arquitetura do Stack

```
[usuario pede Reel] -> [ct-diretor] -> [ct-video-higgsfield]
                                            |
                              +-------------+-------------+
                              |                           |
                  [skill ct-higgsfield-prompt]   [CLI @higgsfield/cli]
                    (gera prompt MCSLA          + skill higgsfield-generate
                     + comando CLI pronto)        (executa via Bash)
                                                           |
                                                  [Higgsfield Cloud]
                                                  - text2image_soul_v2
                                                  - kling3_0 (i2v + two-frame)
                                                  - seedance_2_0 (i2v + lipsync)
                                                  - veo3_1, marketing_studio_video, ...
                                                           |
                                                  [MP4 final] -> [Supabase Storage]
                                                           |
                                                  [ct_content_items draft]
                                                           |
                                                  [usuario aprova no dashboard]
```

---

## Como Instalar (uma vez)

### 1. Criar conta Higgsfield

1. https://higgsfield.ai -> sign up (Google ou email)
2. Escolher plano (free = 10 creditos pra testes; paid pra producao)

### 2. Instalar CLI + skills

```powershell
# Windows PowerShell
npm install -g @higgsfield/cli

# Auth (abre browser):
higgsfield auth login

# Instalar skills oficiais:
npx skills add higgsfield-ai/skills
# Selecionar: higgsfield-generate, higgsfield-soul-id,
#             higgsfield-marketplace-cards, higgsfield-product-photoshoot
# Agente: Claude Code (symlink recomendado)
```

Skills ficam em `~/.agents/skills/` e ficam disponiveis via Skill tool no Claude Code.

### 3. Verificar setup

```bash
higgsfield account status         # email + plano + creditos
higgsfield model list --video     # 16 modelos video
higgsfield workspace list         # workspaces disponiveis
```

### 4. Soul ID (opcional - rosto consistente)

```bash
higgsfield soul-id create --photos foto1.jpg foto2.jpg ... foto20.jpg --name "nome-do-talento"
# Retorna soul_id pra reusar
```

---

## Comandos basicos

### Single-image -> video
```bash
UID=$(higgsfield upload render.png --json | jq -r .id)
higgsfield generate create kling3_0 --image $UID \
  --prompt "Dolly in slow on product model" \
  --aspect_ratio 9:16 --duration 5 --mode std --wait
```

### Two-frame (start + end)
```bash
S=$(higgsfield upload esboco.png --json | jq -r .id)
E=$(higgsfield upload render.png --json | jq -r .id)
higgsfield generate create kling3_0 --start-image $S --end-image $E \
  --prompt "Transition reveals 3D model from sketch" \
  --aspect_ratio 9:16 --duration 5 --mode std --wait
```

### Lipsync (case com voz)
```bash
F=$(higgsfield upload foto.png --json | jq -r .id)
A=$(higgsfield upload voz.mp3 --json | jq -r .id)
higgsfield generate create seedance_2_0 --image $F --audio $A \
  --prompt "Presenter explaining a product" \
  --aspect_ratio 9:16 --resolution 720p --wait
```

### Custo antes de gerar
```bash
higgsfield generate cost kling3_0 --duration 5 --mode std
```

---

## Conta atual

- Email: conta do cliente ativo (ver `clients/{slug}/brand-profile.md`)
- Plano: conferir no `higgsfield account status`
- Saldo: conferir no `higgsfield account status`
- Workspace: Private (ID gerado por conta)

Pra producao real, use um plano pago.
