// Le a identidade da marca em clients/{slug}/design-system.md:
//  - tabela de cores e de fontes  -> tema do Remotion e cores das telas
//  - secao "Legenda de reel"      -> estilo da legenda queimada
// Tudo com fallback neutro quando a marca ainda nao preencheu.
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const norm = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/

const num = (v) => { const m = v.match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(",", ".")) : undefined }

export const DEFAULT_CAPTION = {
  style: "phrase", // "phrase" = pagina inteira de uma vez | "word" = palavra a palavra
  color: "#FFFFFF",
  highlight: null, // cor da palavra falada, ou null = sem destaque
  uppercase: true,
  bold: true,
  position: "bottom", // "bottom" (terco inferior) | "center"
  font: "Inter", // nome no Google Fonts
  size: null, // px; null = padrao da composicao
  letterSpacing: -1, // px
  lineHeight: 1.15, // multiplicador
  maxLines: null, // null = sem limite
  wordsPerPage: 4, // palavras por pagina de legenda (build-captions.mjs)
  outline: null, // { color, width } (px visiveis) ou null = sem contorno
}

// Linhas de tabela "| Nome | #hex | uso |" -> { "background": "#000000", ... }
export function parseColors(md) {
  const out = {}
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue
    const cells = line.split("|").map((c) => c.trim())
    const hex = cells.slice(1).find((c) => HEX.test(c))
    if (cells[1] && hex) out[norm(cells[1])] = hex.match(HEX)[0]
  }
  return out
}

// Linhas "| Primaria | Inter | uso |" da tabela de fontes.
export function parseFonts(md) {
  const out = {}
  for (const line of md.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue
    const cells = line.split("|").map((c) => c.trim())
    const k = norm(cells[1] || "")
    if ((k === "primaria" || k === "secundaria") && cells[2] && !cells[2].includes("[")) {
      out[k] = cells[2]
    }
  }
  return out
}

// Secao "## Legenda de reel": linhas "- Rotulo: valor". Valor ainda entre [colchetes] = nao preenchido.
export function parseCaption(md) {
  const cap = { ...DEFAULT_CAPTION }
  const m = md.match(/^##\s*Legenda de reel\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)
  if (!m) return cap
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.match(/^\s*[-*]\s*([^:]+):\s*(.*)$/)
    if (!line) continue
    const label = norm(line[1])
    const value = line[2].trim()
    if (!value || value.startsWith("[")) continue
    const nv = norm(value)
    if (label === "estilo") cap.style = /palavra/.test(nv) ? "word" : "phrase"
    else if (label === "cor do texto") cap.color = (value.match(HEX) || [cap.color])[0]
    else if (label.startsWith("cor de destaque")) {
      cap.highlight = /sem destaque/.test(nv) ? null : (value.match(HEX) || [null])[0]
    } else if (label === "caixa") {
      const caixa = nv.split(",")[0]
      if (/maiuscul/.test(caixa)) cap.uppercase = true
      else if (/normal/.test(caixa)) cap.uppercase = false
      const peso = nv.match(/peso:\s*(\w+)/)
      if (peso) cap.bold = peso[1] !== "normal"
    } else if (label === "posicao") cap.position = /centro/.test(nv) ? "center" : "bottom"
    else if (label === "fonte") cap.font = value
    else if (label === "tamanho") cap.size = num(value) ?? cap.size
    else if (label === "espacamento entre letras") cap.letterSpacing = num(value) ?? cap.letterSpacing
    else if (label === "espacamento entre linhas") cap.lineHeight = num(value) ?? cap.lineHeight
    else if (label === "linhas no maximo") cap.maxLines = /sem limite/.test(nv) ? null : num(value) ?? cap.maxLines
    else if (label === "palavras por pagina") cap.wordsPerPage = num(value) || cap.wordsPerPage
    else if (label === "contorno") {
      const color = (value.match(HEX) || [])[0]
      if (/sem contorno/.test(nv)) cap.outline = null
      else if (color) cap.outline = { color, width: num(value.replace(HEX, "")) ?? 4 }
    }
  }
  return cap
}

// Tema do Remotion (mesmo formato de remotion/src/themes.ts) a partir do design-system.
const isDark = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 128;
};

export function themeFromMarkdown(slug, md) {
  const c = parseColors(md)
  const dark = c["background"] ? isDark(c["background"]) : false // texto reserva legivel sobre o fundo
  const f = parseFonts(md)
  const name = (md.match(/^#\s*Design System\s*[-:]\s*(.+)$/im) || [, ""])[1].replace(/[[\]]/g, "").trim()
  return {
    slug,
    bg: c["background"] || "#FFFFFF",
    surface: c["surface"] || c["background"] || "#F4F6F8",
    textPrimary: c["texto"] || (dark ? "#FFFFFF" : "#1A1A1A"),
    textSecondary: c["texto secundario"] || (dark ? "#CCCCCC" : "#444444"),
    textMuted: c["texto secundario"] || (dark ? "#AAAAAA" : "#666666"),
    textMeta: c["texto secundario"] || (dark ? "#999999" : "#888888"),
    accent: c["destaque 1"] || "#0066FF",
    fontDisplay: f["secundaria"] || "Inter",
    fontBody: f["primaria"] || "Inter",
    name,
    handle: "",
    photo: null,
    check: false,
  }
}

export function brandFor(slug, root = ROOT) {
  const file = join(root, "clients", slug, "design-system.md")
  const md = existsSync(file) ? readFileSync(file, "utf8") : ""
  const colors = parseColors(md)
  return {
    slug,
    hasDesignSystem: !!md,
    bg: colors["background"] || "#0D0D0D",
    surface: colors["surface"] || "#1A1A1A",
    text: colors["texto"] || "#FFFFFF",
    textSecondary: colors["texto secundario"] || "#A0A0A0",
    accent: colors["destaque 1"] || "#4A90D9",
    accent2: colors["destaque 2"] || colors["destaque 1"] || "#7C3AED",
    caption: parseCaption(md),
    theme: themeFromMarkdown(slug, md),
  }
}

// Grava o tema da marca em remotion/src/themes.generated.json (lido por themes.ts).
export function writeThemeFile(slug, root = ROOT) {
  const file = join(root, "remotion/src/themes.generated.json")
  const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
  current[slug] = brandFor(slug, root).theme
  writeFileSync(file, JSON.stringify(current, null, 2) + "\n")
  return file
}
