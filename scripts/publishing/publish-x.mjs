#!/usr/bin/env node
/**
 * publish-x.mjs - Publicador oficial do X (Twitter): le a fila da marca e posta a thread pelo
 * navegador (Playwright), na sessao logada DESTA marca (~/.playwright-x-{slug}). Sem chave de API.
 *
 * Fluxo: adapt-linkedin-to-x.mjs gera thread-twitter.txt, enqueue-x.mjs coloca na fila
 * (content/{slug}/fila-x/pending/), este script publica e move o item para fila-x/posted/.
 *
 * Uso:
 *   node scripts/publishing/publish-x.mjs --login                  abre o X para voce entrar (1 vez)
 *   node scripts/publishing/publish-x.mjs --slug <peca>            MOSTRA o que postaria (nada vai pro ar)
 *   node scripts/publishing/publish-x.mjs --slug <peca> --pode     publica de verdade (so com o "pode")
 *   node scripts/publishing/publish-x.mjs --file <item.md|thread-twitter.txt> [--pode]
 *
 * Opcional: X_HANDLE (conta da marca, sem @) para capturar o link do post; sem ele o script tenta
 * ler o nome da conta na propria tela. Com o link, a peca e registrada em ct_content_items.
 */
import { config } from "dotenv"
config({ quiet: true, path: ".env.local", override: true }); config({ quiet: true, path: ".env" })
import { chromium } from "playwright"
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { resolveClient, playwrightDir } from "../_lib/workspace-client.mjs"
import { parseQueueItem, toTweets } from "./_lib/x-thread.mjs"
import { exigirSlug } from "./_lib/guarda.mjs"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LOGIN_WAIT_MS = 5 * 60 * 1000

const CLIENT = resolveClient(REPO)
const queueDir = path.join(REPO, "content", CLIENT, "fila-x")

function findItem() {
  const file = flag("--file")
  if (file) return path.resolve(file)
  const slug = exigirSlug("--slug", flag("--slug"))
  if (!slug) return null
  const pending = path.join(queueDir, "pending")
  const hits = existsSync(pending) ? readdirSync(pending).filter((f) => f.endsWith(`-${slug}.md`)).sort() : []
  if (!hits.length) throw new Error(`nada na fila para "${slug}" em ${path.relative(REPO, pending)}. Rode enqueue-x.mjs --slug ${slug} antes.`)
  return path.join(pending, hits[hits.length - 1])
}

async function isLoggedIn(page) {
  if (/\/login|\/i\/flow\/login|\/account\/access/.test(page.url())) return false
  return (await page.locator('[data-testid="SideNav_NewTweet_Button"], [data-testid="tweetTextarea_0"], a[href="/compose/post"]').count()) > 0
}

async function ensureLoggedIn(page) {
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
  await sleep(2500)
  if (await isLoggedIn(page)) return
  console.log("Voce ainda nao esta logado no X. Na janela que abriu, entre com usuario e senha (NAO use 'Entrar com Google').")
  console.log("Espero ate 5 minutos o seu feed aparecer. Nao feche a janela.")
  await page.goto("https://x.com/login", { waitUntil: "domcontentloaded" }).catch(() => {})
  const deadline = Date.now() + LOGIN_WAIT_MS
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) return
    await sleep(5000)
  }
  throw new Error("nao entrou no X a tempo. Rode de novo depois de entrar.")
}

async function fillDraft(page, locator, text) {
  await locator.click()
  await sleep(250)
  await page.keyboard.press("Control+A")
  await page.keyboard.insertText(text)
}

async function postThread(page, tweets) {
  await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded", timeout: 30000 })
  await sleep(2000)
  if (!(await isLoggedIn(page))) throw new Error("X pediu login ou bloqueou (captcha?). Rode --login e tente de novo.")
  await fillDraft(page, page.locator('[data-testid="tweetTextarea_0"]').first(), tweets[0])
  for (let i = 1; i < tweets.length; i++) {
    await page.locator('[data-testid="addButton"], button[aria-label*="Add post" i], button[aria-label*="Adicionar post" i]').first().click()
    await sleep(600)
    await fillDraft(page, page.locator(`[data-testid="tweetTextarea_${i}"]`).first(), tweets[i])
  }
  await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first().click()
  await sleep(5000)
}

