---
name: ct-od-deck
description: "Gera deck HTML scroll-horizontal (6-18 slides) standalone usando tokens do cliente ativo + design system escolhido do catálogo Open Design. Substitui carrossel quando o formato pede deck web ao invés de PNG IG."
homepage: https://github.com/nexu-io/open-design
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  derived_from: design-templates/simple-deck
  mode: deck
  scenario: marketing
  aspect_hint: "1920x1080 (16:9 web)"
  preview: { type: html }
  design_system: { requires: true }
triggers:
  - "deck"
  - "slides"
  - "ppt"
  - "apresentacao"
  - "apresentação"
metadata: { "kit": { "emoji": "🎞️" } }
---

# ct-od-deck: Deck HTML scroll-horizontal

Adaptação do skill `simple-deck` do Open Design pro nosso workflow white-label.

## Quando usar

- O usuário pede "deck", "slides", "apresentação", "PPT", "pitch"
- Conteúdo é **web-first** (não vai virar PNG quadrado pra IG)
- Precisa de 6-18 slides com navegação por teclado/swipe
- Saída final: 1 `index.html` standalone (pode ir pro Vercel ou exportar PDF)

**NÃO usar quando:** o pedido é carrossel Instagram (1080x1350 PNG), aí use `ct-carrossel-gen`.

## Workflow

### Passo 0: Contexto

1. Ler `clients/active-client.md` → identificar slug
2. Ler `clients/{slug}/brand-profile.md` + `design-tokens.css`
3. Ler `clients/{slug}/preferred-systems.md` → escolher design system do catálogo

### Passo 1: Definir ritmo dos slides ANTES de escrever HTML

Default: 6 slides. Brief curto = 6, pitch médio = 8-10, longa = 12-18.

Esboçar a sequência primeiro:

```
01  hero light center   Capa (hook)
02  light               Problema
03  hero dark center    Estatística forte
04  light               3 pontos
05  dark                Caso prático
06  hero light center   Citação
07  light               Antes / depois
08  hero dark center    CTA
```

Regras de ritmo (não-negociáveis):
- Nenhum tema repetido 3x seguidas
- Em decks 8+, pelo menos 1 `hero dark` e 1 `hero light`
- Alternar respiração a cada 3-4 slides

**Mostrar esse esboço pro usuário antes de gerar HTML.** Ele redireciona barato.

### Passo 2: Aplicar tokens

```css
:root {
  /* injetar conteúdo de clients/{slug}/design-tokens.css */
  /* + overrides do design system escolhido em ct-od-design-import/systems/{nome}/tokens.css */
}
```

### Passo 3: Cada slide

- Wrapper `<section class="slide [tema]">` (`light` / `dark` / `hero light` / `hero dark`)
- `data-screen-label="01 Capa"` em cada um
- 1 conceito por slide, sem filler
- Display tipográfico via `var(--font-display)`
- 1 accent por slide, no máximo 2 usos

### Passo 4: Self-critique (obrigatório antes de entregar)

```
[Self-critique]
- Hierarquia: headline > sub > body > ação
- Legibilidade: nenhum texto < 18px
- Identidade: paleta consistente, accent ≤ 2/slide
- Ritmo: sem 3+ tema repetido, alternância saudável
- Anti-slop: zero emoji decorativo, zero gradient genérico, zero analogia infantil
```

Listar resultado no chat antes de entregar arquivo.

### Passo 5: Entrega

Salvar em `content/{slug}/decks/{nome-do-deck}/index.html`.

Opcional: `vercel deploy --prod --yes` se o usuário quiser link público.

## Regras de linguagem (herdadas)

- BR-only (não citar outras línguas nem "PT-BR" em copy do cliente)
- Hashtags lowercase
- Acentuação completa
- Tom (analogias permitidas ou nao, tecnico-consultivo etc.) segue `clients/{slug}/brand-profile.md`

## Hard rules

- Tema em TODO slide. `class="slide"` puro = bug
- Sem 3+ tema seguidos
- `data-screen-label` em todo slide
- Sem `scrollIntoView()` (quebra iframe preview)
- Tokens do cliente NUNCA hardcoded, sempre via `var(--*)`

## Atribuição

Derivado de `design-templates/simple-deck/` do Open Design (Apache-2.0). Estrutura adaptada pra white-label CT.
