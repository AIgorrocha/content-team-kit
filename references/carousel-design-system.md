# Carousel Design System, Geracao Avancada de Carrosseis

Sistema completo para gerar carrosseis Instagram com design profissional.
Baseado em HTML auto-contido onde cada slide e exportavel como imagem individual.

## Formato

- Aspect ratio: 4:5 (1080x1350px)
- Cada slide e auto-contido, todos os elementos UI estao na imagem
- Alternar fundos claros e escuros para ritmo visual
- Implementacao pronta: `skills/ct-carrossel-gen` (le os tokens da marca, aplica este padrao e grava os PNGs)

## Padrao de layout (canvas 1080x1350)

Regras genericas de layout. Cor e fonte vem da marca (`clients/{slug}/design-tokens.css` ou `design-system.md`).
A marca pode ajustar numeros no proprio design system; margem so pode AUMENTAR.

### Margens (uma unica fonte: `references/carousel-safe-zone.md`)

| Zona | Valor |
|------|-------|
| Lateral | 80px |
| Topo | 150px |
| Base | 175px |
| Area util | 920 x 1025px |

### Escala tipografica (px no canvas 1080x1350)

| Uso | Tamanho | Peso | Observacao |
|-----|---------|------|------------|
| Titulo da capa | 60px | 700 | linha 1.12, espacamento -0.02em |
| Titulo do slide de fechamento (CTA) | 52px | 700 | linha 1.15 |
| Titulo de slide de conteudo | 44px | 700 | linha 1.18, de 4 a 8 palavras |
| Corpo | 28px | 400 (600 no termo-chave) | linha 1.45 |
| Tag, contador N/TOTAL | 22px | 500 | fonte mono, maiusculas na tag |
| Nome no header | 22px | 600 | |
| Handle no header | 18px | 400 | |

Nenhum texto de leitura abaixo de 22px. Os tamanhos em px dos exemplos das secoes seguintes sao de referencia
relativa: no canvas 1080x1350 use esta tabela.

### Header compacto, em todo slide

- Avatar 64px + nome + handle lado a lado, a partir do topo da zona segura (y150). Ocupa ate y214.
- Linha fina (1px, cor de borda do token) em y230 fecha o cabecalho. Nao e rotulo, e regua.
- Capa e fechamento podem usar avatar maior (96 a 110px).
- Sem foto da marca: sem avatar. Nunca selo de verificado.

### Numeracao e progresso

Rodape dentro da area util, acima da margem de base: barra de progresso fina + contador `N/TOTAL` (ex.: `03/09`) na fonte mono.
Seta de passar na borda direita em todo slide, menos o ultimo.

### Zona de titulo separada da midia (nunca texto sobre texto)

Empilhar sempre, sem sobrepor:

1. Header e linha fina (y150 a y230)
2. Tag e titulo, comecando em y254, sempre sobre fundo solido do token (nunca sobre foto, card ou animacao)
3. Corpo ou midia, 32px depois do titulo, terminando em y1100
4. Rodape com contador e progresso, ancorado na margem de base

### Contraste por token

- Titulo sobre o fundo solido da marca: confira o par de cores uma vez no design system (minimo 4,5:1 no corpo, 3:1 no titulo grande).
- Texto pequeno de cor apagada (meta) so em 18px ou mais e com 4,5:1.
- Destaque claro sobre fundo claro costuma reprovar: nos slides claros use a variante escura do destaque (`--accent-dark`).
- Card de midia com fundo proprio: o texto dentro dele usa as cores do card, nao as do slide.

### Slide em video (opcao, nao padrao)

Padrao do kit e slide estatico em PNG. Use video so quando o slide E a demonstracao (uma tela, automacao ou resultado em movimento):
MP4 4:5 1080x1350, H.264, de 3 a 6 segundos, loop limpo (ultimo quadro igual ao primeiro), toca mudo
(o carrossel do Instagram nao da autoplay de audio). Slide de texto, guia ou CTA continua estatico. Caminho de producao:
`skills/ct-motion-code/`. A marca pode decidir no `design-system.md` que prefere video; sem essa decisao, use estatico.
Evidencia e cuidados: `references/aprendizados-de-producao.md`, secao 4.1.

## Step 1: Derivar Paleta de Cores do Cliente

A partir da COR PRIMARIA do cliente (definida em clients/{slug}/design-system.md), gerar 6 tokens:

