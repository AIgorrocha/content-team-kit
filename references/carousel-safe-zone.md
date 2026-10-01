# Zona Segura: Carrossel Instagram 1080x1350px

Margens obrigatórias para TODOS os carrosséis, independente do cliente.
Textos, imagens, logos e CTAs devem respeitar essas distâncias.

## Margens (em pixels)

| Direção | Distância Mínima | Observação |
|---------|-----------------|------------|
| Esquerda | 80px | Margem lateral padrão do kit (mínimo absoluto da plataforma: 65px) |
| Direita | 80px | Equivalente à esquerda |
| Topo | 150px | Protege de sobreposições no feed |
| Base | 175px | Evita botões e UI inferior |

## Zona Útil

- Largura útil: **920px** (1080 - 80 - 80)
- Altura útil: **1025px** (1350 - 150 - 175)
- Área total segura: **920 x 1025px** centralizada

A marca pode AUMENTAR essas margens no `design-system.md`, nunca diminuir. Este arquivo é a única fonte das margens do carrossel: o design system da marca e o gerador (`skills/ct-carrossel-gen`) usam estes mesmos números (80 / 150 / 175).

## Regras

1. **Textos**: NUNCA posicionar fora da zona segura
2. **Imagens**: Também devem respeitar as margens (não full-bleed)
3. **Fonte mínima**: 24-30px para legibilidade em mobile
4. **Contraste**: Alto contraste obrigatório entre texto e fundo
5. **Progress bar**: Pode ficar fora da zona segura (é UI, não conteúdo)
6. **Seta de swipe**: Pode ficar fora da zona segura (borda direita)

## Implementação (CSS)

```css
/* Zona segura para conteúdo */
.safe-zone {
  position: absolute;
  top: 150px;
  bottom: 175px;
  left: 80px;
  right: 80px;
}

/* Imagem dentro da zona segura */
.image-safe {
  position: absolute;
  top: 150px;
  left: 80px;
  right: 80px;
  /* height conforme necessário */
}

/* Texto na parte inferior da zona segura */
.text-bottom {
  position: absolute;
  bottom: 175px;
  left: 80px;
  right: 80px;
}
```

## Teste

Sempre visualizar no app Instagram em diferentes dispositivos antes de publicar.

---

# Capa de reel 9:16 (1080x1920), TEMPLATE PADRAO

Layout padrao (capa-v9). Reusar em TODA capa de reel: muda so o texto e o frame de fundo, mantem a estrutura e os tamanhos de fonte. Objetivo: parar de errar safe zone e legibilidade.

## Zona segura (UI de IG + TikTok sobrepoe)

Canvas 1080x1920. Todo o texto vive na ZONA CENTRAL SEGURA. Bounding box da UNIAO de todos os elementos de texto DEVE satisfazer:

| Limite | Valor | Motivo |
|--------|-------|--------|
| Topo | y >= 230 | Barra superior do app (~12%) |
| Base | y <= 1650 | Faixa de legenda/username (~14% de baixo) |
| Esquerda | x >= 108 | Margem lateral 10%; recorte no grid |
| Direita | x <= 972 | Margem lateral 10% mais coluna de icones de acao (x>=930 de ~y900 pra baixo) |

Alvo ideal do bloco: miolo vertical entre **y680 e y1350**. Na v9 o bloco medido ficou em y880..y1385.
`top` do bloco: **880px**. Chao absoluto: **1280px** (comece-por-aqui). `top > 1280` e erro
(texto em y1460 ja foi reprovado: fora do padrao das outras capas).

## Estrutura visual (de cima pra baixo)

1. **Frame** de fundo (screenshot do talento), object-fit cover, full canvas.
2. **Scrim** escuro translucido comecando ABAIXO dos olhos (top ~y800), pico de opacidade rgba(13,13,13,0.82). Escurece o miolo pra leitura SEM cobrir os olhos (y~720-770). Rosto continua visivel por transparencia.
3. **Botcover** na faixa de baixo (top ~y1600) cobrindo a legenda queimada do video (scrim que vira #0D0D0D solido no rodape).
4. **Bloco de texto** centrado (text-align center), 4 elementos: kicker, headline, divisor, subhead.

## Tamanhos de fonte de referencia (v9, legivel no feed)

Fonte: `'Inter','Segoe UI',Arial,sans-serif`. Accent: ler `clients/{slug}/design-system.md` do cliente ativo.

| Elemento | Tamanho | Peso | Detalhe |
|----------|---------|------|---------|
| kicker (ex: "NOVIDADE DA SEMANA") | **42px** | 800 | letter-spacing 8px, uppercase, cor accent do cliente |
| headline (ex: "NOME DO TEMA") | **160px** | 900 | line-height 0.95, letter-spacing -4px, uppercase, branco |
| divisor | 160px larg x 8px alt | | cor accent do cliente, border-radius 4, margin-top 28 |
| subhead (ex: "Frase de apoio...") | **58px** | 700 | line-height 1.22, branco; palavra-chave em `.hl` cor accent |

Bloco: `left:120px; right:120px; top:880px`. Todo texto com `text-shadow` escuro pra contraste contra o scrim.

> Estes tamanhos sao ~20% maiores que a versao anterior (v8): fonte maior deixa a capa mais visivel no feed. Ao reusar, NAO reduzir abaixo destes valores sem motivo; se o texto crescer e encostar na coluna de icones (x>=930) ou na faixa de baixo, quebrar linha diferente antes de diminuir fonte.

## Template tokenizado

Arquivo base: `content/{slug}/reels/{nome}/capa-v9.html` (ver `clients/{slug}/design-system.md`). Para nova capa, copiar esse HTML e trocar: `src` do frame, texto do kicker/title/sub, e a palavra em `.hl`.

## Checagem OBRIGATORIA antes de entregar (nao pular)

1. **Medir bbox** via Playwright (`$$eval` getBoundingClientRect, uniao dos elementos `.kicker,.title,.divider,.sub`). Confirmar topo>=230, base<=1650, horizontal 108..972.
2. **Debug visual** desenhando as faixas de UI (topo, legenda inferior, coluna de icones direita, margens 108px, linhas verdes da zona 230..1650) sobre a capa. Conferir que nenhum texto cai atras delas.
3. Rosto visivel. **Olhos, nariz, boca e barba NAO cobertos** (regra dura). Texto so com sombra na letra. Sem metade preta solida.

So entregar o PNG (1080x1920) se passar. Reel ja publicado: entregar a capa pro usuario aplicar manual (nao trocar via API).
