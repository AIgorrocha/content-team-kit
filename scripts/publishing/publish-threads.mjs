#!/usr/bin/env node
/**
 * Publica thread-twitter.txt no Threads (mesmo texto do X).
 * Uso: node scripts/publishing/publish-threads.mjs --from path/thread-twitter.txt [--client slug] [--slug nome] [--dry-run]
 * Env: THREADS_USER_ID e THREADS_ACCESS_TOKEN (o Threads tem token proprio; NAO usa o do Instagram).
 * Opcional: THREADS_HANDLE (ou IG_HANDLE), so para montar o link se a API nao devolver o permalink.
 */
import { config } from "dotenv"
config({ quiet: true, path: ".env.local", override: true })
config({ quiet: true, path: ".env" })
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const FROM = flag("--from")
const DRY = args.includes("--dry-run")
const CLIENT = flag("--client")
const SLUG = flag("--slug")
if (!FROM || !existsSync(FROM)) {
  console.error("Uso: node scripts/publishing/publish-threads.mjs --from <thread-twitter.txt> [--dry-run]")
  process.exit(1)
}

const parts = readFileSync(FROM, "utf8")
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter(Boolean)
if (!parts.length) throw new Error("thread vazia")

const userId = process.env.THREADS_USER_ID
const token = process.env.THREADS_ACCESS_TOKEN
const handle = process.env.THREADS_HANDLE || process.env.IG_HANDLE || ""

const BASE = "https://graph.threads.net/v1.0"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (DRY) {
  parts.forEach((t, i) => console.log(`[DRY ${i + 1}/${parts.length}] ${t}`))
  process.exit(0)
}
if (!userId || !token) throw new Error("Faltam THREADS_USER_ID e THREADS_ACCESS_TOKEN no .env.local (o Threads nao usa o token do Instagram). Veja docs/CONECTAR-REDES.md")

async function createAndPublish(text, replyTo) {
  const payload = { text, media_type: "TEXT", access_token: token }
  if (replyTo) payload.reply_to_id = replyTo
  const cRes = await fetch(`${BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  })
  const c = await cRes.json()
  if (c.error) throw new Error("container: " + c.error.message)
  if (!c.id) throw new Error("container sem id: " + JSON.stringify(c))
  const pRes = await fetch(`${BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ creation_id: c.id, access_token: token }),
  })
  const p = await pRes.json()
  if (p.error) throw new Error("publish: " + p.error.message)
  return p.id
}

let rootId = null
let lastId = null
for (let i = 0; i < parts.length; i++) {
  lastId = await createAndPublish(parts[i], i === 0 ? undefined : lastId)
  if (i === 0) rootId = lastId
  console.log(`posted ${i + 1}/${parts.length}`, lastId)
  if (i < parts.length - 1) await sleep(1500)
}
// Link real: campo permalink da API (o id nao abre como URL). Sem ele, cai no handle, se houver.
const permalink = await fetch(`${BASE}/${rootId}?fields=permalink&access_token=${token}`)
  .then((r) => r.json()).then((j) => j.permalink || null).catch(() => null)
const url = permalink || (handle ? `https://www.threads.net/@${handle}/post/${rootId}` : null)
console.log("PUBLICADO", url || `(sem link: id ${rootId})`)

if (url) {
  await registerPublicationSafe({
    client_slug: CLIENT, platform: "threads", content_type: "thread",
    title: SLUG || path.basename(path.dirname(path.resolve(FROM))), url, caption: parts.join("\n\n"),
    source_agent: "publish-threads.mjs",
  })
} else {
  console.warn("AVISO: sem link nao da para registrar a peca. Defina THREADS_HANDLE ou IG_HANDLE no .env.local e registre com register-publication.mjs.")
}
