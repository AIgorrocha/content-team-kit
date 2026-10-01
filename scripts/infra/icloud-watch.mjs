#!/usr/bin/env node
// Olha as inboxes iCloud de cada cliente configurado, copia original, transcreve video,
// anota voz. NUNCA publica. Roda no PC (Task Scheduler 10 min). iCloud nao existe em servidor Linux.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { ingest } from "../../skills/ct-icloud-inbox/inbox.mjs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { getClientDefaults } = require("../../skills/_shared/client-defaults/index.cjs")
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..")
const HOME = process.env.USERPROFILE || homedir()
const LOCK = join(ROOT, "output", ".icloud-watch.lock")
const STORY_STAMP = join(ROOT, "output", ".story-digest-at")

// Caixas iCloud por cliente. Fonte, em ordem: env CT_ICLOUD_BOXES (JSON:
// [{"slug":"...","inbox":"..."}]) > skills/_shared/client-defaults/{slug}.cjs#icloudFolder
// (fora do kit) > default neutro "Content Team {slug}".
function defaultBoxes() {
  const dir = join(ROOT, "clients")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template")
    .filter((d) => existsSync(join(dir, d.name, "brand-profile.md")))
    .map((d) => {
      const folder = getClientDefaults(d.name).icloudFolder || `Content Team ${d.name}`
      return { slug: d.name, inbox: join(HOME, "iCloudDrive", folder) }
    })
}
const BOXES = process.env.CT_ICLOUD_BOXES ? JSON.parse(process.env.CT_ICLOUD_BOXES) : defaultBoxes()

function locked() {
  if (!existsSync(LOCK)) return false
  return Date.now() - statSync(LOCK).mtimeMs < 15 * 60 * 1000
}

function transcribe(video, outDir) {
  const whisper = process.env.WHISPER || "whisper"
  const r = spawnSync(whisper, [
    video, "--language", "Portuguese", "--model", "base",
    "--output_format", "txt", "--output_dir", outDir,
  ], { encoding: "utf8", timeout: 8 * 60 * 1000 })
  return r.status === 0
}

function appendLearnings(slug, text) {
  if (!text || text.trim().length < 40) return
  const f = join(ROOT, "content", slug, "inbox-learnings.md")
  mkdirSync(dirname(f), { recursive: true })
  const prev = existsSync(f) ? readFileSync(f, "utf8") : "# Falas do celular (nao publicar)\n\nct-redator le isto. Nao reescrever voice-patterns sem o cliente.\n\n"
  const clip = text.trim().split(/\n+/).slice(0, 12).join("\n")
  writeFileSync(f, prev + `\n## ${new Date().toISOString().slice(0, 16)}\n\n${clip}\n`)
}

function pendingPath(slug) {
  return join(ROOT, "output", slug, "icloud-inbox", "PENDING.md")
}

function writePending(slug, copied) {
  const f = pendingPath(slug)
  mkdirSync(dirname(f), { recursive: true })
  const lines = copied.map((c) => `- ${c.to} (${c.bytes} bytes)`)
  writeFileSync(f, `# Inbox nova ${slug}\n\n${new Date().toISOString()}\n\n${lines.join("\n")}\n\nNao publicado. Claude no celular: pedir edicao/legenda.\n`)
}

if (locked()) {
  console.log("watch: lock ativo, saindo")
  process.exit(0)
}
mkdirSync(join(ROOT, "output"), { recursive: true })
writeFileSync(LOCK, String(Date.now()))

try {
  for (const box of BOXES) {
    const r = ingest({ slug: box.slug, inbox: box.inbox, root: ROOT })
    if (!r.ok) {
      console.log(`${box.slug}: ${r.error}`)
      continue
    }
    console.log(`${box.slug}: copiados=${r.copied.length} skipped=${r.skipped.length} blocked=${r.blocked.length}`)
    if (!r.copied.length) continue
    writePending(box.slug, r.copied)
    for (const c of r.copied) {
      const ext = c.to.toLowerCase()
      if (!/\.(mp4|mov|m4v)$/.test(ext)) continue
      const outDir = dirname(c.to)
      if (transcribe(c.to, outDir)) {
        const base = c.to.replace(/\.[^.]+$/, ".txt")
        const txt = existsSync(base) ? readFileSync(base, "utf8") : ""
        appendLearnings(box.slug, txt)
        console.log("transcrito", c.to)
      } else {
        console.log("whisper falhou", c.to)
      }
    }
  }

  const due = !existsSync(STORY_STAMP) || Date.now() - statSync(STORY_STAMP).mtimeMs > 4 * 3600 * 1000
  if (due) {
    const story = spawnSync(process.execPath, [join(ROOT, "scripts", "analytics", "collect-story-insights.mjs")], {
      cwd: ROOT, encoding: "utf8", timeout: 120000,
    })
    writeFileSync(STORY_STAMP, new Date().toISOString())
    console.log("stories:", story.status === 0 ? "ok" : (story.stderr || story.stdout || "fail").slice(0, 200))
  }
} finally {
  try { writeFileSync(LOCK, "0") } catch { /* */ }
}
