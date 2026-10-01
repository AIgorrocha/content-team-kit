#!/usr/bin/env node
/**
 * post-linkedin.mjs - Post de SO TEXTO no LinkedIn pessoal (/rest/posts).
 * Com imagem use publish-linkedin-image.mjs; com video, publish-linkedin-video.mjs;
 * com link de previa, publish-linkedin-link.mjs (a /rest/posts trunca o texto quando vai com midia).
 *
 * Uso:
 *   node scripts/publishing/post-linkedin.mjs --caption-file <post.txt> [--client slug] [--slug nome] [--allow-hashtags] [--pode] [--dry-run]
 *
 * Padrao do kit: LinkedIn sem hashtag. --allow-hashtags so quando o brand-profile da marca libera.
 * Env: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_ID (docs/CONECTAR-REDES.md)
 */
import { config } from "dotenv"
config({ quiet: true, path: ".env.local", override: true }); config({ quiet: true, path: ".env" })
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { escapeLittleText, assertHashtagPolicy, assertHashtagsPreserved } from "./_lib/linkedin-text.mjs"
import { exigirSlug, somentePrevia } from "./_lib/guarda.mjs"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.findIndex((a) => a === n || a.startsWith(n + "=")); if (i < 0) return null; return args[i].includes("=") ? args[i].slice(args[i].indexOf("=") + 1) : args[i + 1] }
const has = (n) => args.includes(n)
const VALUE_FLAGS = ["--caption", "--caption-file", "--client", "--slug"]
const extras = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.includes(args[i - 1]))

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN
const PERSON = process.env.LINKEDIN_PERSON_ID
const API = "https://api.linkedin.com"

exigirSlug("--client", flag("--client")); exigirSlug("--slug", flag("--slug"))
const captionFile = flag("--caption-file")
if (captionFile && !existsSync(captionFile)) { console.error("--caption-file nao encontrado:", captionFile); process.exit(1) }
// PORTA BLOQUEANTE: prefira sempre o arquivo UTF-8; --caption inline so para teste curto.
const caption = captionFile ? readFileSync(captionFile, "utf8").trim() : (flag("--caption") || "")

if (!caption) {
  console.log("Uso: node scripts/publishing/post-linkedin.mjs --caption-file <post.txt> [--client slug] [--slug nome] [--allow-hashtags] [--pode] [--dry-run]")
  console.log("Texto com imagem: publish-linkedin-image.mjs. Com video: publish-linkedin-video.mjs. Com link: publish-linkedin-link.mjs.")
  process.exit(1)
}
if (extras.length > 0) {
  console.error("Este script publica so texto. Para imagem use scripts/publishing/publish-linkedin-image.mjs (a /rest/posts trunca o texto com imagem).")
  process.exit(1)
}
if (/Ã.|Â./.test(caption)) { console.error("ABORT mojibake no texto"); process.exit(1) }
try {
  assertHashtagPolicy(caption, { allow: has("--allow-hashtags") })
  assertHashtagsPreserved(caption, caption)
} catch (e) { console.error(e.message); process.exit(1) }

if (somentePrevia()) { console.log(`[dry-run] ${caption.length} caracteres, nada publicado:\n\n${caption}`); process.exit(0) }
if (!TOKEN || !PERSON) {
  console.error("Configure LINKEDIN_ACCESS_TOKEN e LINKEDIN_PERSON_ID no .env.local.")
  console.error("Para gerar: node scripts/publishing/linkedin-auth-local.mjs (docs/CONECTAR-REDES.md)")
  process.exit(1)
}

const res = await fetch(`${API}/rest/posts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202606",
  },
  body: JSON.stringify({
    author: `urn:li:person:${PERSON}`,
    commentary: escapeLittleText(caption),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  }),
})
const urn = res.headers.get("x-restli-id")
if (res.status !== 201 || !urn) {
  console.error(`ERRO ${res.status}: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}
const url = `https://www.linkedin.com/feed/update/${urn}`
console.log("PUBLICADO:", url)

await registerPublicationSafe({
  client_slug: flag("--client"), platform: "linkedin", content_type: "post",
  title: flag("--slug") || (captionFile ? path.basename(path.dirname(path.resolve(captionFile))) : caption.slice(0, 40)),
  url, caption, source_agent: "post-linkedin.mjs",
})
