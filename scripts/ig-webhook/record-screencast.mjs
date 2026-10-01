// Grava o screencast do App Review da Meta (comentou a palavra -> resposta -> DM com o link).
// Playwright recordVideo. Reusa sessao logada (userDataDir). 1a vez: loga manual.
// Saida: webm -> converte pra mp4 com ffmpeg (precisa do ffmpeg instalado).
// Precisa de: npm i playwright (ou o que ja vem no kit) e das variaveis abaixo no .env.local:
//   IG_HANDLE        @ da conta profissional (sem o @)
//   IG_APP_ID        ID do app Instagram (painel da Meta)
//   PUBLIC_BASE      endereco publico do servidor (o redirect do login e PUBLIC_BASE/auth/callback)
//   IG_REEL_URL      link de um post real da conta que pede a palavra
//   IG_FOLLOWER_URL  perfil de uma conta de teste que comentou e recebeu o link
//   IG_KEYWORD       palavra usada no post (padrao: GUIA)
// Uso: node --env-file=.env.local scripts/ig-webhook/record-screencast.mjs
import { chromium } from "playwright"
import { resolve } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs"
const execFileP = promisify(execFile)

const USER_DIR = resolve(process.env.USERPROFILE || process.env.HOME, ".playwright-ig-bot")
const OUT_DIR = resolve("./output/screencast")
const REEL = process.env.IG_REEL_URL
const PROFILE = process.env.IG_FOLLOWER_URL // conta de teste que recebeu o link
const IG_HANDLE = process.env.IG_HANDLE
const KEYWORD = (process.env.IG_KEYWORD || "GUIA").toUpperCase()
const faltando = ["IG_HANDLE", "IG_APP_ID", "PUBLIC_BASE", "IG_REEL_URL", "IG_FOLLOWER_URL"].filter(k => !process.env[k])
if (faltando.length) { console.error("Faltam no .env.local: " + faltando.join(", ")); process.exit(1) }

// --- OAuth (Instagram Business Login) ---
// redirect_uri DEVE estar registrado no app (senao o Instagram mostra "URL bloqueada").
const OAUTH_CLIENT_ID = process.env.IG_APP_ID
const OAUTH_REDIRECT = `${(process.env.PUBLIC_BASE || "").replace(/[/]+$/, "")}/auth/callback`

const OAUTH_SCOPE = "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages"
const OAUTH_URL = "https://www.instagram.com/oauth/authorize?"
  + "client_id=" + OAUTH_CLIENT_ID
  + "&redirect_uri=" + encodeURIComponent(OAUTH_REDIRECT)
  + "&response_type=code&scope=" + encodeURIComponent(OAUTH_SCOPE)

