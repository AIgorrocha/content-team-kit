# Open Design: integração no Content Team AI

> Documento operacional: descreve **o que está integrado**.
> Repo fonte: https://github.com/nexu-io/open-design (Apache-2.0)

---

## O que está integrado

### Base

| PR | Aplicado em | Status |
|----|-------------|--------|
| PR-1 Tokens CSS por cliente | `clients/{slug}/design-tokens.css` de cada cliente | ok |
| PR-2 BASE_STYLE shared partial | `skills/ct-carrossel-gen/templates/base-style.css` | ok |
| PR-3 Frontmatter `od:` em SKILL.md | skills principais | ok |
| PR-4 Anti-slop checklist + 5-dim critique | `agents/ct-carrossel.md`, `agents/ct-designer.md` | ok |
| PR-5 Device frames SVG | `skills/ct-carrossel-gen/assets/devices/` | ok |

### Habilidades

5 skills (`ct-od-*`) e 8 design systems incorporados ao catálogo.

---

## Mapeamento Open Design → Content Team AI

| Open Design (origem) | Content Team AI (destino) | Tipo |
|---|---|---|
| `design-templates/simple-deck/` | `skills/ct-od-deck/` | skill nova |
| `design-templates/saas-landing/` | `skills/ct-od-landing/` | skill nova |
| `design-templates/blog-post/` | `skills/ct-od-blog/` | skill nova |
| `design-templates/web-prototype/` | `skills/ct-od-prototype/` | skill nova |
| `apps/daemon/src/claude-design-import.ts` (lógica) | `skills/ct-od-design-import/` | skill nova (port .md) |
| `design-systems/{linear-app,vercel,cursor,opencode-ai}/` | `skills/ct-od-design-import/systems/` (exemplo: tech dark) | catálogo |
| `design-systems/{notion,editorial,corporate,minimal}/` | `skills/ct-od-design-import/systems/` (exemplo: corporate clean) | catálogo |
| `craft/anti-ai-slop.md` | regras anti-slop em `skills/ct-carrossel-gen/SKILL.md` e nos agentes | regra |
| 5-dim self-critique | `agents/ct-carrossel.md`, `ct-designer.md` | regra agente |

---

## Design systems incorporados (8 de 129)

Selecionados por afinidade com brand de cada cliente. Catálogo fica em `skills/ct-od-design-import/systems/`.

### Preferenciais por cliente (exemplo: tech dark premium)

| Sistema | Por que combina |
|---|---|
| **linear-app** | Dark mode native, achromatic + 1 cor de marca, Inter Variable, estética premium tech |
| **vercel** | Tipografia Geist, dark/light bem balanceados, geométrico minimal |
| **cursor** | IDE-flavored, tech utility, monospace forte, combina com conteúdo de IA pra dev |
| **opencode-ai** | Terminal aesthetic, brutalist tech, fit pra posts "manual" de agentes |

### Preferenciais por cliente (exemplo: corporate clean light)

| Sistema | Por que combina |
|---|---|
| **notion** | Light editorial, serif headlines, neutro confiável |
| **editorial** | Magazine-style, hierarquia tipográfica rigorosa, fit pra carrosséis longos |
| **corporate** | Sans-serif sóbrio, paleta neutra com 1 accent, gabarito direto |
| **minimal** | Whitespace primeiro, zero decoração, combina com marcas técnico-consultivas |

Cada pasta tem `DESIGN.md` + `tokens.css` + `components.html` (estrutura nativa OD).

---

## Skills novas: quando usar cada uma

### `ct-od-deck`: Decks HTML scroll horizontal

**Use quando:** o usuário pedir "deck", "slides", "apresentação", "PPT". Substitui carrossel quando o formato pede 6-18 slides web em vez de PNG IG.

Saída: 1 arquivo `index.html` standalone com navegação por teclado/swipe. Pode virar PDF ou screenshot pra IG depois.

### `ct-od-landing`: Landing pages SaaS-style

**Use quando:** propostas comerciais, landings de lançamento, hotsites de produto ou serviço. Hero + features + social proof + CTA + footer.

### `ct-od-blog`: Blog post / artigo long-form

**Use quando:** artigo LinkedIn long-form, post de blog, case study. Hierarquia tipográfica magazine, max-width 680-720px, pull quotes.

### `ct-od-prototype`: Protótipo web genérico

**Use quando:** mockup interno, sketch de feature, exploração visual antes de validar com cliente. Genérico, sem estrutura fixa.

### `ct-od-design-import`: Importar design system do catálogo

**Use quando:** o usuário pedir "aplica estilo Linear nesse carrossel", "quero esse post no visual da Vercel", "experimenta editorial". Skill carrega tokens do sistema escolhido e injeta como override sobre o design-tokens.css do cliente.

---

## Estratégia de aplicação (resumo executivo)

1. Pedido entra (pelo terminal ou, se configurado, pelo Telegram) → `ct-diretor` orquestra
2. Diretor lê `clients/active-client.md` + `brand-profile.md` + `design-tokens.css`
3. Se conteúdo é **deck/landing/blog/protótipo** → delega pra `ct-od-*`
4. `ct-od-*` lê `clients/{slug}/preferred-systems.md` (se existir) pra saber qual design system aplicar como base
5. Gera HTML standalone aplicando tokens do cliente + estilo do sistema escolhido
6. Roda 5-dim self-critique antes de devolver
7. Entrega HTML pronto pra deploy (Vercel) ou screenshot (IG/LinkedIn)

---

## NÃO subimos daemon Open Design

Decisão arquitetural: integração é por **port de habilidades**, não por **app paralelo**.

- Não rodamos `pnpm tools-dev`
- Não dependemos de processo Node permanente
- Templates ficam em `.md` + `.html` + `.css` consumidos via Agent tool + skills tradicionais Claude Code
- Atribuição Apache-2.0 mantida em `skills/ct-od-design-import/LICENSE.open-design`

---

## Como testar

1. **Testar `ct-od-deck`:** pedir "deck de 8 slides sobre [tema]": o estilo deve sair conforme o design-system de cada cliente (ex.: tech dark pra um perfil, editorial light pra outro).
2. **Testar `ct-od-design-import`:** "aplica estilo Vercel no próximo carrossel", ver se override de tokens funciona limpo.
3. **Testar `ct-od-blog`:** próximo artigo LinkedIn long-form, gerar HTML pra colar imagens no LinkedIn ou hospedar.
4. **Depois:** importar mais design systems do catálogo do Open Design (são 129 disponíveis).

---

## Atribuição

Templates, estrutura de skills e design systems derivados de https://github.com/nexu-io/open-design (Apache License 2.0). NOTICE preservado em `skills/ct-od-design-import/LICENSE.open-design`.
