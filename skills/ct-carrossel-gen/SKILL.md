---
name: ct-carrossel-gen
description: "Gera slides de carrossel (PNG 1080x1350) a partir de HTML + Playwright, em 3 layouts (perfil-v2 padrao, perfil, chip), usando cores, fontes, nome, handle e foto da marca ativa."
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
Nada de cor, nome ou handle fica fixo: tudo vem da marca ativa (`clients/{slug}/design-tokens.css`).

## Regras absolutas

- **Unico metodo:** HTML + Playwright via `generate-slides.js`. PROIBIDO: nano-banana, Pillow, IA generativa, canvas manual.
- **Identidade vem da marca:** cores, fontes, nome e handle dos tokens da marca (`clients/{slug}/design-tokens.css`, ou `design-system.md` e `brand-profile.md` quando ela ainda nao tem o arquivo). Em conflito, prevalece a marca.
- **Todo slide tem titulo** (e tag, no layout `chip`). Regra do `references/viral-playbook.md` (secao 3) e do `references/carousel-design-system.md`. O slide 1 e o gancho inteiro.
- **Foto da marca so a real**, em `clients/{slug}/assets/` (arquivo indicado em `--brand-avatar`, ou nome comecando com `perfil`, `profile`, `avatar`, `foto` ou `logo`). Aparece no header de todo slide. Sem foto real, sai a imagem neutra do kit (`assets/avatar-placeholder.svg`): serve so para previa, troque antes de publicar. NUNCA gerar foto por IA e NUNCA usar imagem de URL externa.
- **Selo de verificado desligado por padrao** (`--car-verified: off`). So ligue se a conta for realmente verificada: simular verificacao e proibido.
- **Confirmar os textos** com o usuario ANTES de gerar as imagens.
- **CTA unico e claro** no ultimo slide, conforme o `brand-profile.md` e a secao 4 do playbook. Sem "Siga!" ou "Curta!" soltos.
- **Texto revisado:** limpo, legivel e natural. Sem travessao.

## Regras de linguagem

- Tom conversacional, como explicar a um amigo. Vocabulario e nivel tecnico seguem o `brand-profile.md`.
- Traduzir os termos tecnicos em ingles do nicho da marca para o que o publico dela entende. Ex.: se o nicho usa "pipeline", escrever "processo", a nao ser que o publico use o termo em ingles.
- Maximo 30 palavras por slide (slide de lista ou passo a passo pode passar, sem virar paragrafao).
- Hashtags so na legenda, nunca no slide.

## Layouts

Padrao para marca nova: `perfil-v2`. Os outros dois sao opcoes (token `--car-layout` ou `--layout` na linha de comando).

| Layout | Como e |
|--------|--------|
| `perfil-v2` (padrao) | Header compacto (foto, nome, selo opcional e @) com linha fina, zona de titulo separada da zona de midia/corpo, contador `N/TOTAL` com pontos de progresso. Tipos de slide: capa, conteudo, cta |
| `perfil` | Foto, nome e @ no topo e texto corrido embaixo, sem numeracao |
| `chip` | Tag no topo esquerdo, @ e logo no topo direito, titulo em maiusculas, frase da marca no rodape, fundo alternando entre base e cor de destaque |

## Design: o que vem da marca e o que e do kit

| Propriedade | Origem |
|-------------|--------|
| Dimensao 1080 x 1350 px, PNG | Kit (fixo) |
| Fundo, texto, destaque, fontes | Tokens da marca |
| Nome, @, foto, selo, frase de rodape, layout | Tokens da marca (bloco CARROSSEL) |
| Margens 80 / 150 / 175 (lateral, topo, base) | Kit, ver `references/carousel-safe-zone.md` (tokens `--car-margin-*`) |
| Tamanhos de titulo e texto, zonas, foto | Kit, ajustaveis nos tokens `--car-size-*` e `--car-avatar-*` |

Fluxo dos tokens: o modelo neutro `skills/ct-carrossel-gen/templates/design-tokens.modelo.css` vai sempre por baixo, e por cima entra o primeiro que existir:

1. `clients/{slug}/design-tokens.css` da marca (bloco CARROSSEL: `--brand-name`, `--brand-handle`, `--brand-avatar`, `--car-layout`, `--car-verified`, `--car-footer-text`, `--car-margin-*`, `--car-size-*`, `--car-font-*`).
2. Tokens derivados da tabela de cores e fontes de `clients/{slug}/design-system.md`.
3. So o modelo neutro (marca ainda sem cores preenchidas).

