// Tema white-label da Sala de Comando: lê `clients/{slug}/design-tokens.css` do CLIENTE
// ATIVO desta pasta (resolvido por `scripts/_lib/workspace-client.mjs`, nunca
// hardcoded) e converte HEX/RGB pros nomes de variável que `SalaTema` injeta em :root
// enquanto a Sala está montada. Se o cliente ativo mudar (ex. pra acme), a próxima
// renderização da Sala já sai com as cores do cliente novo.
//
// Duas famílias de variável são geradas a partir do MESMO design-tokens.css:
// - HSL (--background, --card, --primary...): usadas pelo shadcn/Radix e por `hsl(var(--x))`
//   inline em alguns componentes (ex. NoPeca.tsx).
// - RGB "R G B" (--ct-bg, --ct-surface...): usadas pelas classes Tailwind com opacidade
//   (bg-accent/10 etc, ver tailwind.config.ts), no formato rgb(var(--x) / <alpha-value>).
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { resolverClienteAtivo as resolverClienteAtivoCompartilhado } from "./fontes/cliente"

export interface TemaSala {
  "--background": string
  "--card": string
  "--primary": string
  "--accent": string
  "--foreground": string
  "--muted-foreground": string
  "--border": string
  "--ct-bg": string
  "--ct-surface": string
  "--ct-surface-hover": string
  "--ct-border": string
  "--ct-text-primary": string
  "--ct-text-secondary": string
  "--ct-accent": string
  "--ct-accent-hover": string
  "--ct-success": string
  "--ct-error": string
  "--ct-warning": string
  "--ct-font-sans": string
}

// Fallback: paleta neutra definida em src/app/globals.css, usada se o cliente ativo não
// puder ser resolvido ou não tiver design-tokens.css.
const TEMA_PADRAO: TemaSala = {
  "--background": "0 0% 5%",
  "--card": "0 0% 10%",
  "--primary": "214 58% 57%",
  "--accent": "214 58% 57%",
  "--foreground": "0 0% 100%",
  "--muted-foreground": "0 0% 63%",
  "--border": "0 0% 16%",
  "--ct-bg": "13 13 13",
  "--ct-surface": "26 26 26",
  "--ct-surface-hover": "37 37 37",
  "--ct-border": "42 42 42",
  "--ct-text-primary": "255 255 255",
  "--ct-text-secondary": "160 160 160",
  "--ct-accent": "74 144 217",
  "--ct-accent-hover": "91 160 233",
  "--ct-success": "16 185 129",
  "--ct-error": "239 68 68",
  "--ct-warning": "245 158 11",
  "--ct-font-sans": "'Inter', system-ui, sans-serif",
}

function rgbParaHsl(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function hexParaRgbTupla(hex: string): [number, number, number] | null {
  const limpo = hex.replace("#", "").trim()
  if (limpo.length !== 3 && limpo.length !== 6 && limpo.length !== 8) return null
  const full = limpo.length === 3 ? limpo.split("").map((c) => c + c).join("") : limpo
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return [r, g, b]
}

// hsl(h, s%, l%) -> [r,g,b] 0-255. Inverso de rgbParaHsl, só pra permitir compositar
// tokens hsla(...) com alfa (ver corParaTupla).
function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hk = h / 360
  const conv = (t0: number) => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [
    Math.round(conv(hk + 1 / 3) * 255),
    Math.round(conv(hk) * 255),
    Math.round(conv(hk - 1 / 3) * 255),
  ]
}