async function findHandle(page) {
  if (process.env.X_HANDLE) return process.env.X_HANDLE.replace(/^@/, "")
  const txt = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').first().innerText({ timeout: 3000 }).catch(() => "")
  return (txt.match(/@([A-Za-z0-9_]+)/) || [])[1] || null
}

async function capturePermalink(page, handle, firstTweet) {
  if (!handle) return null
  const needle = firstTweet.replace(/\s+/g, " ").slice(0, 28)
  await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await sleep(3500)
  const articles = page.locator("article")
  const n = await articles.count()
  for (let i = 0; i < Math.min(n, 8); i++) {
    const text = ((await articles.nth(i).innerText().catch(() => "")) || "").replace(/\s+/g, " ")
    if (!text.includes(needle)) continue
    const href = await articles.nth(i).locator('a[href*="/status/"]').first().getAttribute("href")
    const m = href && href.match(/status\/(\d+)/)
    if (m) return `https://x.com/${handle}/status/${m[1]}`
  }
  return null
}

// ---------------------------------------------------------------------------
let itemPath = null
try { itemPath = has("--login") ? null : findItem() } catch (e) { console.error(e.message); process.exit(1) }
if (!has("--login") && !itemPath) {
  console.error("Uso: publish-x.mjs --login | --slug <peca> [--pode] | --file <item> [--pode]")
  process.exit(1)
}

let tweets = [], meta = {}
if (itemPath) {
  if (!existsSync(itemPath)) { console.error("arquivo nao encontrado:", itemPath); process.exit(1) }
  const parsed = parseQueueItem(readFileSync(itemPath, "utf8"))
  meta = parsed.meta
  if (meta.status && meta.status !== "pending") { console.error(`item com status "${meta.status}" (nao e pending): nao publico de novo.`); process.exit(1) }
  try { tweets = toTweets(parsed.body) } catch (e) { console.error(e.message); process.exit(1) }
  console.log(`[x] marca=${CLIENT} item=${path.relative(REPO, itemPath)} tweets=${tweets.length}`)
  tweets.forEach((t, i) => console.log(`\n--- tweet ${i + 1}/${tweets.length} (${[...t].length} caracteres) ---\n${t}`))
  if (!has("--pode")) {
    console.log("\n[pre-visualizacao] Nada foi publicado. Depois do seu 'pode', rode de novo com --pode.")
    process.exit(0)
  }
}

const context = await chromium.launchPersistentContext(playwrightDir("x", REPO), {
  headless: false, channel: "chrome", viewport: { width: 1280, height: 900 }, locale: "pt-BR",
  args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
})
const page = context.pages()[0] || (await context.newPage())
try {
  await ensureLoggedIn(page)
  if (has("--login")) {
    console.log("Login salvo para esta marca. Pode publicar com --slug <peca> --pode.")
    await context.close()
    process.exit(0)
  }

  const handle = await findHandle(page)
  await postThread(page, tweets)
  const permalink = await capturePermalink(page, handle, tweets[0])
  console.log(permalink ? `PUBLICADO: ${permalink}` : "PUBLICADO, mas nao consegui ler o link. Pegue na tela do X e registre com register-publication.mjs.")

  // Fila: move para posted/ com o resultado, para nunca postar duas vezes.
  if (path.basename(path.dirname(itemPath)) === "pending") {
    const postedDir = path.join(queueDir, "posted")
    mkdirSync(postedDir, { recursive: true })
    const dest = path.join(postedDir, path.basename(itemPath))
    renameSync(itemPath, dest)
    writeFileSync(dest, readFileSync(dest, "utf8").replace(/^status: pending$/m, "status: posted"))
    appendFileSync(dest, `\nposted_at: ${new Date().toISOString()}\npermalink: ${permalink || ""}\n`)
    console.log("Item movido para", path.relative(REPO, dest))
  }
  if (permalink) {
    await registerPublicationSafe({
      client_slug: CLIENT, platform: "x", content_type: "thread",
      title: meta.slug || path.basename(itemPath, ".md"), url: permalink,
      caption: tweets.join("\n\n"), source_agent: "publish-x.mjs",
    })
  }
} catch (e) {
  console.error("Erro:", e.message)
  process.exitCode = 1
} finally {
  await sleep(2000)
  await context.close()
}
