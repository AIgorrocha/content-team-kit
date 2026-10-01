---
name: ct-od-design-import
description: "Importa e aplica design system do catálogo Open Design (8 sistemas pré-incorporados, expansível pros 129 disponíveis no repo) sobre os tokens do cliente ativo. o usuário pede 'aplica estilo Vercel nesse carrossel' e a skill faz o override."
homepage: https://github.com/nexu-io/open-design
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  origin: Open Design
  mode: prototype
  scenario: design
  preview: { type: none }
  design_system: { provides: true }
triggers:
  - "design system"
  - "aplica estilo"
  - "estilo linear"
  - "estilo vercel"
  - "estilo editorial"
  - "trocar visual"
metadata: { "kit": { "emoji": "🎨" } }
---

# ct-od-design-import - Aplicar design system do catálogo

Origem: Open Design (nexu-io/open-design). A lógica de importação de design system foi adaptada para o nosso workflow baseado em arquivos.

## Catálogo incorporado (8 de 129)

Localização: `skills/ct-od-design-import/systems/`

| Sistema | Mood | Perfil de cliente preferencial |
|---|---|---|
| linear-app | Dark mode native, achromatic + indigo | tech/produto |
| vercel | Geist sans, dark/light, geométrico minimal | tech/produto |
| cursor | IDE tech utility, monospace forte | tech/produto |
| opencode-ai | Terminal brutalist tech | tech/produto |
| notion | Light editorial, serif headlines | corporativo/tecnico |
| editorial | Magazine-style, hierarquia rigorosa | corporativo/tecnico |
| corporate | Sans sóbrio, neutro + 1 accent | corporativo/tecnico |
| minimal | Whitespace primeiro, zero decoração | corporativo/tecnico |

Preferencia real por cliente (qual sistema cada cliente ativo já usou): ver `clients/{slug}/design-system.md`.

Cada pasta tem `DESIGN.md` (descrição do estilo) + `tokens.css` (variáveis) + `components.html` (primitivos).

## Como funciona

### Pedido típico

> "aplica estilo vercel no próximo carrossel"

### Workflow

1. Identificar sistema escolhido (validar contra lista acima; se não estiver, ver "Expandir catálogo")
2. Ler `systems/{nome}/tokens.css` para extrair variáveis
3. Ler `clients/{slug}/design-tokens.css` para tokens-base do cliente
4. **Merge:** tokens do cliente são a fundação; sistema escolhido sobrescreve `--bg`, `--surface`, `--accent`, `--font-display`, `--font-body`, `--radius-*`, `--elev-*`
5. **NÃO sobrescrever:** identidade obrigatória do cliente (`--brand-*` se existir, foto oficial no header etc)
6. Passar o tokens final pra skill consumidora (`ct-od-deck`, `ct-od-landing`, `ct-carrossel-gen`...) como `STYLE`
7. Reportar pro usuário qual sistema foi aplicado + 1 frase do `DESIGN.md` explicando o mood

### Exemplo de merge (pseudo-código)

```js
const clientTokens = fs.readFileSync(`clients/${slug}/design-tokens.css`, 'utf8');
const systemTokens = fs.readFileSync(`skills/ct-od-design-import/systems/${system}/tokens.css`, 'utf8');

// system aplica em cima: --bg, --surface, --fg, --accent, --font-*
// cliente protege: identidade fixa (cores de marca obrigatórias)

const STYLE = clientTokens + '\n/* override: ' + system + ' */\n' + systemTokens;
```

## Expandir catálogo

Pra adicionar sistema novo dos 129 disponíveis:

```bash
cp -r "../_refs/open-design/design-systems/{nome}/" \
      "../content-team-ai/skills/ct-od-design-import/systems/{nome}/"
```

Depois atualizar este SKILL.md adicionando linha na tabela.

## Hard rules

- NUNCA aplicar sistema que conflite com identidade obrigatória do cliente (verificar `clients/{slug}/design-system.md` antes de aplicar)
- SEMPRE reportar qual sistema foi aplicado no chat
- Foto/identidade fixa do cliente (definida em `brand-profile.md`) NUNCA é sobrescrita
- Acentuação completa, BR-only, hashtags lowercase mantidas

## Atribuição

Origem: Open Design. Design systems individuais derivados de `design-systems/{nome}/` do Open Design (Apache-2.0). LICENSE preservada em `LICENSE.open-design`.