// Correção (Tarefa 16, regressão de alfa): converte hex(3/6/8), rgb(a)(...) e hsl(a)(...)
// pra [r,g,b,alfa] (alfa 0-1, 1 se o formato não carregar canal). `color-mix(...)` não é
// parseável aqui e continua caindo no fallback do chamador (ver obterTema: accent-hover
// cai no valor do próprio accent quando não parseia).
function corParaTupla(valor: string): [number, number, number, number] | null {
  const v = valor.trim()
  if (v.startsWith("#")) {
    const limpo = v.replace("#", "")
    const tupla = hexParaRgbTupla(v)
    if (!tupla) return null
    const alfa = limpo.length === 8 ? parseInt(limpo.slice(6, 8), 16) / 255 : 1
    return [...tupla, alfa]
  }
  const mRgb = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (mRgb) return [Number(mRgb[1]), Number(mRgb[2]), Number(mRgb[3]), mRgb[4] !== undefined ? Number(mRgb[4]) : 1]
  const mHsl = v.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (mHsl) {
    const [r, g, b] = hslParaRgb(Number(mHsl[1]), Number(mHsl[2]) / 100, Number(mHsl[3]) / 100)
    return [r, g, b, mHsl[4] !== undefined ? Number(mHsl[4]) : 1]
  }
  return null
}

// Compõe uma cor com alfa < 1 sobre um fundo opaco (ex.: --border: rgba(255,255,255,0.08)
// sobre --bg #0D0D0D -> ~32,32,32), pra nunca emitir um --ct-* opaco com o alfa
// descartado (bug real: bordas saíam brancas opacas em vez de cinza sutil).
function compositarSobreFundo(tupla: [number, number, number, number], fundo: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = tupla
  if (a >= 1) return [r, g, b]
  return [
    Math.round(r * a + fundo[0] * (1 - a)),
    Math.round(g * a + fundo[1] * (1 - a)),
    Math.round(b * a + fundo[2] * (1 - a)),
  ]
}

function corParaHsl(valor: string, fundo: [number, number, number]): string | null {
  const tupla = corParaTupla(valor)
  if (!tupla) return null
  const [r, g, b] = compositarSobreFundo(tupla, fundo)
  return rgbParaHsl(r / 255, g / 255, b / 255)
}

// Exportado só pro smoke test de scripts/sala/check-tema.ts (compositar alfa sobre fundo).
export function corParaRgb(valor: string, fundo: [number, number, number]): string | null {
  const tupla = corParaTupla(valor)
  if (!tupla) return null
  return compositarSobreFundo(tupla, fundo).join(" ")
}

function extrairVar(css: string, nome: string): string | null {
  const re = new RegExp(`--${nome}:\\s*([^;]+);`)
  return css.match(re)?.[1]?.trim() ?? null
}

// Resolve o slug do cliente ativo pela mesma fonte única do resto da Sala (Batelada B3):
// cookie sala_cliente > .workspace/CT_CLIENT (ver src/lib/sala/fontes/cliente.ts). Nunca
// hardcoded pra um cliente específico: se a resolução falhar (Kit exportado sem clients/,
// ou .workspace ausente/inválido), devolve null e obterTema cai pro TEMA_PADRAO (defaults
// de globals.css), nunca mais pro cliente do dono do kit como acontecia antes desta tarefa.
// `root` só importa pra montar o caminho do design-tokens.css abaixo: a resolução do
// cliente em si sempre usa process.cwd() (mesmo valor do único chamador real, SalaTema.tsx).
async function resolverClienteAtivo(): Promise<string | null> {
  try {
    return await resolverClienteAtivoCompartilhado()
  } catch {
    return null
  }
}

