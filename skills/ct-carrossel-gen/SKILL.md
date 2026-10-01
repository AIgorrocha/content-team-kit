---
name: ct-carrossel-gen
description: "Gera slides de carrossel (PNG 1080x1350) a partir de HTML + Playwright, usando as cores, fontes, nome e handle da marca ativa."
homepage: https://playwright.dev
metadata: { "kit": { "emoji": "🎨", "requires": { "bins": ["node", "npx"], "env": [] } } }
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  applied: [tokens, base-style, components, anti-slop, device-frames, self-critique]
  mode: prototype
  scenario: marketing
  aspect_hint: "1080x1350 (4:5)"
  preview: { type: png }
  design_system: { requires: true }
---

# Carrossel: gerar slides PNG da marca ativa

Gera os slides de um carrossel de Instagram como PNG 1080x1350. Metodo UNICO: HTML renderizado
no Playwright e captura de tela, feito pelo script `skills/ct-carrossel-gen/scripts/generate-slides.js`.
Nada de cor, nome ou handle fica fixo: tudo vem da marca ativa (`clients/{slug}/`).

## Regras absolutas

- **Unico metodo:** HTML + Playwright via `generate-slides.js`. PROIBIDO: nano-banana, Pillow, IA generativa, canvas manual.
- **Identidade vem da marca:** cores e fontes do design system da marca (`clients/{slug}/design-tokens.css` ou `design-system.md`), nome e handle do `brand-profile.md`. Em conflito, prevalece a marca.
- **Todo slide tem tag de categoria e titulo.** Regra do `references/viral-playbook.md` (secao 3) e do `references/carousel-design-system.md`. O slide 1 e o gancho inteiro.
- **Foto da marca so a real**, em `clients/{slug}/assets/` (nome comecando com `perfil`, `profile`, `avatar`, `foto` ou `logo`). Aparece no header de todo slide. Sem foto, o slide sai sem avatar. NUNCA gerar foto por IA e NUNCA usar imagem de URL externa.
- **Sem selo de verificado.** Simular verificacao e proibido.
- **Confirmar os textos** com o usuario ANTES de gerar as imagens.
- **CTA unico e claro** no ultimo slide, conforme o `brand-profile.md` e a secao 4 do playbook. Sem "Siga!" ou "Curta!" soltos.
- **Texto revisado:** limpo, legivel e natural. Sem travessao.

## Regras de linguagem

- Tom conversacional, como explicar a um amigo. Vocabulario e nivel tecnico seguem o `brand-profile.md`.
- Traduzir os termos tecnicos em ingles do nicho da marca para o que o publico dela entende. Ex.: se o nicho usa "pipeline", escrever "processo", a nao ser que o publico use o termo em ingles.
- Maximo 30 palavras por slide (slide de lista ou passo a passo pode passar, sem virar paragrafao).
- Hashtags so na legenda, nunca no slide.

## Design: o que vem da marca e o que e do kit

| Propriedade | Origem |
|-------------|--------|
| Dimensao 1080 x 1350 px, PNG | Kit (fixo) |
| Fundo, texto, destaque | Design system da marca (tokens) |
| Fontes | Design system da marca |
| Margens 80 / 150 / 175 (lateral, topo, base) | Kit, ver `references/carousel-safe-zone.md` |
| Header compacto (avatar 64px + nome + handle) e linha fina | Kit, dados da marca |
| Tag em cima do titulo, contador `N/TOTAL` e barra de progresso | Kit |
| Seta de passar (todo slide, menos o ultimo) | Kit |

Fluxo dos tokens (nesta ordem, o gerador usa o primeiro que existir):

1. `clients/{slug}/design-tokens.css` da marca.
2. Tokens derivados da tabela de cores e fontes de `clients/{slug}/design-system.md`.
3. Modelo neutro `skills/ct-carrossel-gen/templates/design-tokens.modelo.css` (marca ainda sem cores preenchidas).

Para fixar e ajustar, copie o modelo para `clients/{slug}/design-tokens.css` e troque so os valores marcados TROCAR.
Sistema visual do Open Design (`ct-od-design-import`) pode sobrescrever os tokens sob pedido.

## Como montar os slides

Crie `content/{slug}/carousels/{nome}/slides.json` (nome em kebab-case):

```json
[
  { "tag": "DICA", "titulo": "Tres erros de ==preco== que custam caro" },
  { "tag": "ERRO 1", "titulo": "Copiar o preco do vizinho", "texto": ["Cada bairro tem **outro publico**."] },
  { "tag": "PASSOS", "titulo": "Como corrigir", "itens": ["Liste os custos | pese cada insumo", "Some a margem | minimo 30%"], "claro": true },
  { "tag": "FECHAMENTO", "titulo": "Quer a planilha?", "texto": ["Comenta ==PALAVRA== que eu mando."] }
]
```

