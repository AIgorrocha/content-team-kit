---
name: ct-od-prototype
description: "Gera protótipo web genérico standalone (sem estrutura fixa) usando tokens do cliente + design system escolhido. Pra mockup interno, sketch de feature, exploração visual antes de validar com cliente."
homepage: https://github.com/nexu-io/open-design
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  derived_from: design-templates/web-prototype
  mode: prototype
  platform: desktop
  scenario: design
  preview: { type: html }
  design_system: { requires: true }
triggers:
  - "prototipo"
  - "protótipo"
  - "mockup"
  - "sketch"
  - "exploracao"
metadata: { "kit": { "emoji": "🧪" } }
---

# ct-od-prototype: Protótipo web genérico

Adaptação do skill `web-prototype` do Open Design.

## Quando usar

- Mockup interno (o usuário explorando ideia antes de mostrar pra cliente)
- Sketch de feature pra validar conceito
- Exploração visual de várias direções (gerar 2-3 variantes do mesmo brief)
- Protótipo de tela pra screen shot virar peça de Reels (combina com `ct-telas`)

**NÃO usar quando:** o pedido tem estrutura clara → use `ct-od-deck`, `ct-od-landing`, `ct-od-blog` que já trazem layout.

## Workflow

### Passo 0: Contexto

1. `clients/active-client.md`
2. `clients/{slug}/design-tokens.css`
3. `clients/{slug}/preferred-systems.md`

### Passo 1: Brief minimalista

Antes de gerar, confirmar com o usuário em 1 mensagem:
- Tipo de tela (dashboard, settings, onboarding, feed, perfil…)
- 3-5 elementos-chave
- Design system base (default = primeiro preferencial do cliente)
- Variações desejadas (1 = padrão, 2-3 = comparação)

### Passo 2: Gerar HTML

- 1 arquivo `index.html` por variação
- CSS inline com tokens + system
- Sem JS além do mínimo (estado fake com `<details>` ou `:checked` quando precisar)
- Componentes vindos de `skills/ct-od-design-import/systems/{nome}/components.html` (copiar primitives)

### Passo 3: Self-critique

```
- Hierarquia clara mesmo sem conteúdo final
- Tokens consistentes
- Mobile-aware (não precisa perfeito, mas sem quebrar em 375px)
- Sem decoração gratuita
```

### Passo 4: Entrega

Salvar em `output/prototypes/{slug-cliente}/{nome}/` (pasta temporária, não vai pro content/).

Se o usuário aprovar e quiser virar peça definitiva → promover pra `content/{slug}/landings/` ou similar.

## Atribuição

Derivado de `design-templates/web-prototype/` do Open Design (Apache-2.0).