Nome e @ ainda iguais ao modelo ("Sua Marca", "@suamarca") contam como nao preenchidos: o gerador usa os do `brand-profile.md`. Frase de rodape entre [colchetes] nao vai para a imagem.
Para fixar e ajustar, use o `clients/{slug}/design-tokens.css` (copia de `clients/_template/`) e troque so os valores marcados TROCAR.
Sistema visual do Open Design (`ct-od-design-import`) pode sobrescrever os tokens sob pedido.

## Como montar os slides

Crie `content/{slug}/carousels/{nome}/slides.json` (nome em kebab-case):

```json
[
  { "tipo": "capa", "titulo": "Tres erros de ==preco==\nque custam caro", "texto": ["Veja o que corrigir"] },
  { "tipo": "conteudo", "titulo": "Copiar o preco do vizinho", "texto": ["Cada bairro tem **outro publico**."] },
  { "tipo": "conteudo", "titulo": "Como corrigir", "itens": ["Liste os custos | pese cada insumo", "Some a margem | minimo 30%"] },
  { "tipo": "cta", "titulo": "Quer a planilha?", "texto": ["Comenta ==PALAVRA== que eu mando."] }
]
```

| Campo | Faz |
|-------|-----|
| `titulo` | Titulo do slide (obrigatorio). No `perfil-v2` aceita quebra de linha (`\n`) e `==destaque==` |
| `texto` | Uma linha por item. `1. x` vira passo numerado, `- x` vira marcador. No cta do `perfil-v2`, as demais linhas viram a frase de chamada |
| `itens` | Lista numerada, `"acao | descricao"` (no `perfil` e no `chip` viram linhas de texto) |
| `codigo` | Bloco de codigo ou comando (so `perfil-v2`) |
| `imagem` | Print, foto ou tela em `clients/{slug}/assets/` (caminho relativo a essa pasta), na zona de midia, nunca sob o texto (so `perfil-v2`) |
| `html` | Conteudo escrito a mao. No `perfil-v2` substitui so a zona de midia (header, titulo e N/TOTAL ficam; classes `.card`, `.card-row`, `.steps`) |
| `tag` | Categoria no topo, so no layout `chip` |
| `tom` | So no `chip`: `claro` (fundo base) ou `escuro` (fundo de cor); sem ele, alterna |
| `tipo` | `capa`, `conteudo` ou `cta` (`hook` e `body` valem como apelidos). Sem ele: primeiro e capa, ultimo e cta, o resto e conteudo |

Marcacao no texto: `**negrito**` e `==destaque na cor da marca==`. HTML digitado no texto e tratado como texto.
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

Opcionais: `--slides arquivo.json` (padrao: o `slides.json` da pasta da peca), `--layout perfil-v2|perfil|chip`
(vence o token da marca, bom para comparar os 3 visuais) e `--out pasta` (padrao: a pasta `slides/` da peca;
use uma pasta fora de `content/` para previas).

O script imprime o layout, de onde vieram os tokens e se achou foto. No `perfil-v2`, avisa se algum texto passou da zona de midia.

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
- [ ] Nome e handle corretos no header de todo slide (nada de "Sua Marca" ou "@suamarca")
- [ ] Foto real da marca no header (nunca a imagem neutra do kit, nunca imagem externa, selo so em conta verificada)
- [ ] Titulo em todo slide; 1 conceito por slide
- [ ] Contraste do texto legivel (minimo 4,5:1 no corpo, 3:1 em titulo grande), nenhum texto abaixo de 22px
- [ ] Nada de texto fora das margens 80 / 150 / 175
- [ ] Ultimo slide com CTA unico
- [ ] Texto revisado, sem travessao, termos tecnicos traduzidos
- [ ] PNG 1080x1350

## Problemas comuns

- **Fonte nao carrega:** precisa de internet na primeira vez (Google Fonts). Sem internet, o gerador usa a fonte do sistema.
- **Playwright nao instalado:** `npm install` e `npx playwright install chromium`.
- **Texto muito longo:** encurtar ou dividir em 2 slides (no `perfil-v2` o aviso de zona de midia aponta o slide).
- **Cores erradas:** conferir a origem dos tokens na primeira linha que o script imprime e preencher `design-tokens.css` (ou `design-system.md`).
- **Aparece a imagem neutra no lugar da foto:** colocar `perfil.jpg` (ou `avatar`, `foto`, `logo`) em `clients/{slug}/assets/`, ou apontar o arquivo em `--brand-avatar`.
