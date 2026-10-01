import test from "node:test"
import assert from "node:assert/strict"
import { parseColors, parseFonts, parseCaption, themeFromMarkdown, DEFAULT_CAPTION } from "./_brand.mjs"

const md = `# Design System - Acme Ltda

| Nome | Hex | Uso |
|------|-----|-----|
| Background | #101820 | Fundo |
| Texto | #FFFFFF | Texto |
| Texto secundario | #AAAAAA | meta |
| Destaque 1 | #FF6600 | CTA |

| Tipo | Fonte | Uso |
|------|-------|-----|
| Primaria | Inter | corpo |
| Secundaria | Anton | titulo |

## Legenda de reel
- Estilo: palavra a palavra
- Cor do texto: #EEEEEE
- Cor de destaque da palavra falada: #FFD400
- Caixa: normal, peso: normal
- Posição: centro
- Fonte: Poppins
- Tamanho: 64 px
- Espaçamento entre letras: 0
- Espaçamento entre linhas: 1,3
- Linhas no máximo: 1
- Palavras por página: 3
- Contorno: #000000, 5

## Outra
- Estilo: nada
`

test("cores e fontes", () => {
  assert.equal(parseColors(md)["destaque 1"], "#FF6600")
  assert.equal(parseFonts(md).secundaria, "Anton")
})

test("legenda de reel lida do design-system", () => {
  assert.deepEqual(parseCaption(md), {
    ...DEFAULT_CAPTION,
    style: "word", color: "#EEEEEE", highlight: "#FFD400", uppercase: false, bold: false, position: "center",
    font: "Poppins", size: 64, letterSpacing: 0, lineHeight: 1.3, maxLines: 1, wordsPerPage: 3,
    outline: { color: "#000000", width: 5 },
  })
})

test("sem secao ou campo nao preenchido: fallback neutro", () => {
  assert.deepEqual(parseCaption("# x"), DEFAULT_CAPTION)
  const tpl = "## Legenda de reel\n- Estilo: [palavra a palavra / por frase]\n- Cor de destaque da palavra falada: sem destaque\n"
  assert.deepEqual(parseCaption(tpl), DEFAULT_CAPTION)
  const semLimite = "## Legenda de reel\n- Linhas no máximo: sem limite\n- Contorno: sem contorno\n- Tamanho: [px]\n"
  assert.deepEqual(parseCaption(semLimite), DEFAULT_CAPTION)
})

test("tema a partir do design-system", () => {
  const t = themeFromMarkdown("acme", md)
  assert.equal(t.accent, "#FF6600")
  assert.equal(t.fontDisplay, "Anton")
  assert.equal(t.name, "Acme Ltda")
})

test("fundo escuro sem cor de texto: texto reserva claro", () => {
  assert.equal(themeFromMarkdown("x", "| Background | #101010 | f |").textPrimary, "#FFFFFF")
  assert.equal(themeFromMarkdown("x", "| Background | #FFFFFF | f |").textPrimary, "#1A1A1A")
})