export async function obterTema(root: string = process.cwd()): Promise<TemaSala> {
  const slug = await resolverClienteAtivo()
  if (!slug) return TEMA_PADRAO
  const caminho = join(root, "clients", slug, "design-tokens.css")
  if (!existsSync(caminho)) return TEMA_PADRAO
  const css = readFileSync(caminho, "utf-8")

  const bg = extrairVar(css, "bg")
  const surface = extrairVar(css, "surface")
  const surfaceWarm = extrairVar(css, "surface-warm")
  const accent = extrairVar(css, "accent")
  const accentHover = extrairVar(css, "accent-hover")
  const textoPrimario = extrairVar(css, "text-primary")
  const textoMuted = extrairVar(css, "text-muted")
  const border = extrairVar(css, "border")
  const fontBody = extrairVar(css, "font-body")
  const success = extrairVar(css, "success")
  const warn = extrairVar(css, "warn")
  const danger = extrairVar(css, "danger")

  // Fundo pra compositar tokens com alfa (--border etc): --bg do próprio cliente, com
  // fallback pro --ct-bg do TEMA_PADRAO se --bg não parsear. --surface-warm (hover)
  // compõe sobre --surface, por ficar em cima da superfície, não do fundo da página.
  const bgTupla = bg && corParaTupla(bg)
  const bgRgb: [number, number, number] = bgTupla
    ? [bgTupla[0], bgTupla[1], bgTupla[2]]
    : (TEMA_PADRAO["--ct-bg"].split(" ").map(Number) as [number, number, number])
  const surfaceTupla = surface && corParaTupla(surface)
  const surfaceRgb: [number, number, number] = surfaceTupla
    ? [surfaceTupla[0], surfaceTupla[1], surfaceTupla[2]]
    : (TEMA_PADRAO["--ct-surface"].split(" ").map(Number) as [number, number, number])

  const rgbAccent = accent && corParaRgb(accent, bgRgb)

  return {
    "--background": (bg && corParaHsl(bg, bgRgb)) ?? TEMA_PADRAO["--background"],
    "--card": (surface && corParaHsl(surface, bgRgb)) ?? TEMA_PADRAO["--card"],
    "--primary": (accent && corParaHsl(accent, bgRgb)) ?? TEMA_PADRAO["--primary"],
    "--accent": (accent && corParaHsl(accent, bgRgb)) ?? TEMA_PADRAO["--accent"],
    "--foreground": (textoPrimario && corParaHsl(textoPrimario, bgRgb)) ?? TEMA_PADRAO["--foreground"],
    "--muted-foreground": (textoMuted && corParaHsl(textoMuted, bgRgb)) ?? TEMA_PADRAO["--muted-foreground"],
    "--border": (border && corParaHsl(border, bgRgb)) ?? TEMA_PADRAO["--border"],
    "--ct-bg": (bg && corParaRgb(bg, bgRgb)) ?? TEMA_PADRAO["--ct-bg"],
    "--ct-surface": (surface && corParaRgb(surface, bgRgb)) ?? TEMA_PADRAO["--ct-surface"],
    "--ct-surface-hover": (surfaceWarm && corParaRgb(surfaceWarm, surfaceRgb)) ?? TEMA_PADRAO["--ct-surface-hover"],
    "--ct-border": (border && corParaRgb(border, bgRgb)) ?? TEMA_PADRAO["--ct-border"],
    "--ct-text-primary": (textoPrimario && corParaRgb(textoPrimario, bgRgb)) ?? TEMA_PADRAO["--ct-text-primary"],
    "--ct-text-secondary": (textoMuted && corParaRgb(textoMuted, bgRgb)) ?? TEMA_PADRAO["--ct-text-secondary"],
    "--ct-accent": rgbAccent ?? TEMA_PADRAO["--ct-accent"],
    "--ct-accent-hover": (accentHover && corParaRgb(accentHover, bgRgb)) ?? rgbAccent ?? TEMA_PADRAO["--ct-accent-hover"],
    "--ct-success": (success && corParaRgb(success, bgRgb)) ?? TEMA_PADRAO["--ct-success"],
    "--ct-error": (danger && corParaRgb(danger, bgRgb)) ?? TEMA_PADRAO["--ct-error"],
    "--ct-warning": (warn && corParaRgb(warn, bgRgb)) ?? TEMA_PADRAO["--ct-warning"],
    "--ct-font-sans": fontBody ?? TEMA_PADRAO["--ct-font-sans"],
  }
}
