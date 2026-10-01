#!/usr/bin/env node
/**
 * publish-linkedin-link.mjs - Post no LinkedIn PESSOAL com PREVIA DE LINK (artigo/video externo).
 * Usa /rest/posts com content.article: o LinkedIn monta o card de previa (ex: video do YouTube).
 * Texto passa por escape "Little Text" (senao o post corta em parenteses, colchetes etc).
 *
 * Uso:
 *   node scripts/publishing/publish-linkedin-link.mjs --text-file <post.txt> --url <https://...> [--title "..."] [--thumb <img|url>] [--client slug] [--slug nome] [--allow-hashtags] [--dry-run]
 *
 * Padrao do kit: LinkedIn sem hashtag. --allow-hashtags so quando o brand-profile da marca libera.
 *
 * Thumbnail: o LinkedIn NAO busca a imagem do link sozinho nesta API (06/set/2026: post saiu so com
 * o link, sem miniatura). Link do YouTube -> baixa maxresdefault.jpg automaticamente; senao passar --thumb.
 *
 * Env: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID
 */
import { config } from "dotenv"
config({ path: ".env.local", override: true }); config({ path: ".env" })
import { existsSync, readFileSync } from "node:fs"
import { escapeLittleText, assertHashtagPolicy } from "./_lib/linkedin-text.mjs"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const TEXT_FILE = flag("--text-file"), URL = flag("--url"), TITLE = flag("--title") || "", DRY = args.includes("--dry-run")
let THUMB = flag("--thumb")
const yt = URL && URL.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/)
if (!THUMB && yt) THUMB = "https://img.youtube.com/vi/" + yt[1] + "/maxresdefault.jpg"
if (!TEXT_FILE || !existsSync(TEXT_FILE)) { console.error("--text-file invalido"); process.exit(1) }
if (!URL) { console.error("--url obrigatorio"); process.exit(1) }

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN, PERSON = process.env.LINKEDIN_PERSON_ID
if (!TOKEN || !PERSON) { console.error("faltam LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_ID"); process.exit(1) }
const API = "https://api.linkedin.com"
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0", "LinkedIn-Version": "202606" }

const raw = readFileSync(TEXT_FILE, "utf8").split(/\n-{3,}\n/)[0].trim()
try { assertHashtagPolicy(raw, { allow: args.includes("--allow-hashtags") }) } catch (e) { console.error(e.message); process.exit(1) }
const commentary = escapeLittleText(raw)
console.log(`texto: ${raw.length} chars | hashtags: ${(raw.match(/#\w+/g) || []).length} | url: ${URL}`)
if (DRY) { console.log("\n" + raw + "\n\n[DRY-RUN] nada publicado."); process.exit(0) }
console.log(`thumb: ${THUMB || "NENHUMA (card sem imagem)"}`)
async function uploadThumb(src) {
  const bytes = /^https?:/.test(src) ? Buffer.from(await (await fetch(src)).arrayBuffer()) : readFileSync(src)
  const init = await fetch(`${API}/rest/images?action=initializeUpload`, { method: "POST", headers: H, body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${PERSON}` } }) })
  const ij = await init.json()
  if (!init.ok) throw new Error(`initializeUpload ${init.status}: ${JSON.stringify(ij)}`)
  const up = await fetch(ij.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/octet-stream" }, body: bytes })
  if (!up.ok && up.status !== 201) throw new Error(`upload PUT ${up.status}: ${await up.text()}`)
  console.log(`thumb enviada: ${ij.value.image} (${bytes.length} bytes)`)
  return ij.value.image
}
const thumbnail = THUMB && !DRY ? await uploadThumb(THUMB) : undefined

const body = {
  author: `urn:li:person:${PERSON}`,
  commentary,
  visibility: "PUBLIC",
  distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
  content: { article: { source: URL, title: TITLE || URL, ...(thumbnail ? { thumbnail } : {}) } },
  lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false,
}
const r = await fetch(`${API}/rest/posts`, { method: "POST", headers: H, body: JSON.stringify(body) })
const urn = r.headers.get("x-restli-id")
if (!urn) { console.error(`ERRO ${r.status}: ${await r.text()}`); process.exit(1) }
await new Promise((res) => setTimeout(res, 2500))
const v = await fetch(`${API}/rest/posts/${encodeURIComponent(urn)}`, { headers: H })
if (v.status === 200) { const j = await v.json(); console.log(`verify: ${(j.commentary || "").length} chars | article: ${j.content?.article?.source || "?"}`) }
console.log(`POST_URN ${urn}`)
const postUrl = `https://www.linkedin.com/feed/update/${urn}`
console.log(`URL ${postUrl}`)
await registerPublicationSafe({
  client_slug: flag("--client"), platform: "linkedin", content_type: "link",
  title: flag("--slug") || TITLE || basename(dirname(resolve(TEXT_FILE))),
  url: postUrl, caption: raw, source_url: URL, source_agent: "publish-linkedin-link.mjs",
})
