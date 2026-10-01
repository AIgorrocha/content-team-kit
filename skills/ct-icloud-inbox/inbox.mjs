#!/usr/bin/env node
// Caixa de entrada de midia crua (iPhone via iCloud Drive, ou pasta local).
// Copia ORIGINAL byte-a-byte pra output/{slug}/icloud-inbox/. Nunca reencoda. Nunca publica.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { homedir } from "node:os"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { resolveClient } from "../../scripts/_lib/workspace-client.mjs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { getClientDefaults } = require("../_shared/client-defaults/index.cjs")

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const MEDIA = new Set([".mp4", ".mov", ".m4v", ".heic", ".heif", ".jpg", ".jpeg", ".png", ".webp"])
const HASH_MAX = 20 * 1024 * 1024

function parseWorkspace(root = ROOT) {
  const ws = join(root, ".workspace")
  if (!existsSync(ws)) return {}
  const out = {}
  for (const line of readFileSync(ws, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z_]+):\s*(.+?)\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

export function candidateRoots(slug, root = ROOT) {
  const home = process.env.USERPROFILE || homedir()
  const ws = parseWorkspace(root)
  const list = []
  if (process.env.CT_ICLOUD_INBOX) list.push(process.env.CT_ICLOUD_INBOX)
  if (ws.icloud_inbox) list.push(ws.icloud_inbox)
  const team = getClientDefaults(slug).icloudFolder || `Content Team ${slug}`
  list.push(
    join(home, "iCloudDrive", team),
    join(home, "iCloud Drive", team),
    join(home, "Desktop", "Content-Team-Inbox", slug),
  )
  return [...new Set(list.map((p) => resolve(p)))]
}

export function resolveInbox(slug, root = ROOT) {
  for (const p of candidateRoots(slug, root)) {
    if (existsSync(p)) return p
  }
  return null
}

function destDir(slug, root = ROOT) {
  return join(root, "output", slug, "icloud-inbox")
}

function seenPath(slug, root = ROOT) {
  return join(destDir(slug, root), "_seen.json")
}

function loadSeen(slug, root = ROOT) {
  const p = seenPath(slug, root)
  if (!existsSync(p)) return { keys: [] }
  try { return JSON.parse(readFileSync(p, "utf8")) } catch { return { keys: [] } }
}

function saveSeen(slug, data, root = ROOT) {
  const dir = destDir(slug, root)
  mkdirSync(dir, { recursive: true })
  writeFileSync(seenPath(slug, root), JSON.stringify(data, null, 2))
}

function fileKey(abs) {
  const st = statSync(abs)
  return `${basename(abs)}:${st.size}:${st.mtimeMs}`
}

function isPlaceholder(abs) {
  const st = statSync(abs)
  if (st.size === 0) return true
  // iCloud Windows: arquivo ainda nao baixado costuma ser reparse/pequeno
  if (st.size < 64 && MEDIA.has(extname(abs).toLowerCase())) return true
  return false
}

export function listMedia(inbox) {
  if (!inbox || !existsSync(inbox)) return []
  return readdirSync(inbox)
    .map((name) => join(inbox, name))
    .filter((abs) => {
      try {
        const st = statSync(abs)
        if (!st.isFile()) return false
        return MEDIA.has(extname(abs).toLowerCase())
      } catch { return false }
    })
}

function ffprobe(abs) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size,bit_rate:stream=codec_type,codec_name,width,height", "-of", "json", abs], { encoding: "utf8" })
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export function ingest({ slug, root = ROOT, dry = false, inbox: inboxOverride = null }) {
  const inbox = inboxOverride || resolveInbox(slug, root)
  if (!inbox) {
    return { ok: false, error: "INBOX_MISSING", candidates: candidateRoots(slug, root) }
  }
  const seen = loadSeen(slug, root)
  const keys = new Set(seen.keys || [])
  const files = listMedia(inbox)
  const copied = []
  const skipped = []
  const blocked = []

  for (const abs of files) {
    const key = fileKey(abs)
    if (keys.has(key)) { skipped.push({ path: abs, reason: "ja-ingerido" }); continue }
    if (isPlaceholder(abs)) { blocked.push({ path: abs, reason: "placeholder-icloud-nao-baixou" }); continue }
    const ext = extname(abs).toLowerCase()
    const stem = basename(abs, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
    const folder = join(destDir(slug, root), `${stamp()}-${stem}`)
    const dest = join(folder, `original${ext}`)
    if (dry) {
      copied.push({ from: abs, to: dest, dry: true, bytes: statSync(abs).size })
      continue
    }
    mkdirSync(folder, { recursive: true })
    copyFileSync(abs, dest)
    const meta = {
      slug,
      source: abs,
      dest,
      bytes: statSync(dest).size,
      ingested_at: new Date().toISOString(),
      ffprobe: [".mp4", ".mov", ".m4v"].includes(ext) ? ffprobe(dest) : null,
    }
    const sha = meta.bytes <= HASH_MAX
      ? createHash("sha256").update(readFileSync(dest)).digest("hex")
      : null
    meta.sha256 = sha
    writeFileSync(join(folder, "meta.json"), JSON.stringify(meta, null, 2))
    keys.add(key)
    copied.push({ from: abs, to: dest, bytes: meta.bytes, sha256: meta.sha256 })
  }
  if (!dry) saveSeen(slug, { keys: [...keys] }, root)
  return { ok: true, inbox, copied, skipped, blocked }
}

export function setupInbox(slug, root = ROOT) {
  const home = process.env.USERPROFILE || homedir()
  const team = getClientDefaults(slug).icloudFolder || `Content Team ${slug}`
  const icloud = join(home, "iCloudDrive", team)
  mkdirSync(icloud, { recursive: true })
  const note = [
    `Inbox ${team}. Sem subpasta.`,
    "Jogue aqui MP4/MOV/HEIC/JPG que os agentes leem.",
  ].join("\n")
  writeFileSync(join(icloud, "LEIA-ME.txt"), note, "utf8")
  return { fallback: icloud, icloud, existsIcloud: existsSync(icloud) }
}

const cmd = process.argv[2]
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const slug = resolveClient(ROOT)
  if (cmd === "status" || !cmd) {
    const inbox = resolveInbox(slug)
    const files = inbox ? listMedia(inbox) : []
    console.log(JSON.stringify({ slug, inbox, files: files.map((p) => ({ name: basename(p), bytes: statSync(p).size })), candidates: candidateRoots(slug) }, null, 2))
  } else if (cmd === "list") {
    const inbox = resolveInbox(slug)
    if (!inbox) { console.error("INBOX_MISSING"); process.exit(2) }
    for (const p of listMedia(inbox)) console.log(`${statSync(p).size}\t${p}`)
  } else if (cmd === "ingest") {
    const dry = process.argv.includes("--dry")
    const r = ingest({ slug, dry })
    console.log(JSON.stringify(r, null, 2))
    if (!r.ok) process.exit(2)
  } else if (cmd === "setup") {
    const r = setupInbox(slug)
    console.log(JSON.stringify(r, null, 2))
  } else {
    console.error("uso: node skills/ct-icloud-inbox/inbox.mjs status|list|ingest|setup [--dry]")
    process.exit(1)
  }
}
