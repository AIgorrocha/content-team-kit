#!/usr/bin/env node
// Coloca thread-twitter.txt na fila do X (content/{marca}/fila-x/pending/). Quem publica: publish-x.mjs --slug <peca> --pode.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resolveClient } from "../_lib/workspace-client.mjs"
import { exigirSlug } from "./_lib/guarda.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const CLIENT = resolveClient(REPO)
const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }

const slug = exigirSlug("--slug", flag("--slug"))
const kind = exigirSlug("--kind", flag("--kind")) || "reels"
const scheduled = flag("--scheduled") || null
if (!slug) {
  console.error("Uso: node scripts/publishing/enqueue-x.mjs --slug <slug> [--kind reels] [--scheduled ISO]")
  process.exit(1)
}

const threadRel = `content/${CLIENT}/${kind}/${slug}/thread-twitter.txt`
const threadAbs = path.join(REPO, threadRel)
if (!existsSync(threadAbs)) throw new Error("thread ausente: " + threadRel)

const pendingDir = path.join(REPO, "content", CLIENT, "fila-x", "pending")
mkdirSync(pendingDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
const out = path.join(pendingDir, `${stamp}-${slug}.md`)
const body = `slug: ${slug}
platforms: x, threads
status: pending
scheduled_at: ${scheduled || "now"}
thread: ${threadRel}

---

${readFileSync(threadAbs, "utf8").trim()}
`
writeFileSync(out, body)
console.log("enfileirado", path.relative(REPO, out).replace(/\\/g, "/"))

// Copia opcional da fila numa pasta sincronizada (ex.: Google Drive), definida em X_QUEUE_MIRROR_DIR.
const mirrorDir = process.env.X_QUEUE_MIRROR_DIR
if (mirrorDir && existsSync(mirrorDir)) {
  const drivePending = path.join(mirrorDir, "pending")
  mkdirSync(drivePending, { recursive: true })
  mkdirSync(path.join(mirrorDir, "posted"), { recursive: true })
  const driveOut = path.join(drivePending, `${stamp}-${slug}.md`)
  writeFileSync(driveOut, body)
  console.log("espelho", driveOut)
}
