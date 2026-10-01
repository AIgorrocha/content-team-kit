#!/usr/bin/env node
/**
 * publish-ig-image.mjs - Publica UMA imagem no Instagram (feed).
 * O post-carousel.mjs exige minimo 2 imagens; este cobre o caso de peca unica
 * (infografico, card, print).
 *
 * Uso:
 *   node scripts/publishing/publish-ig-image.mjs <img.png> --caption-file <legenda.txt>
 *     [--account principal|business] [--client slug] [--slug nome] [--dry-run]
 *
 * --account escolhe a conta pela chave: principal (INSTAGRAM_*, padrao) ou business
 * (INSTAGRAM_BUSINESS_*, aceita token EAAN via graph.facebook.com).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, e as credenciais da conta escolhida
 */
import { config } from "dotenv"
config({ quiet: true, path: ".env.local", override: true }); config({ quiet: true, path: ".env" })
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "node:fs"
import { basename, extname } from "node:path"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { exigirSlug, somentePrevia } from "./_lib/guarda.mjs"
const here = path.dirname(fileURLToPath(import.meta.url))
const { registerPublicationSafe } = await import(pathToFileURL(path.join(here, "_lib/register.mjs")).href)
const { resolveIgAccount, resolveIgUserId, fetchPermalink, assertMaxHashtags } = await import(pathToFileURL(path.join(here, "_lib/ig-account.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)

const IMAGE = args.find((a) => !a.startsWith("--") && /\.(png|jpe?g)$/i.test(a))
const CAPTION_FILE = flag("--caption-file")
const DRY = somentePrevia()

const USO = "Uso: node scripts/publishing/publish-ig-image.mjs <imagem.png|jpg> --caption-file <legenda.txt> [--account principal|business] [--dry-run]"
if (!IMAGE || !existsSync(IMAGE)) { console.error(`Faltou a imagem (.png ou .jpg), ou o arquivo nao existe${IMAGE ? ": " + IMAGE : ""}.
${USO}`); process.exit(1) }
if (!CAPTION_FILE || !existsSync(CAPTION_FILE)) { console.error(`Faltou --caption-file <legenda.txt>, ou o arquivo nao existe${CAPTION_FILE ? ": " + CAPTION_FILE : ""}.
${USO}`); process.exit(1) }
const BUCKET = "content-media"
let acct
try { acct = resolveIgAccount({ account: flag("--account") || "principal" }) } catch (e) { console.error(e.message); process.exit(1) }
const IG_API = acct.graph
const IG_TOKEN = acct.token
const CLIENT = exigirSlug("--client", flag("--client")) || acct.clientSlug
exigirSlug("--slug", flag("--slug"))

// PORTA BLOQUEANTE: legenda sempre de arquivo UTF-8, nunca inline no shell.
const caption = readFileSync(CAPTION_FILE, "utf8").trim()
if (/Ã.|Â./.test(caption)) { console.error("ABORT mojibake na legenda"); process.exit(1) }
try { assertMaxHashtags(caption) } catch (e) { console.error("ABORT:", e.message); process.exit(1) }
const acentos = (caption.match(/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g) || []).length
if (acentos === 0) { console.error("ABORT: nenhum acento lido, provavel leitura errada do arquivo"); process.exit(1) }
console.log(`[utf8-gate] ${acentos} acentos ok. Amostra: ${caption.slice(0, 60)}`)
console.log(`[legenda] ${caption.length} caracteres`)
console.log(`[imagem] ${IMAGE}`)

if (DRY) { console.log("\nDRY RUN: nada publicado."); process.exit(0) }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function igApi(endpoint, body) {
  const res = await fetch(`${IG_API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: IG_TOKEN }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`IG API: ${data.error.message}`)
  return data
}

async function waitForContainer(id) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${IG_API}/${id}?fields=status_code&access_token=${IG_TOKEN}`)
    const d = await r.json()
    if (d.status_code === "FINISHED") return
    if (d.status_code === "ERROR") throw new Error(`container ${id} falhou`)
    await new Promise((res) => setTimeout(res, 2000))
  }
  throw new Error("timeout no container")
}

async function main() {
  const IG_USER_ID = await resolveIgUserId(acct)
  const fileName = `${Date.now()}-${basename(IMAGE)}`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(fileName, readFileSync(IMAGE), { contentType: "image/png", upsert: true })
  if (error) throw new Error(`upload falhou: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  console.log("storage:", data.publicUrl)

  const { id } = await igApi(`/${IG_USER_ID}/media`, { image_url: data.publicUrl, caption })
  console.log("container:", id)
  await waitForContainer(id)

  const { id: postId } = await igApi(`/${IG_USER_ID}/media_publish`, { creation_id: id })
  const permalink = await fetchPermalink(acct, postId)
  console.log("PUBLICADO:", permalink)
  console.log("media_id:", postId)
  await registerPublicationSafe({
    client_slug: CLIENT, platform: "instagram", content_type: "image",
    title: flag("--slug") || basename(IMAGE, extname(IMAGE)),
    url: permalink, caption, media_urls: [data.publicUrl], source_agent: "publish-ig-image.mjs",
  })
}
main().catch((e) => { console.error("Erro:", e.message); process.exit(1) })
