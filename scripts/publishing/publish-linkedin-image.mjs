#!/usr/bin/env node
/**
 * publish-linkedin-image.mjs - Post no LinkedIn PESSOAL com UMA imagem (ugcPosts + registerUpload).
 * Usa v2/ugcPosts (NAO /rest/posts, que trunca texto com imagem).
 *
 * Uso:
 *   node scripts/publishing/publish-linkedin-image.mjs --text-file <post.txt> --image <img.png|url> [--client slug] [--slug nome] [--allow-hashtags] [--dry-run]
 *
 * Padrao do kit: LinkedIn sem hashtag. --allow-hashtags so quando o brand-profile da marca libera.
 *
 * --image aceita caminho local OU url publica (baixa os bytes antes do upload).
 *
 * Env: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID
 */
import { config } from "dotenv"
config({ path: ".env.local", override: true }); config({ path: ".env" })
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"
import { basename, dirname, resolve } from "node:path"
import { assertHashtagsPreserved, assertHashtagPolicy, extractHashtags } from "./_lib/linkedin-text.mjs"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)
const DRY_RUN = has("--dry-run")
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN
const PERSON = process.env.LINKEDIN_PERSON_ID
if (!TOKEN || !PERSON) { console.error("LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_ID faltando"); process.exit(1) }

const TEXT_FILE = flag("--text-file")
const IMAGE = flag("--image")
const IMAGE_IS_URL = !!IMAGE && /^https?:\/\//i.test(IMAGE)
if (!TEXT_FILE || !existsSync(TEXT_FILE)) { console.error("--text-file invalido"); process.exit(1) }
if (!IMAGE || (!IMAGE_IS_URL && !existsSync(IMAGE))) { console.error("--image invalido"); process.exit(1) }
const text = readFileSync(TEXT_FILE, "utf8").trim()
const owner = `urn:li:person:${PERSON}`
const H = { Authorization: `Bearer ${TOKEN}`, "X-Restli-Protocol-Version": "2.0.0" }

// PORTA BLOQUEANTE: hashtag so com liberacao da marca; e, se houver, TEM que chegar no payload.
const payloadText = text
try { assertHashtagPolicy(text, { allow: has("--allow-hashtags") }) } catch (e) { console.error(e.message); process.exit(1) }
assertHashtagsPreserved(text, payloadText)
const _hs = extractHashtags(text)
if (_hs.length) console.log(`[hashtag-gate] ${_hs.length} hashtag(s) preservadas no payload: ${_hs.join(" ")}`)

async function main() {
  if (DRY_RUN) {
    const bytes = IMAGE_IS_URL ? await fetch(IMAGE).then(r => r.arrayBuffer()) : readFileSync(IMAGE)
    console.log("[dry-run] Nao vai chamar a API do LinkedIn. Plano:")
    console.log(`  autor: ${owner}`)
    console.log(`  imagem: ${IMAGE} (${bytes.byteLength ?? bytes.length} bytes)`)
    console.log(`  texto (${payloadText.length} chars):\n${payloadText}`)
    return
  }

  // 1) registerUpload
  const reg = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({
      registerUploadRequest: {
        owner,
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  })
  const rj = await reg.json()
  if (!reg.ok) { console.error("registerUpload FAIL", reg.status, JSON.stringify(rj)); process.exit(1) }
  const uploadUrl = rj.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl
  const asset = rj.value.asset
  console.log("asset:", asset)

  // 2) PUT bytes
  const bytes = IMAGE_IS_URL ? Buffer.from(await fetch(IMAGE).then(r => r.arrayBuffer())) : readFileSync(IMAGE)
  const up = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/octet-stream" }, body: bytes })
  if (!up.ok && up.status !== 201) { console.error("upload PUT FAIL", up.status, await up.text()); process.exit(1) }
  console.log("imagem enviada")

  // 3) ugcPosts
  const post = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({
      author: owner,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: payloadText },
          shareMediaCategory: "IMAGE",
          media: [{ status: "READY", media: asset, title: { text: flag("--title") || "" } }],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  })
  const pj = await post.json().catch(() => ({}))
  if (!post.ok) { console.error("ugcPosts FAIL", post.status, JSON.stringify(pj)); process.exit(1) }
  const id = post.headers.get("x-restli-id") || pj.id
  const url = "https://www.linkedin.com/feed/update/" + id
  console.log("PUBLICADO urn:", id)
  console.log("URL:", url)

  await registerPublicationSafe({
    client_slug: flag("--client"), platform: "linkedin", content_type: "post",
    title: flag("--slug") || basename(dirname(resolve(TEXT_FILE))),
    url, caption: payloadText,
    media_urls: IMAGE_IS_URL ? [IMAGE] : null, source_agent: "publish-linkedin-image.mjs",
  })
}
main().catch((e) => { console.error("Erro:", e.message); process.exit(1) })
