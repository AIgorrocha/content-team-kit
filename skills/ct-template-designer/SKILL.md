---
name: ct-template-designer
description: Gera 3 variações visuais de template (HTML + CSS) pra conteúdo visual com HARD RULES de dimensão e tipografia, renderiza cada uma via Playwright pra aprovação do usuário, e salva a aprovada como identidade visual de referência do cliente. Usar quando ct-diretor estiver no step 3 (DESIGN) do pipeline ou quando o usuário pedir pra definir/trocar a identidade visual de um tipo de conteúdo (carrossel, story, post LinkedIn, reel cover).
version: "1.0.0"
categories: [content-team, design, templates]
---

# ct-template-designer

Inspirado no `template-designer` do opensquad (Renato Asse) + regras visuais que já usamos no `ct-carrossel-gen`.

## Quando usar

- **Pipeline ct-diretor step 3 (DESIGN)**, antes de produzir o conteúdo final, propor 3 layouts e deixar o usuário escolher
- **Troca de identidade visual**, o usuário pede "quero um novo estilo de carrossel" ou "redesenha os stories"
- **Novo cliente**, definir template base antes do primeiro conteúdo
- **A/B test visual**, testar 3 layouts e pegar o de melhor engajamento

**NÃO usar pra:**
- Gerar slides finais (essa é a skill `ct-carrossel-gen`)
- Ajustar conteúdo de slide específico (troque direto no HTML)

## Pré-requisitos

- Pipeline `state.json` existe (ct-diretor no step 3)
- Pasta do cliente com `brand-profile.md` e `design-system.md`
- Skill `ct-carrossel-gen` instalada (pra renderizar HTML → PNG)

## HARD RULES: NÃO-NEGOCIÁVEIS

### Dimensões fixas (nunca `height: auto`)

| Formato | Dimensão | Proporção |
|---|---|---|
| Instagram carrossel | `1080 × 1350` | 4:5 |
| Instagram story/reel cover | `1080 × 1920` | 9:16 |
| Instagram post quadrado | `1080 × 1080` | 1:1 |
| LinkedIn post | `1200 × 627` | 1.91:1 |
| YouTube thumbnail | `1280 × 720` | 16:9 |

Container root DEVE ter `width` e `height` em pixels explícitos. Sem overflow, sem scroll, sem flex height.

### Tamanhos mínimos de fonte

**Instagram carrossel 1080×1350:**
- Hero/Título: **58px** mínimo
- Heading: **43px** mínimo
- Corpo: **34px** mínimo
- Legenda/pequeno: **24px** mínimo

**Absoluto mínimo em qualquer plataforma:** `20px`.

### Peso de fonte

- Corpo e acima: mínimo `500` (nunca `400` ou menor pra texto visível)
- Pesos permitidos: `500, 600, 700, 800, 900`

### Contraste

- WCAG AA: mínimo `4.5:1` pra texto vs fundo
- Use ferramenta de contraste ao decidir combinações

### Paleta

- Máximo **5 cores** por design system: primary, secondary, accent, background, text
- Respeitar `clients/{slug}/design-system.md`

### Layout

- CSS Grid ou Flexbox **only**
- `position: absolute` só pra overlays/decorações (nunca pro conteúdo principal)
- Zona segura: padding mínimo `72px` nas bordas

### HTML autocontido

- CSS inline ou em `<style>` único
- Google Fonts via `@import` permitido
- Nenhum outro recurso externo (sem CDN de imagens, sem JS)

### PROIBIDO

- Contador de slides ("1/7", "Slide 2 de 10"), IG tem navegação nativa
- Cores fora da paleta do cliente
- Fontes não listadas no design-system
- Placeholder genérico ("Lorem ipsum"), usar texto real do cliente ou da pesquisa do cliente

## Como funciona (workflow)

### Step 0: Ler contexto

```
clients/{slug}/brand-profile.md     → tom, público, pilares
clients/{slug}/design-system.md     → cores, fontes, logo, ícones
clients/{slug}/competitors.md       → visual dos concorrentes
content/{slug}/pesquisa/{ultima-pesquisa}.md (se existe) → patterns visuais
content/{cliente}/{tipo}/{slug}/state.json → brief aprovado no step 1
```

### Step 1: Gerar 3 variações HTML

Criar 3 arquivos em `content/{cliente}/{tipo}/{slug}/templates/`:

```
template-a.html  ← variação 1 (ex: editorial minimalista)
template-b.html  ← variação 2 (ex: bold colorido)
template-c.html  ← variação 3 (ex: data-driven com grid)
```

Cada template segue as HARD RULES e contém:
- Slide 1 (capa) com hero text real do brief
- Slide 2 (conteúdo) com body text real
- Slide 3 (dado/insight) com número/gráfico real
- Slide 4 (CTA) com pergunta real do brief

### Step 2: Renderizar PNG

Pra cada template, chamar `ct-carrossel-gen` pra gerar preview:

```bash
node skills/ct-carrossel-gen/scripts/generate-slides.js \
  --input content/{cliente}/{tipo}/{slug}/templates/template-a.html \
  --output content/{cliente}/{tipo}/{slug}/templates/preview-a.png
```

3 PNGs gerados (preview-a.png, preview-b.png, preview-c.png).

