#!/usr/bin/env node
/**
 * tiktok-edit-caption.mjs - edita a LEGENDA de um video JA publicado, sem apagar nada.
 * TikTok Studio > Publicacoes > icone "Editar" da linha do post (janela de 7 dias).
 *   node scripts/publishing/tiktok-edit-caption.mjs probe "<trecho da legenda atual>"
 *   node scripts/publishing/tiktok-edit-caption.mjs write "<trecho>" <arquivo-legenda.txt>
 * Usa a sessao logada desta marca (~/.playwright-tiktok-{slug}). Antes de gravar, mostre o texto
 * novo para a pessoa e espere o "pode".
 */
import { chromium } from "playwright"
import { readFileSync, mkdirSync } from "node:fs"
import { playwrightDir } from "../_lib/workspace-client.mjs"
mkdirSync("output", { recursive: true })

const [, , MODE, NEEDLE, CAPTION_FILE] = process.argv
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(playwrightDir("tiktok"), {
  headless: false, channel: "chrome", viewport: { width: 1500, height: 950 }, locale: "pt-BR",
  args: ["--disable-blink-features=AutomationControlled"],
})
const page = ctx.pages()[0] || await ctx.newPage()
await page.goto("https://www.tiktok.com/tiktokstudio/content?tab=post", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(e => console.log(e.message))
await sleep(7000)

const row = page.locator(`text=${NEEDLE}`).first()
await row.scrollIntoViewIfNeeded()
await sleep(1500)
const box = await row.boundingBox()
if (!box) { console.error("linha do post nao encontrada"); await ctx.close(); process.exit(1) }

// icone "Editar" = primeiro da coluna Acoes
const icons = await page.evaluate(({ y0, y1 }) => {
  const seen = new Set(), out = []
  document.querySelectorAll('div.css-1ptcs8c').forEach(e => {
    const r = e.getBoundingClientRect()
    if (r.top < y0 - 20 || r.bottom > y1 + 40 || r.left < 900) return
    const k = Math.round(r.x); if (seen.has(k)) return; seen.add(k)
    out.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })
  })
  return out.sort((a, b) => a.x - b.x)
}, { y0: box.y, y1: box.y + box.height })
console.log("icones da linha:", JSON.stringify(icons))
if (!icons.length) { console.error("icone Editar nao encontrado (o TikTok mudou a tela?). Edite manual no Studio."); await ctx.close(); process.exit(1) }
await page.mouse.click(icons[0].x, icons[0].y)
await sleep(6000)
console.log("URL apos Editar:", page.url())
await page.screenshot({ path: "output/tiktok-edit-page.png", fullPage: true })

const dump = async (tag) => {
  const d = await page.evaluate(() => ({
    editables: [...document.querySelectorAll('[contenteditable="true"]')].map(e => (e.innerText || '').slice(0, 500)),
    textareas: [...document.querySelectorAll('textarea')].map(t => t.value?.slice(0, 500)),
    buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 25),
    body: document.body.innerText.slice(0, 1200),
  }))
  console.log(`--- ${tag} ---`); console.log(JSON.stringify(d, null, 1))
}
await dump("estado da pagina de edicao")

if (MODE === "probe") { console.log(">>> PROBE, janela 90s"); await sleep(90000); await ctx.close(); process.exit(0) }

const raw = readFileSync(CAPTION_FILE, "utf8").replace(/\r\n/g, "\n")
const caption = raw.split(/\n-{3,}\n/)[0].trim()
const field = page.locator('div[contenteditable="true"], .public-DraftEditor-content').first()
for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape").catch(() => {}); await sleep(300) }
await field.click({ timeout: 10000, force: true })
await page.keyboard.press("Control+A")
await page.keyboard.press("Delete")
await sleep(800)
await page.keyboard.type(caption, { delay: 8 }) // mesmo metodo do upload-tiktok.mjs (dispara deteccao de hashtag)
await sleep(2000)
await page.screenshot({ path: "output/tiktok-edit-typed.png", fullPage: true })
await dump("depois de digitar")
const save = page.locator('button:has-text("Salvar")').first()
if (await save.count() === 0) { console.error("botao Salvar nao encontrado"); await sleep(60000); await ctx.close(); process.exit(3) }
await save.click()
await sleep(8000)
await page.screenshot({ path: "output/tiktok-edit-saved.png", fullPage: true })
console.log("URL apos salvar:", page.url())
await dump("depois de salvar")
await sleep(30000)
await ctx.close()