| Campo | Faz |
|-------|-----|
| `tag` | Categoria em maiusculas acima do titulo |
| `titulo` | Titulo do slide (obrigatorio) |
| `texto` | Um paragrafo por item da lista |
| `itens` | Lista numerada, `"acao | descricao"` |
| `codigo` | Bloco de codigo ou comando |
| `imagem` | Print, foto ou tela em `clients/{slug}/assets/` (caminho relativo a essa pasta), abaixo do titulo, nunca sob o texto |
| `claro` | `true` para fundo claro (alterne claro e escuro para dar ritmo) |
| `tipo` | `hook`, `body`, `list`, `code` ou `cta`. Sem ele: primeiro e hook, ultimo e cta, o resto e body |

Marcacao no texto: `**negrito**` e `==destaque na cor da marca==`. HTML digitado e tratado como texto.
Tipos de slide e arco narrativo: `references/carousel-design-system.md`. Componentes prontos (card de destaque,
lista numerada, comparacao em colunas) em `skills/ct-carrossel-gen/templates/components/`; mockups de aparelho
em `assets/devices/`.

## Fluxo completo

### 1. Preparar e aprovar os textos

1. Receber o conteudo (do redator, do usuario ou de reciclagem).
2. Pedido solto ("faz a capa", "so o gancho") sem briefing: pedir antes marca, tema, angulo e objetivo.
3. Listar os textos de todos os slides e mostrar ao usuario. So seguir depois do "pode".

### 2. Gerar os PNGs

Na raiz do kit:

```bash
node skills/ct-carrossel-gen/scripts/generate-slides.js --nome {nome}
```

O gerador usa a marca ativa (`.workspace`). Para outra marca, o fluxo e trocar o `.workspace`, nao passar
`--slug` de outra marca (o script recusa). Saida: `content/{slug}/carousels/{nome}/slides/slide-01.png`, `slide-02.png`...
O script imprime de onde vieram os tokens e se achou foto.

Se faltar Playwright: `npm install` e `npx playwright install chromium`.

### 3. Olhar os PNGs

Abrir cada PNG final e ler cada texto no tamanho em que ele sai (portao visual e contraste em `agents/ct-carrossel.md`).
Corrigir o `slides.json` e gerar de novo ate passar.

### 4. Subir as imagens (OPCIONAL, so na hora de publicar)

Nao e preciso subir nada para entregar os PNGs. Na publicacao, `scripts/publishing/post-carousel.mjs` ja sobe as
imagens no bucket do Supabase (padrao `content-media`; o fluxo de `docs/PUBLICACAO_AUTO.md` usa `ct-temp-media`).
Isso so funciona com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` e com o bucket criado.
Sem essas chaves, entregue os PNGs locais e pare: o usuario publica por conta propria.

### 5. Registro e publicacao

O registro em `ct_content_items` acontece na publicacao, com o link real (`registerPublication()`).
Nada e publicado sem "pode" explicito do usuario.

## Checklist de qualidade

- [ ] Cores e fontes vem da marca (nada do modelo neutro, a menos que a marca ainda nao tenha cores)
- [ ] Nome e handle corretos no header de todo slide
- [ ] Foto real da marca no header, ou sem avatar (nunca imagem externa, nunca selo de verificado)
- [ ] Tag e titulo em todo slide; 1 conceito por slide
- [ ] Contraste do texto legivel (minimo 4,5:1 no corpo, 3:1 em titulo grande), nenhum texto abaixo de 22px
- [ ] Nada de texto fora das margens 80 / 150 / 175
- [ ] Ultimo slide sem seta e com CTA unico
- [ ] Texto revisado, sem travessao, termos tecnicos traduzidos
- [ ] PNG 1080x1350

## Problemas comuns

- **Fonte nao carrega:** precisa de internet na primeira vez (Google Fonts). Sem internet, o gerador usa a fonte do sistema.
- **Playwright nao instalado:** `npm install` e `npx playwright install chromium`.
- **Texto muito longo:** encurtar ou dividir em 2 slides.
- **Cores erradas:** conferir a origem dos tokens na primeira linha que o script imprime e preencher `design-system.md` ou criar `design-tokens.css`.
- **Sem avatar:** colocar `perfil.jpg` (ou `avatar`, `foto`, `logo`) em `clients/{slug}/assets/`.