```
BRAND_PRIMARY   = {cor primaria do cliente}           // Accent principal, progress bar, icones, tags
BRAND_LIGHT     = {primary clareada ~20%}             // Accent secundario, tags em fundo escuro
BRAND_DARK      = {primary escurecida ~30%}           // Texto CTA, ancora de gradiente
LIGHT_BG        = {off-white quente ou frio}          // Fundo claro (NUNCA branco puro #fff)
LIGHT_BORDER    = {levemente mais escuro que LIGHT_BG} // Divisores em slides claros
DARK_BG         = {quase-preto com tint da marca}     // Fundo escuro
```

### Regras de derivacao:
- LIGHT_BG = off-white com tint que complementa a primaria (quente → creme, fria → cinza-branco)
- DARK_BG = quase-preto com tint sutil da temperatura da marca (quente → #1A1918, fria → #0F172A)
- LIGHT_BORDER = sempre ~1 tom mais escuro que LIGHT_BG
- Gradiente da marca: `linear-gradient(165deg, BRAND_DARK 0%, BRAND_PRIMARY 50%, BRAND_LIGHT 100%)`

## Step 2: Tipografia

Usar fontes do design-system do cliente. Se nao definidas, seguir estes pares sugeridos:

| Estilo | Fonte Heading | Fonte Body |
|--------|--------------|------------|
| Editorial / premium | Playfair Display | DM Sans |
| Moderno / limpo | Plus Jakarta Sans (700) | Plus Jakarta Sans (400) |
| Quente / acessivel | Lora | Nunito Sans |
| Tecnico / sharp | Space Grotesk | Space Grotesk |
| Bold / expressivo | Fraunces | Outfit |
| Classico / confiavel | Libre Baskerville | Work Sans |
| Arredondado / amigavel | Bricolage Grotesque | Bricolage Grotesque |

### Escala de tamanhos
Use a tabela "Escala tipografica" do Padrao de layout acima (canvas 1080x1350). Numeros de steps: fonte do titulo, peso 700.

## Step 3: Elementos Obrigatorios em Todo Slide

### 1. Progress Bar (parte inferior de todo slide)

Mostra onde o usuario esta no carrossel. Preenche conforme avanca.

- Posicao: absolute bottom, full width, 28px padding horizontal, 20px padding inferior
- Track: 3px altura, bordas arredondadas
- Largura do fill: `((slideIndex + 1) / totalSlides) * 100%`
- Adapta ao fundo do slide:
  - Slides claros: track `rgba(0,0,0,0.08)`, fill BRAND_PRIMARY, counter `rgba(0,0,0,0.3)`
  - Slides escuros: track `rgba(255,255,255,0.12)`, fill `#fff`, counter `rgba(255,255,255,0.4)`
- Label contador: formato "01/07", fonte mono, tamanho da tabela de escala

```javascript
function progressBar(index, total, isLightSlide) {
  const pct = ((index + 1) / total) * 100;
  const trackColor = isLightSlide ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const fillColor = isLightSlide ? BRAND_PRIMARY : '#fff';
  const labelColor = isLightSlide ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
  return `<div style="position:absolute;bottom:0;left:0;right:0;padding:16px 28px 20px;z-index:10;display:flex;align-items:center;gap:10px;">
    <div style="flex:1;height:3px;background:${trackColor};border-radius:2px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${fillColor};border-radius:2px;"></div>
    </div>
    <span style="font-size:11px;color:${labelColor};font-weight:500;">${index + 1}/${total}</span>
  </div>`;
}
```

### 2. Seta de Swipe (borda direita, todo slide EXCETO o ultimo)

Chevron sutil na borda direita indicando pra continuar passando. NO ULTIMO SLIDE e REMOVIDA.

- Posicao: absolute right, full height, 48px largura
- Background: gradiente de transparente → tint sutil
- Chevron: SVG 24x24, tracos arredondados
- Adapta ao fundo:
  - Slides claros: bg `rgba(0,0,0,0.06)`, stroke `rgba(0,0,0,0.25)`
  - Slides escuros: bg `rgba(255,255,255,0.08)`, stroke `rgba(255,255,255,0.35)`

```javascript
function swipeArrow(isLightSlide) {
  const bg = isLightSlide ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const stroke = isLightSlide ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  return `<div style="position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;background:linear-gradient(to right,transparent,${bg});">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;
}
```

## Step 4: Sequencia Padrao de Slides

Seguir este arco narrativo. Numero de slides pode variar (5-10), mas 7 e ideal.

| # | Tipo | Fundo | Proposito |
|---|------|-------|-----------|
| 1 | Hero | LIGHT_BG | Hook, declaracao forte, logo, watermark opcional |
| 2 | Problema | DARK_BG | Dor, o que esta quebrado, frustrante ou ultrapassado |
| 3 | Solucao | Gradiente marca | A resposta, o que resolve, quote/prompt box opcional |
| 4 | Features | LIGHT_BG | O que voce ganha, lista de features com icones |
| 5 | Detalhes | DARK_BG | Profundidade, specs, diferenciais |
| 6 | Como funciona | LIGHT_BG | Steps, workflow ou processo numerado |
| 7 | CTA | Gradiente marca | Call to action, logo, tagline, botao CTA. SEM seta. Progress bar 100%. |

### Regras:
- Comece com hook no LIGHT_BG
- Termine com CTA no gradiente da marca, sem seta, progress bar em 100%
- Alterne fundos claros e escuros
- Adapte a sequencia ao topico, nem todo carrossel precisa de slide "problema"

## Step 5: Componentes Reutilizaveis

### Tag / Label de Categoria
Label uppercase pequena acima do heading em cada slide.
```html
<span class="sans" style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:2px;color:{color};margin-bottom:16px;">{TAG TEXT}</span>
```
- Slides claros: color = BRAND_PRIMARY
- Slides escuros: color = BRAND_LIGHT
- Slides gradiente: color = `rgba(255,255,255,0.6)`

### Logo Lockup (primeiro e ultimo slides)
Icone da marca + nome exibidos juntos.
- Se logo fornecido: circulo 40px (BRAND_PRIMARY bg) com icone centralizado, nome ao lado
- Se iniciais: circulo 40px com primeira letra do nome em branco
- Nome: 13px, weight 600, letter-spacing 0.5px

### Pills de Strikethrough (slides de problema)
```html
<span style="font-size:11px;padding:5px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:#6B6560;text-decoration:line-through;">{Item antigo}</span>
```

### Tag Pills
```html
<span style="font-size:11px;padding:5px 12px;background:rgba(255,255,255,0.06);border-radius:20px;color:{BRAND_LIGHT};">{Label}</span>
```

### Caixa de Quote/Prompt
```html
<div style="padding:16px;background:rgba(0,0,0,0.15);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
  <p class="sans" style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;">{Label}</p>
  <p class="serif" style="font-size:15px;color:#fff;font-style:italic;line-height:1.4;">"{Texto da quote}"</p>
