---
name: ct-od-landing
description: "Gera landing page SaaS-style standalone (hero + features + social proof + CTA + footer) usando tokens do cliente ativo + design system escolhido. Pra propostas comerciais Vercel, lançamento de produto ou mentoria, hotsite de projeto do cliente."
homepage: https://github.com/nexu-io/open-design
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  derived_from: design-templates/saas-landing
  mode: prototype
  platform: desktop
  scenario: marketing
  preview: { type: html }
  design_system: { requires: true }
triggers:
  - "landing"
  - "landing page"
  - "hotsite"
  - "lp"
metadata: { "kit": { "emoji": "🚀" } }
---

# ct-od-landing: Landing page standalone

Adaptação do skill `saas-landing` do Open Design.

## Quando usar

- Proposta comercial pra cliente (deploy Vercel → vira anexo da proposta)
- Lançamento de produto ou mentoria do cliente ativo
- Hotsite de projeto ou portfólio do cliente ativo
- Qualquer página única com objetivo claro de conversão

## Workflow

### Passo 0: Contexto

1. `clients/active-client.md` → slug
2. `clients/{slug}/brand-profile.md` + `design-tokens.css`
3. `clients/{slug}/preferred-systems.md` → design system base

### Passo 1: Estrutura padrão (ajustar conforme brief)

1. **Nav**, wordmark + 3-5 links + 1 CTA
2. **Hero**, eyebrow (categoria) + headline (display token grande) + subhead (1-2 frases) + CTA primário + CTA secundário (ghost)
3. **Logos de prova social** (opcional), 5-7 marcas/clientes
4. **Features**, 3 ou 6 cards, ícone + título + 1 frase
5. **Bento grid** (opcional), destaque visual maior, 1 feature por bloco
6. **Depoimento**, citação + avatar + nome + cargo
7. **Pricing** (opcional), 2-3 planos
8. **FAQ** (opcional), 5-8 perguntas em `<details>`
9. **CTA final**, section dedicada repetindo proposta
10. **Footer**, wordmark + 3-4 colunas de links + copyright

### Passo 2: Aplicar tokens

```css
:root {
  /* tokens cliente */
  /* + overrides do design system escolhido */
}
```

### Passo 3: Conteúdo real, zero lorem

- Headline = 6-12 palavras, promessa concreta
- Subhead = clarifica em quem é pra quem + benefício
- Features = verbos + benefício mensurável quando possível
- Sem buzzword vazio ("inovador", "revolucionário", "next-gen")

### Passo 4: Self-critique

```
- Hierarquia: 1 headline domina o hero; H2s ritmam seções
- CTA primário vs secundário visualmente distintos
- Tipografia: linha 60-75 chars em prosa
- Accent ≤ 3 usos por viewport
- Mobile: testar com viewport 375px
- Anti-slop: zero gradient genérico, zero "future of X"
```

### Passo 5: Entrega

Salvar em `content/{slug}/landings/{nome}/index.html`.

Deploy: `vercel deploy --prod --yes` (sempre quando for pra cliente externo).

## Hard rules

- 1 hero, 1 CTA primário dominante
- Tokens via `var(--*)`
- Conteúdo real, sem placeholder
- Responsivo mobile-first

## Atribuição

Derivado de `design-templates/saas-landing/` do Open Design (Apache-2.0).