fs.mkdirSync(OUT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function caption(page, text) {
  await page.evaluate((t) => {
    let b = document.getElementById("__cap")
    if (!b) { b = document.createElement("div"); b.id = "__cap"; document.body.appendChild(b) }
    b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999999;background:#0d0d0d;color:#fff;font:600 22px/1.4 Inter,Arial,sans-serif;padding:16px 24px;text-align:center;border-bottom:3px solid #4A90D9"
    b.textContent = t
  }, text).catch(() => {})
}

async function infoCard(page, title, lines) {
  await page.evaluate(({ title, lines }) => {
    let b = document.getElementById("__infocard")
    if (!b) { b = document.createElement("div"); b.id = "__infocard"; document.body.appendChild(b) }
    b.style.cssText = "position:fixed;inset:0;z-index:1000000;background:rgba(13,13,13,.97);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Inter,Arial,sans-serif;padding:48px"
    b.innerHTML = '<div style="max-width:1000px"><h1 style="font:700 38px/1.2 Inter,Arial;color:#4A90D9;margin:0 0 28px">' + title + '</h1>'
      + lines.map(l => '<p style="font:500 24px/1.5 Inter,Arial;margin:10px 0;color:#eaeaea">' + l + '</p>').join("") + '</div>'
  }, { title, lines }).catch(() => {})
}
async function clearCard(page) {
  await page.evaluate(() => { const b = document.getElementById("__infocard"); if (b) b.remove() }).catch(() => {})
}

// PASS A: tela REAL de Login do Instagram (fluxo OAuth) numa sessao DESLOGADA + card de escopos
async function recordOAuth() {
  const dir = resolve(OUT_DIR, "_oauthprofile")
  fs.rmSync(dir, { recursive: true, force: true })
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: false, channel: "chrome", viewport: { width: 1280, height: 800 }, locale: "pt-BR",
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
    args: ["--disable-blink-features=AutomationControlled"],
  })
  const page = ctx.pages()[0] || await ctx.newPage()
  console.log("PASS A (OAuth): abrindo Login do Instagram (deslogado)...")
  // force_reauth garante a tela de Login (entrada do fluxo OAuth). Sessao nova = sempre mostra login.
  const url = OAUTH_URL.replace("authorize?", "authorize?force_reauth=true&")
  await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {})
  await sleep(4000)
  await caption(page, "Fluxo de autorizacao (OAuth): o usuario abre o Login do Instagram para conectar e autorizar o app"); await sleep(8000)
  await infoCard(page, "Login do Instagram - permissoes solicitadas", [
    "Ao entrar, o usuario autoriza o app a acessar a conta profissional com os escopos:",
    "- instagram_business_basic  (identificar a conta: id, username)",
    "- instagram_business_manage_comments  (ler e responder comentarios)",
    "- instagram_business_manage_messages  (enviar 1 Direct a quem comentou)",
    "Apos autorizar, o app so atua na conta conectada (@" + IG_HANDLE + ").",
  ]); await sleep(10000)
  await ctx.close()
  // webm mais recente = pass A
  const f = fs.readdirSync(OUT_DIR).filter(x => x.endsWith(".webm")).map(x => ({ x, t: fs.statSync(resolve(OUT_DIR, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0]
  fs.rmSync(dir, { recursive: true, force: true })
  return f ? resolve(OUT_DIR, f.x) : null
}

async function main() {
  const oauthWebm = await recordOAuth()

  const context = await chromium.launchPersistentContext(USER_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
    args: ["--disable-blink-features=AutomationControlled"],
  })
  const page = context.pages()[0] || await context.newPage()

  // garantir login
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" })
  await sleep(3000)
  if (page.url().includes("/accounts/login") || (await page.locator('input[name="username"]').count()) || (await page.getByText("Continuar com o Facebook").count())) {
    console.log("\n>>> FACA LOGIN no Instagram nessa janela (Continuar com o Facebook). Aguardando ate /direct ou feed...")
    await page.waitForFunction(() => !location.href.includes("login") && !document.querySelector('input[name="username"]'), { timeout: 180000 }).catch(() => {})
    await sleep(2000)
  }
  console.log("PASS B (funcionalidade). Gravando...")

  // Cena 0b - perfil profissional conectado (prova da conta logada/conectada)
  await page.goto("https://www.instagram.com/" + IG_HANDLE + "/", { waitUntil: "domcontentloaded" }).catch(() => {})
  await sleep(3000)
  await caption(page, "Conta profissional conectada ao app: o app le comentarios e envia Direct apenas desta conta"); await sleep(6000)

  // Cena 1 - post + CTA
  await page.goto(REEL, { waitUntil: "domcontentloaded" }); await sleep(3500)
  await caption(page, "1. Nos posts da conta, o convite e comentar " + KEYWORD + " para receber um material gratuito"); await sleep(5000)

  // Cena 2 - comentarios
  try { await page.getByRole("button", { name: /^Comentar/ }).first().click({ timeout: 8000 }) } catch {}
  await sleep(3500)
  await caption(page, "2. O usuario comenta " + KEYWORD + ", ou seja, ele esta pedindo o material"); await sleep(5000)
  await caption(page, "3. A conta responde o comentario avisando que enviou no Direct (sem link no comentario)"); await sleep(5000)

  // Cena 3 - DM (perfil -> mensagem)
  await page.goto(PROFILE, { waitUntil: "domcontentloaded" }); await sleep(3000)
  await caption(page, "4. No Direct: se a pessoa nao segue, pede para seguir. Se segue, envia uma unica mensagem com o link"); await sleep(4000)
  try { await page.locator('div[role="button"]:has-text("Enviar mensagem"), button:has-text("Enviar mensagem")').first().click({ timeout: 8000 }) } catch {}
  await sleep(5000)
  await caption(page, "5. Mensagem enviada apenas a quem pediu (comentou) e segue. Uma DM por pessoa, sem spam"); await sleep(6000)

  await caption(page, "Resumo: o usuario pede comentando, o app confirma o follow e envia o material gratuito. Nada nao solicitado."); await sleep(6000)

  await context.close()

  // pass B webm = mais recente
  const funcWebm = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".webm")).map(f => ({ f, t: fs.statSync(resolve(OUT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]
  if (!funcWebm) { console.log("Sem webm gerado"); return }
  const funcPath = resolve(OUT_DIR, funcWebm.f)
  const mp4 = resolve(OUT_DIR, "screencast-app-review.mp4")
  const norm = (src, out) => execFileP("ffmpeg", ["-y", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=1280:800,fps=30", "-an", "-movflags", "+faststart", out], { windowsHide: true })

  if (oauthWebm && fs.existsSync(oauthWebm)) {
    console.log("Concatenando OAuth + funcionalidade...")
    const a = resolve(OUT_DIR, "_a.mp4"), b = resolve(OUT_DIR, "_b.mp4")
    await norm(oauthWebm, a); await norm(funcPath, b)
    const list = resolve(OUT_DIR, "_list.txt")
    fs.writeFileSync(list, `file '${a.replace(/\\/g, "/")}'\nfile '${b.replace(/\\/g, "/")}'\n`)
    await execFileP("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", mp4], { windowsHide: true })
    fs.rmSync(a, { force: true }); fs.rmSync(b, { force: true }); fs.rmSync(list, { force: true })
  } else {
    console.log("Sem pass A (OAuth). Convertendo so funcionalidade...")
    await norm(funcPath, mp4)
  }
  console.log("\nSCREENCAST PRONTO:", mp4)
}
main().catch(e => { console.error("ERRO:", e.message); process.exit(1) })