</div>
```

### Lista de Features
```html
<div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid {LIGHT_BORDER};">
  <span style="color:{BRAND_PRIMARY};font-size:15px;width:18px;text-align:center;">{icone}</span>
  <div>
    <span class="sans" style="font-size:14px;font-weight:600;color:{DARK_BG};">{Label}</span>
    <span class="sans" style="font-size:12px;color:#8A8580;">{Descricao}</span>
  </div>
</div>
```

### Steps Numerados
```html
<div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid {LIGHT_BORDER};">
  <span class="serif" style="font-size:26px;font-weight:300;color:{BRAND_PRIMARY};min-width:34px;line-height:1;">01</span>
  <div>
    <span class="sans" style="font-size:14px;font-weight:600;color:{DARK_BG};">{Titulo do step}</span>
    <span class="sans" style="font-size:12px;color:#8A8580;">{Descricao do step}</span>
  </div>
</div>
```

### Botao CTA (apenas slide final)
```html
<div style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:{LIGHT_BG};color:{BRAND_DARK};font-weight:600;font-size:14px;border-radius:28px;">
  {Texto do CTA}
</div>
```

## Regras de Layout

- Padding de conteudo: `0 36px` padrao
- Slides com progress bar: `0 36px 52px` pra nao sobrepor a barra
- Slides hero/CTA: `justify-content: center`
- Slides com muito conteudo: `justify-content: flex-end` (texto embaixo, espaco visual em cima)

## Principios de Design

1. Todo slide e exportavel como imagem, seta e progress bar fazem parte da imagem
2. Alternancia claro/escuro, ritmo visual que mantem atencao
3. Par heading + body font, display pra impacto, body pra legibilidade
4. Paleta derivada da marca, todas as cores vem de uma primaria
5. Revelacao progressiva, progress bar preenche e seta guia pra frente
6. Ultimo slide e especial, sem seta (sinaliza fim), progress bar 100%, CTA claro
7. Componentes consistentes, mesmo estilo de tag, lista e espacamento em todos os slides
8. Padding limpa UI, texto nunca sobrepoe progress bar ou seta
