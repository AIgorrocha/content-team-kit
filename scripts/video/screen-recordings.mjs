#!/usr/bin/env node
/**
 * screen-recordings.mjs - gera telas 9:16 (1080x1920, PNG) de demonstracao na identidade da marca.
 *
 * Uso:
 *   node scripts/video/screen-recordings.mjs <telas.json> [--client slug] [--out output/screens]
 *
 * As cores vem de clients/{slug}/design-system.md (marca ativa do .workspace se nao passar
 * --client). O TEXTO vem do arquivo telas.json: nada de texto fixo aqui. Exemplo pronto:
 * scripts/video/telas-exemplo.json. Numero e nome de demonstracao devem ser marcados como
 * exemplo; em peca real, so dado verdadeiro com fonte na mao.
 *
 * Tipos de tela (campo "type" de cada item):
 *   lista   : titulo + cartoes (items: [{title, text, tag}])
 *   campos  : titulo + cartao de pares rotulo/valor (fields: [{label, value, highlight}])
 *   numeros : titulo + grade de numeros grandes (stats: [{value, label}])
 *   cta     : frase de chamada + botao (title, subtitle, button, note). Em "title", **assim** vira destaque.
 */
import './_env.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { resolveClient } from '../_lib/workspace-client.mjs'
import { brandFor } from './_brand.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const flag = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }

export function screenHtml(screen, b) {
  const css = `*{margin:0;padding:0;box-sizing:border-box}
body{background:${b.bg};color:${b.text};font-family:'Segoe UI',Arial,sans-serif;padding:40px;min-height:100vh}
.head{text-align:center;margin:60px 0 40px}.head h1{font-size:38px}.head p{color:${b.accent};font-size:22px;margin-top:10px}
.card{background:${b.surface};border-radius:16px;padding:26px 30px;margin-bottom:18px;border-left:4px solid ${b.accent}}
.card .t{font-size:24px;font-weight:600}.card .x{color:${b.textSecondary};font-size:18px;margin-top:8px}
.tag{display:inline-block;margin-top:10px;padding:5px 14px;border-radius:8px;font-size:15px;background:${b.accent2}33;color:${b.accent2}}
.field{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid ${b.textSecondary}55;font-size:20px}
.field:last-child{border-bottom:none}.field .l{color:${b.textSecondary}}.field .v{font-weight:600}.field .v.hl{color:${b.accent}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.stat{background:${b.surface};border-radius:16px;padding:30px;text-align:center}
.stat .n{font-size:54px;font-weight:700;color:${b.accent}}.stat .l{color:${b.textSecondary};font-size:18px;margin-top:8px}
.cta{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:90vh;text-align:center}
.cta h1{font-size:52px;line-height:1.3;margin-bottom:28px}.cta h1 b{color:${b.accent}}.cta p{color:${b.textSecondary};font-size:24px;margin-bottom:46px}
.btn{background:${b.accent};color:${b.bg};border-radius:20px;padding:28px 54px;font-size:38px;font-weight:700}.note{margin-top:14px;font-size:20px;color:${b.textSecondary}}`
  let body = ''
  if (screen.type === 'cta') {
    const title = esc(screen.title).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    body = `<div class="cta"><h1>${title}</h1><p>${esc(screen.subtitle)}</p><div class="btn">${esc(screen.button)}</div><div class="note">${esc(screen.note)}</div></div>`
  } else {
    body = `<div class="head"><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p></div>`
    if (screen.type === 'lista') {
      body += (screen.items || []).map((i) => `<div class="card"><div class="t">${esc(i.title)}</div><div class="x">${esc(i.text)}</div>${i.tag ? `<span class="tag">${esc(i.tag)}</span>` : ''}</div>`).join('')
    } else if (screen.type === 'campos') {
      body += `<div class="card">${(screen.fields || []).map((f) => `<div class="field"><span class="l">${esc(f.label)}</span><span class="v${f.highlight ? ' hl' : ''}">${esc(f.value)}</span></div>`).join('')}</div>`
    } else if (screen.type === 'numeros') {
      body += `<div class="grid">${(screen.stats || []).map((s) => `<div class="stat"><div class="n">${esc(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join('')}</div>`
    } else {
      throw new Error(`tipo de tela desconhecido: ${screen.type} (use lista, campos, numeros ou cta)`)
    }
  }
  return `<html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
}

async function main() {
  const specPath = process.argv[2]
  if (!specPath || specPath.startsWith('--')) {
    console.error('uso: node scripts/video/screen-recordings.mjs <telas.json> [--client slug] [--out pasta]')
    process.exit(1)
  }
  const screens = JSON.parse(readFileSync(resolve(ROOT, specPath), 'utf8'))
  const slug = flag('--client') || resolveClient()
  const brand = brandFor(slug)
  const outDir = resolve(ROOT, flag('--out') || 'output/screens')
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  for (const s of screens) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
    await page.setContent(screenHtml(s, brand))
    await page.screenshot({ path: join(outDir, `${s.name}.png`) })
    await page.close()
    console.log(`ok ${s.name}`)
  }
  await browser.close()
  console.log(`\n${screens.length} tela(s) em ${outDir} (cores da marca ${slug})`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
