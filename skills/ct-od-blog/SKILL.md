---
name: ct-od-blog
description: "Gera blog post / artigo long-form HTML standalone com hierarquia tipográfica magazine (max-width 680-720px, pull quotes, drop caps opcional). Pra artigo LinkedIn long-form, post de blog da empresa, case study."
homepage: https://github.com/nexu-io/open-design
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  derived_from: design-templates/blog-post
  mode: prototype
  platform: desktop
  scenario: marketing
  preview: { type: html }
  design_system: { requires: true }
  craft:
    requires: [typography, typography-hierarchy, typography-hierarchy-editorial]
triggers:
  - "blog"
  - "artigo"
  - "post longo"
  - "case study"
  - "essay"
metadata: { "kit": { "emoji": "📰" } }
---

# ct-od-blog: Artigo long-form HTML

Adaptação do skill `blog-post` do Open Design.

## Quando usar

- Artigo LinkedIn long-form (substitui ou complementa o pipeline `ct-artigo-linkedin`)
- Post do blog do cliente ativo (quando tiver blog ativo)
- Case study de projeto entregue pelo cliente ativo
- Newsletter editorial

**Diferença pro `ct-artigo-linkedin`:** esta skill gera HTML standalone (pra hospedar/printar/exportar). `ct-artigo-linkedin` gera texto pronto pra colar direto no LinkedIn.

## Workflow

### Passo 0: Contexto

1. `clients/active-client.md`
2. `clients/{slug}/brand-profile.md` + `voice-patterns.md` (se existir) + `design-tokens.css`
3. `clients/{slug}/preferred-systems.md` (priorizar editorial, notion, minimal pra long-form)

### Passo 1: Estrutura

1. **Masthead**, wordmark + 4-6 links de nav
2. **Header do artigo**, eyebrow categoria + headline (display grande) + deck (1-2 frases) + autor + cargo + data
3. **Imagem hero**, placeholder 16:9 com gradiente do design system (sem imagens externas) + caption 1 linha
4. **Corpo**, alternando, contendo no mínimo:
   - 1 pull quote (display grande, accent rule na borda inline-start)
   - 1 figura com caption
   - 1 lista (ord ou unord)
   - 1 blockquote inline
5. **Footer autor**, avatar (iniciais em círculo) + bio
6. **Relacionados**, 3 cards (imagem placeholder + título + 1 linha + data)

### Passo 2: Escrever artigo REAL

- Mínimo 600 palavras em 4-6 seções H2
- Sem lorem
- Voice do cliente ativo (ler `voice-patterns.md` quando existir)
- Seguir o tom e as palavras proibidas de `clients/{slug}/brand-profile.md` e `clients/{slug}/regras-cliente.md`

### Passo 3: CSS

- Body: font do design system, max-width 680-720px, centralizado
- Linha 60-75 chars
- Drop cap (`first-letter`) só se DS é editorial/serif
- Accent: máx 2 usos (eyebrow + pull quote, ou 1 link)
- `data-od-id` em headline, hero, body, pull quote, related

### Passo 4: Self-critique

```
- Hierarquia: H1 inequívoco, H2s = divisores, pull quote não compete com H1
- Linha 60-75 chars em prosa
- Tipo body ≥ 18px
- Accent ≤ 2x
- Lê como revista, não como landing
- BR-only, hashtags lowercase, acentos completos
- Anti-slop: zero "inovador", "revolucionário", "futuro do X"
```

### Passo 5: Entrega

Salvar em `content/{slug}/artigos/{slug-artigo}/index.html` + `texto-puro.md` (versão pra colar no LinkedIn).

## Atribuição

Derivado de `design-templates/blog-post/` do Open Design (Apache-2.0).
