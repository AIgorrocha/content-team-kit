#!/usr/bin/env node
/**
 * publish-linkedin-video.mjs - Post no LinkedIn PESSOAL com VIDEO (ugcPosts + registerUpload).
 * Mesmo caminho do publish-linkedin-image.mjs (v2/ugcPosts), so muda a recipe e a categoria.
 * NAO usar /rest/posts: trunca texto quando vai com midia.
 *
 * Uso:
 *   node scripts/publishing/publish-linkedin-video.mjs --text-file <post.txt> --video <v.mp4> [--title "..."] [--client slug] [--slug nome] [--allow-hashtags] [--dry-run]
 *
 * Padrao do kit: LinkedIn sem hashtag. --allow-hashtags so quando o brand-profile da marca libera.
 *
 * Env: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID
 */
import { config } from "dotenv"
config({ path: ".env.local", override: true }); config({ path: ".env" })
import { readFileSync, existsSync, statSync } from "node:fs"
import { assertHashtagsPreserved, assertHashtagPolicy, extractHashtags } from "./_lib/linkedin-text.mjs"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN
const PERSON = process.env.LINKEDIN_PERSON_ID
if (!TOKEN || !PERSON) { console.error("LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_ID faltando"); process.exit(1) }

const TEXT_FILE = flag("--text-file")
const VIDEO = flag("--video")
const DRY = has("--dry-run")
if (!TEXT_FILE || !existsSync(TEXT_FILE)) { console.error("--text-file invalido"); process.exit(1) }
if (!VIDEO || !existsSync(VIDEO)) { console.error("--video invalido"); process.exit(1) }

const text = readFileSync(TEXT_FILE, "utf8").trim()
const owner = `urn:li:person:${PERSON}`
const H = { Authorization: `Bearer ${TOKEN}`, "X-Restli-Protocol-Version": "2.0.0" }

// PORTA BLOQUEANTE: hashtag so com liberacao da marca; e, se houver, tem que sobreviver no payload.
const payloadText = text
try { assertHashtagPolicy(text, { allow: has("--allow-hashtags") }) } catch (e) { console.error(e.message); process.exit(1) }
assertHashtagsPreserved(text, payloadText)
const hs = extractHashtags(text)
if (hs.length) console.log(`[hashtag-gate] ${hs.length} hashtag(s) no payload: ${hs.join(" ")}`)

// Prova de acentuacao antes de subir (regra UTF-8 blindado).
const acentos = (payloadText.match(/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g) || []).length
console.log(`[utf8-gate] ${acentos} caractere(s) acentuado(s) lidos como UTF-8. Amostra: ${payloadText.slice(0, 60)}`)
if (acentos === 0) { console.error("ABORT: nenhum acento lido, provavel mojibake na leitura do arquivo."); process.exit(1) }

const sizeBytes = statSync(VIDEO).size
console.log(`[video] ${VIDEO} (${(sizeBytes / 1024 / 1024).toFixed(1)} MB)`)
console.log(`[texto] ${payloadText.length} caracteres`)

if (DRY) { console.log("\nDRY RUN: nada publicado."); process.exit(0) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // 1) registerUpload (recipe de VIDEO)
  const reg = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({
      registerUploadRequest: {
        owner,
        recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  })
  const rj = await reg.json()
  if (!reg.ok) { console.error("registerUpload FAIL", reg.status, JSON.stringify(rj)); process.exit(1) }
  const uploadUrl = rj.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl
  const asset = rj.value.asset
  console.log("asset:", asset)

  // 2) PUT bytes (arquivo ORIGINAL, sem re-encode)
  const bytes = readFileSync(VIDEO)
  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/octet-stream" },
    body: bytes,
  })
  if (!up.ok && up.status !== 201) { console.error("upload PUT FAIL", up.status, await up.text()); process.exit(1) }
  console.log("video enviado, aguardando processamento...")

  // 3) Poll ate o asset ficar AVAILABLE (video precisa processar antes do post)
  const assetId = asset.split(":").pop()
  let ready = false
  for (let i = 0; i < 60; i++) {
    await sleep(10000)
    const st = await fetch(`https://api.linkedin.com/v2/assets/${assetId}`, { headers: H })
    const sj = await st.json().catch(() => ({}))
    const status = sj.recipes?.[0]?.status || sj.status || "?"
    console.log(`  [${i + 1}/60] status=${status}`)
    if (status === "AVAILABLE") { ready = true; break }
    if (status === "CLIENT_ERROR" || status === "SERVER_ERROR") {
      console.error("processamento falhou:", JSON.stringify(sj)); process.exit(1)
    }
  }
  if (!ready) { console.error("ABORT: video nao ficou AVAILABLE em 10 min."); process.exit(1) }

  // 4) ugcPosts
  const post = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({
      author: owner,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: payloadText },
          shareMediaCategory: "VIDEO",
          media: [{ status: "READY", media: asset, title: { text: flag("--title") || "" } }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  })
  const pj = await post.json().catch(() => ({}))
  if (!post.ok) { console.error("ugcPosts FAIL", post.status, JSON.stringify(pj)); process.exit(1) }
  const id = post.headers.get("x-restli-id") || pj.id
  console.log("PUBLICADO urn:", id)
  const url = "https://www.linkedin.com/feed/update/" + id
  console.log("URL:", url)
  await registerPublicationSafe({
    client_slug: flag("--client"), platform: "linkedin", content_type: "video",
    title: flag("--slug") || basename(dirname(resolve(TEXT_FILE))),
    url, caption: payloadText, source_agent: "publish-linkedin-video.mjs",
  })
}
main().catch((e) => { console.error("Erro:", e.message); process.exit(1) })
