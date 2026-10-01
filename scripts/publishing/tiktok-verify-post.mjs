#!/usr/bin/env node
/**
 * tiktok-verify-post.mjs - Confere um video JA publicado no TikTok: legenda e privacidade no
 * TikTok Studio (fonte da verdade) e, se voce passar --handle, a pagina publica.
 *   node scripts/publishing/tiktok-verify-post.mjs <videoId> [--handle conta-sem-arroba]
 * Usa a sessao logada desta marca (~/.playwright-tiktok-{slug}). Nao altera nada.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { playwrightDir } from "../_lib/workspace-client.mjs"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const args = process.argv.slice(2)
const ID = args.find((a) => /^\d+$/.test(a))
const hIdx = args.indexOf("--handle")
const HANDLE = hIdx >= 0 ? String(args[hIdx + 1] || "").replace(/^@/, "") : ""
if (!ID) { console.error("Uso: node scripts/publishing/tiktok-verify-post.mjs <videoId> [--handle conta]"); process.exit(1) }
mkdirSync("output", { recursive: true })

const ctx = await chromium.launchPersistentContext(playwrightDir("tiktok"), {
  headless: false, channel: "chrome", viewport: { width: 1500, height: 950 }, locale: "pt-BR",
  args: ["--disable-blink-features=AutomationControlled"],
})
const page = ctx.pages()[0] || await ctx.newPage()
// 1) fonte da verdade no Studio (legenda + privacidade)
await page.goto(`https://www.tiktok.com/tiktokstudio/upload/post/${ID}?from=creator_center`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => console.log(e.message))
await sleep(7000)
const studio = await page.evaluate(() => {
  const ed = document.querySelector('[contenteditable="true"]')
  const m = document.body.innerText.match(/Quem pode ver esta publicação\s*\n\s*([^\n]+)/)
  return { legenda: ed ? ed.innerText : null, privacidade: m ? m[1].trim() : null }
})
console.log("=== STUDIO ===")
console.log("privacidade:", studio.privacidade)
console.log(studio.legenda)
// 2) pagina publica (so com --handle: a URL publica precisa do nome da conta)
if (HANDLE) {
  await page.goto(`https://www.tiktok.com/@${HANDLE}/video/${ID}`, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => console.log(e.message))
  await sleep(8000)
  await page.screenshot({ path: `output/tiktok-public-${ID}.png` })
  const pub = await page.evaluate(() => ({ og: document.querySelector('meta[property="og:description"]')?.content, titleTag: document.title }))
  console.log("=== PUBLICO ===")
  console.log(JSON.stringify(pub, null, 1))
} else {
  console.log("(sem --handle: pulei a pagina publica)")
}
await ctx.close()
