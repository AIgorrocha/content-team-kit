# Carousel Standards - Regras de Geracao de Carrosseis

> ## PARCIALMENTE OBSOLETO. LEIA ANTES DE USAR.
>
> **A fonte canonica de carrossel e `references/carousel-design-system.md`.** Ele manda. Este arquivo sobrevive apenas pela parte de **metodo de geracao** (HTML + Playwright, metodos proibidos, specs de arquivo).
>
> Em caso de divergencia entre este arquivo e o design-system, **o design-system vence, sempre**.
>
> Regra editorial de carrossel (arco de slides, gancho, CTA): `references/viral-playbook.md`, secao 3.
> Voz, hashtags, cores e fontes: `clients/{slug}/brand-profile.md` e `design-system.md`.
>
> Ja corrigido aqui: a antiga regra "nenhum slide com titulo/header" estava **errada** e contradizia o design-system, que prescreve tag de categoria e heading em cada slide.

## Template por marca

Se a marca tiver template proprio em `clients/{slug}/templates/carousel-template/`, use-o como base obrigatoria. Tokens visuais (destaque, avatar, formato de saida) vem do proprio template e do `clients/{slug}/design-system.md`, nao deste arquivo.

Marca nova nao tem template: use o gerador do kit, `skills/ct-carrossel-gen/scripts/generate-slides.js`. Ele le cores, fontes, nome e handle da marca ativa (`clients/{slug}/`) e grava em `content/{slug}/carousels/{nome}/slides/`.

## Metodo UNICO Permitido

**HTML + Playwright screenshot.** Nenhum outro metodo e aceito.

### Como funciona:
1. Criar arquivo HTML com o conteudo do slide
2. Usar Playwright para abrir o HTML no navegador
3. Tirar screenshot no tamanho 1080x1350px
4. Resultado: PNG pronto para Instagram

## PROIBIDO

- **nano-banana** : biblioteca Node.js de geracao de imagem
- **Pillow** : biblioteca Python de manipulacao de imagem
- **IA generativa** : DALL-E, Midjourney, Stable Diffusion para gerar slides
- **Canvas manual** : desenhar pixels manualmente via codigo
- **Qualquer outro metodo** que nao seja HTML + Playwright

### Por que?
Metodos alternativos (Pillow, IA generativa) NUNCA seguem o template corretamente.
HTML + Playwright garante que o resultado e pixel-perfect e consistente.

## Regras Visuais

### Titulos e headings nos slides
- Regra definida em **`references/carousel-design-system.md`** (canonico): cada slide leva **tag de categoria acima do heading**, e **tem heading**.
- A antiga regra deste arquivo ("nenhum slide deve ter titulo/header") esta **obsoleta e nao deve ser seguida**. Contradizia o design-system.

### Foto/Logo oficial
- Usar a foto ou logo REAL da marca, de `clients/{slug}/assets/`, no header compacto de todo slide (avatar de 64px)
- Sem foto ou logo: o slide sai sem avatar. NUNCA gerar foto por IA e NUNCA usar imagem de URL externa
- Sem selo de verificado
- A marca pode definir outro arquivo e posicao no `clients/{slug}/design-system.md`; capa e fechamento podem usar avatar maior (96 a 110px)

## Tipos de Template

### 1. Texto Puro
- Slides com texto sobre fundo definido no design-system do cliente
- Fonte e peso definidos no design-system do cliente
- Destaque na cor primaria do cliente para palavras-chave
- Maximo 30 palavras por slide

### 2. Com Imagens
- Slides que incluem imagens/screenshots alem do texto
- Layout adaptado para acomodar a imagem
- Texto reduzido para complementar a imagem
- Imagem abaixo do titulo, nunca sob o texto; boa resolucao (min 600px de largura)

## Legenda do Post

### Hashtags
- **Quantidade e quais: conforme o `brand-profile.md` do cliente ativo.** Este arquivo e generico e nao fixa numero.
- Hashtags relevantes ao tema do post, misturando amplas e de nicho.

### Estrutura da Legenda
1. Gancho (primeira linha que aparece antes do "mais")
2. Corpo com valor (2-3 paragrafos curtos)
3. CTA unico, correto pra rede (`references/viral-playbook.md`, secao 4)
4. Hashtags conforme o brand-profile do cliente ativo
- NUNCA usar frases auto-referenciais ("nesse carrossel eu mostro", "nesse post explico", "nesse reels"). Regra completa: `viral-playbook.md`, secao 5.

### Legendas por plataforma
- **Instagram + Threads**: MESMA legenda. Publica no IG e compartilha pro Threads
- **LinkedIn**: legenda DIFERENTE, adaptada ao tom profissional. CTA e **pergunta aberta**, nunca "comenta PALAVRA"
- **TikTok**: NAO tem carrossel, nao criar legenda
- Salvar no mesmo arquivo com separador "--- LINKEDIN ---"

## Especificacoes Tecnicas

| Propriedade | Valor |
|-------------|-------|
| Largura | 1080px |
| Altura | 1350px |
| Formato | PNG |
| Fundo | (ver design-system do cliente) |
| Texto principal | (ver design-system do cliente) |
| Texto secundario | (ver design-system do cliente) |
| Destaque 1 | (ver design-system do cliente) |
| Destaque 2 | (ver design-system do cliente) |
| Fonte primaria | (ver design-system do cliente) |
| Fonte secundaria | (ver design-system do cliente) |
| Max slides | 10 |
| Max palavras/slide | 30 |

## Comando Playwright

```bash
npx playwright screenshot \
  --browser chromium \
  --viewport-size "1080,1350" \
  --full-page \
  "file:///caminho/para/slide.html" \
  "/caminho/para/slide.png"
```

## Referencia

Fonte canonica atual de carrossel: `references/carousel-design-system.md`.
