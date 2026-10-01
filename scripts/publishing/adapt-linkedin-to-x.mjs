#!/usr/bin/env node
/**
 * Parte post-linkedin.txt em thread-twitter.txt (mesmo texto, formato X).
 * Nao publica. Depois de enqueue-x.mjs, quem posta e scripts/publishing/publish-x.mjs (com o "pode").
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resolveClient } from "../_lib/workspace-client.mjs"
import { exigirSlug } from "./_lib/guarda.mjs"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const slug = exigirSlug("--slug", flag("--slug"))
const kind = exigirSlug("--kind", flag("--kind")) || "reels"
if (!slug) {
  console.error("Uso: node scripts/publishing/adapt-linkedin-to-x.mjs --slug <slug> [--kind reels]")
  process.exit(1)
}

const dir = path.join(REPO, "content", resolveClient(REPO), kind, slug)
const src = path.join(dir, "post-linkedin.txt")
const dst = path.join(dir, "thread-twitter.txt")
if (!existsSync(src)) throw new Error("post-linkedin.txt ausente: " + src)

const MAX = 260
const raw = readFileSync(src, "utf8").replace(/^\uFEFF/, "").trim()
const paras = raw.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)

const chunks = []
for (const para of paras) {
  if (para.length <= MAX) {
    chunks.push(para)
    continue
  }
  const sentences = para.split(/(?<=[.!?])\s+/)
  let buf = ""
  const flush = () => { if (buf) chunks.push(buf); buf = "" }
  for (const s of sentences) {
    if (!buf) {
      if (s.length <= MAX) buf = s
      else {
        const words = s.split(" ")
        let wbuf = ""
        for (const w of words) {
          const next = wbuf ? wbuf + " " + w : w
          if (next.length <= MAX) wbuf = next
          else { chunks.push(wbuf); wbuf = w }
        }
        if (wbuf) buf = wbuf
      }
      continue
    }
    const next = buf + " " + s
    if (next.length <= MAX) buf = next
    else { flush(); buf = s }
  }
  flush()
}

if (!chunks.length) throw new Error("thread vazia")
const total = chunks.length
const numbered = chunks.map((c, i) => `${c}\n${i + 1}/${total}`)
for (const t of numbered) {
  if (t.length > 270) throw new Error("tweet >270: " + t.length + " " + t.slice(0, 40))
}
writeFileSync(dst, numbered.join("\n\n") + "\n")
console.log("thread", numbered.length, "posts ->", path.relative(REPO, dst).replace(/\\/g, "/"))
numbered.forEach((t, i) => console.log(`[${i + 1}] ${t.length}c`))
