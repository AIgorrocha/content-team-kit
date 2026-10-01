// Login dedicado na sessao do bot/recorder (.playwright-ig-bot, Chrome do sistema)
// Abre IG, espera voce logar, salva sessao e fecha. Poll manual (5 min).
import { chromium } from "playwright"
import { resolve } from "node:path"
const USER_DIR = resolve(process.env.USERPROFILE || process.env.HOME, ".playwright-ig-bot")
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const ctx = await chromium.launchPersistentContext(USER_DIR, {
  headless: false, channel: "chrome", viewport: { width: 1280, height: 900 }, locale: "pt-BR",
  args: ["--disable-blink-features=AutomationControlled"],
})
const page = ctx.pages()[0] || await ctx.newPage()
await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" }).catch(() => {})
console.log("\n>>> FACA LOGIN no Instagram nessa janela. Detecto sozinho (ate 5 min)...")

let logged = false
for (let i = 0; i < 100; i++) { // 100 * 3s = 5 min
  // auto-clica "Continuar como @handle-do-cliente" (account picker) se aparecer
  for (const rx of [/Continuar como/i, /^Continuar$/i]) {
    try { await page.getByRole("button", { name: rx }).first().click({ timeout: 1500 }); console.log("Clicou:", rx); await sleep(2500) } catch {}
  }
  logged = await page.evaluate(() => {
    const q = (s) => !!document.querySelector(s)
    const home = q('a[href="/direct/inbox/"]') || q('a[href="/explore/"]')
      || q('svg[aria-label="Página inicial"]') || q('svg[aria-label="Nova publicação"]')
      || q('svg[aria-label="Mensagens"]')
    const onLogin = /accounts\/login/.test(location.href) || q('input[name="password"]')
    const picker = /Continuar como|Usar outro perfil/.test(document.body.innerText || "")
    return home && !onLogin && !picker
  }).catch(() => false)
  if (logged) break
  await sleep(3000)
}

if (logged) {
  console.log("LOGADO! Sessao salva em", USER_DIR)
  await sleep(1500)
  await ctx.close()
  process.exit(0)
} else {
  console.log("Nao detectei login em 5 min. Deixe a janela aberta e rode de novo, ou avise.")
  await ctx.close()
  process.exit(2)
}