### Step 3: Apresentar pro usuário

No Telegram/terminal, mandar:

```
🎨 3 variações de template pra {conteudo}

A: Editorial minimalista (preto/branco, Inter)
B: Bold colorido (primary do cliente, Anton)
C: Data-driven com grid (cards brancos sobre azul)

Ver previews:
  content/{cliente}/{tipo}/{slug}/templates/preview-a.png
  content/{cliente}/{tipo}/{slug}/templates/preview-b.png
  content/{cliente}/{tipo}/{slug}/templates/preview-c.png

Responde: A | B | C | "mistura A+B" | "refazer"
```

### Step 4: Iterar com feedback

Se o usuário pedir ajuste ("A mas com verde"), ajustar o template-a.html e re-renderizar.

Repetir até o usuário aprovar uma variação.

### Step 5: Salvar como referência do cliente

Template aprovado vira identidade visual persistente:

```
clients/{slug}/references-visuais/
├── carrossel-aprovado-2026-04-21.html   ← template completo
├── carrossel-aprovado-2026-04-21.png    ← preview
└── style-rules.md                       ← extraído do template (cores, fontes, spacing)
```

`style-rules.md` contém as regras estruturadas pra próximos conteúdos usarem sem ter que abrir o HTML:

```markdown
# Style Rules: Carrossel {cliente}
# Aprovado em {data}

## Cores
- Primary: #00BFFF (hero, links)
- Secondary: #0D0D0D (fundo)
- Accent: #FFD700 (destaque)
- Background: #0D0D0D
- Text: #FFFFFF

## Tipografia
- Hero: Anton, 72px, weight 700, uppercase
- Heading: Inter, 48px, weight 600
- Body: Inter, 36px, weight 500, line-height 1.45
- Caption: Inter, 26px, weight 500, color #888

## Layout
- Container: 1080×1350, padding 80px
- Display: flex column
- Gap entre blocos: 48px
- Logo: top-right, 60×60px

## Decorações
- Linha horizontal #00BFFF 4px após hero
- Footer com handle do cliente ativo (`brand-profile.md`) bottom-center 24px

## Exemplos
Ver `references-visuais/carrossel-aprovado-2026-04-21.html`
```

### Step 6: Atualizar state.json

No pipeline do ct-diretor, marcar:

```json
{
  "agents": [
    { "id": "ct-template-designer", "step": 3, "status": "done",
      "output": "clients/{slug}/references-visuais/carrossel-aprovado-YYYYMMDD.html" }
  ]
}
```

## Integração com ct-carrossel-gen

A skill `ct-carrossel-gen` continua sendo a responsável pela renderização final. `ct-template-designer` apenas **define o template**, `ct-carrossel-gen` usa esse template + os textos reais pra gerar os N slides finais.

Fluxo:
1. `ct-template-designer` → define template (1 vez por cliente/tipo, reutilizado)
2. `ct-carrossel-gen` → usa template + textos da sessão atual → N slides PNG

## Regras obrigatórias

1. **SEMPRE 3 variações**, nunca 1 só, nunca 5+
2. **SEMPRE texto real**, nada de Lorem ipsum
3. **SEMPRE HARD RULES**, checar dimensão, fonte, peso, contraste
4. **NUNCA contador de slides** ("1/7")
5. **SEMPRE salvar como `references-visuais/`** após aprovação
6. **SEMPRE extrair `style-rules.md`** estruturado
7. **SEMPRE atualizar state.json** no pipeline

## Dependências

- `ct-carrossel-gen` (renderização HTML → PNG)
- Playwright (Chromium headless)
- Node 20+

## Env vars necessárias

Nenhuma própria, herda de `ct-carrossel-gen`.

## Exemplos

### Exemplo 1: Novo carrossel do cliente
```
usuário: "cria carrossel sobre {tema}"
ct-diretor (step 1): ct-pesquisador → 3 ângulos
usuário: aprova ângulo
ct-diretor (step 2): ct-redator → copy 7 slides
usuário: aprova texto
ct-diretor (step 3): ct-template-designer →
  - Gera 3 variações de template
  - Render preview-a.png, preview-b.png, preview-c.png
  - Apresenta pro usuário
usuário: "B mas com azul mais escuro"
ct-template-designer: ajusta template-b, re-renderiza
usuário: aprovado
ct-template-designer: salva em references-visuais/
  → ct-carrossel-gen gera os 7 slides finais
```

### Exemplo 2: Trocar visual sem novo conteúdo
```
usuário: "redesenha os stories do cliente"
ct-template-designer: gera 3 variações de story (1080×1920)
usuário: escolhe C
ct-template-designer: salva references-visuais/story-aprovado-{data}.html
```

## Referências

- `skills/ct-carrossel-gen/SKILL.md`: renderização HTML → PNG
- `references/carousel-standards.md`: specs técnicas gerais
- `references/pipeline-state.md`: schema do state.json
- `clients/{slug}/design-system.md`: design do cliente
- Inspiração externa (opensquad, terceiro): https://github.com/giovani-junior-dev/opensquad-script7/blob/main/skills/template-designer/SKILL.md. A skill deste kit é `skills/ct-template-designer/SKILL.md`.
