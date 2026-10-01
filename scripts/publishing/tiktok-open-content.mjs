// Abre o TikTok Studio (Conteudo) na sessao logada pra ajustar a postagem (ex: visibilidade -> Todos)
import { chromium } from "playwright"
import { playwrightDir } from "../_lib/workspace-client.mjs"
const USER_DATA_DIR = playwrightDir("tiktok") // sessao logada desta marca
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, channel: "chrome", viewport: { width: 1280, height: 900 }, locale: "pt-BR",
  args: ["--disable-blink-features=AutomationControlled"],
})
const page = ctx.pages()[0] || await ctx.newPage()
await page.goto("https://www.tiktok.com/tiktokstudio/content", { waitUntil: "domcontentloaded" }).catch(() => {})
console.log(">>> TikTok Studio > Conteudo aberto.")
console.log(">>> Ache o video, abra (...) ou Editar -> 'Quem pode ver este video' -> TODOS/Publico -> Salvar.")
console.log(">>> Janela aberta por 5 min.")
await sleep(300000)
await ctx.close()
