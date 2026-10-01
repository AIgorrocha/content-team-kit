#!/usr/bin/env node
/**
 * publish-ig-reel.mjs - Publicador reutilizavel de REEL no Instagram (Graph API) COM CAPA.
 *
 * REGRA (cross-post-capa-schema): reel NUNCA vai sem capa. Este script exige a capa
 * (--cover local, sobe pro Supabase Storage -> cover_url; ou --cover-url ja publico).
 * Sem capa ele RECUSA publicar (a menos que --no-cover explicito).
 *
 * Uso:
 *   node scripts/publishing/publish-ig-reel.mjs \
 *     --video-url <url_publica_mp4> \
 *     --caption-file content/<cli>/reels/<slug>/legenda-instagram.txt \
 *     --cover content/<cli>/reels/<slug>/capa.png \
 *     --account principal --client {slug-do-cliente} --slug <slug>
 *
 * Flags:
 *   --account <chave>    principal (padrao, INSTAGRAM_*) ou business (INSTAGRAM_BUSINESS_*)
 *   --video-url <url>     MP4 publico (Graph REELS exige URL publica; nao aceita upload de arquivo)
 *   --caption-file <f>    legenda (UTF-8). Alternativa: --caption "<texto>"
 *   --cover <path>        imagem local da capa -> sobe pro Supabase e usa como cover_url
 *   --cover-url <url>     capa ja publica (pula o upload)
 *   --client / --slug     path no Storage, log e registro da peca (--client padrao = marca ativa)
 *   --no-cover           publica SEM capa (so em emergencia; imprime aviso)
 *   --ig-user-id <id>     opcional (senao usa o id do .env.local ou resolve do token via /me)
 *   --trial               publica como TRIAL REEL (alcanca nao-seguidores, nao aparece no feed/grid)
 *   --graduation-strategy MANUAL (padrao) | SS_PERFORMANCE. So faz efeito com --trial
 *   --pode                publica de verdade (so depois do "pode" do dono); sem ele, so mostra o payload
 *   --dry-run             imprime o payload do container e sai, sem chamar a API
 *
 * Env: credenciais da conta escolhida, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { exigirSlug, somentePrevia } from "./_lib/guarda.mjs"

for (const envFile of [".env.local", ".env"]) {
  if (!existsSync(envFile)) continue
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "")
  }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const { registerPublicationSafe } = await import(pathToFileURL(path.join(here, "_lib/register.mjs")).href)
const { resolveIgAccount, resolveIgUserId, fetchPermalink, assertMaxHashtags } = await import(pathToFileURL(path.join(here, "_lib/ig-account.mjs")).href)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)

const VIDEO_URL = flag("--video-url")
let acct
try { acct = resolveIgAccount({ account: flag("--account") || "principal" }) } catch (e) { console.error(e.message); process.exit(1) }
const CLIENT = exigirSlug("--client", flag("--client")) || acct.clientSlug
const IG_TOKEN = acct.token
const GRAPH = acct.graph
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SLUG = exigirSlug("--slug", flag("--slug")) || "reel"
let CAPTION = flag("--caption") || ""
const capFile = flag("--caption-file")
if (capFile) { if (!existsSync(capFile)) { console.error("legenda nao encontrada:", capFile); process.exit(1) } CAPTION = readFileSync(capFile, "utf8").split(/\n-{3,}\n/)[0].trim() }
const COVER = flag("--cover")
let COVER_URL = flag("--cover-url")
const NO_COVER = has("--no-cover")
const TRIAL = has("--trial")
const GRADUATION = flag("--graduation-strategy") || "MANUAL"
const DRY_RUN = somentePrevia()
if (TRIAL && !["MANUAL", "SS_PERFORMANCE"].includes(GRADUATION)) {
  console.error("--graduation-strategy invalido:", GRADUATION, "(use MANUAL ou SS_PERFORMANCE)")
  process.exit(1)
}

try { assertMaxHashtags(CAPTION) } catch (e) { console.error("ABORT:", e.message); process.exit(1) }

if (!VIDEO_URL) { console.error("--video-url obrigatorio (MP4 publico)"); process.exit(1) }
if (!COVER && !COVER_URL && !NO_COVER) {
  console.error("SEM CAPA. Regra: reel nao vai sem capa. Passe --cover <capa.png> ou --cover-url <url> (ou --no-cover em emergencia).")
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function uploadCoverToStorage(localPath) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("SUPABASE_URL/SERVICE_ROLE_KEY faltando pra subir a capa")
  if (!existsSync(localPath)) throw new Error("capa local nao existe: " + localPath)
  const ext = localPath.toLowerCase().endsWith(".png") ? "png" : "jpg"
  const mime = ext === "png" ? "image/png" : "image/jpeg"
  const objectPath = `${CLIENT}/reels/${SLUG}-capa.${ext}`
  const bytes = readFileSync(localPath)
  const url = `${SUPABASE_URL}/storage/v1/object/ct-temp-media/${objectPath}`
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": mime, "x-upsert": "true" },
    body: bytes,
  })
  if (!res.ok && res.status !== 200) {
    const t = await res.text()
    // 400 "Duplicate" nao acontece com x-upsert; outros erros propagam
    throw new Error(`upload capa falhou (${res.status}): ${t}`)
  }
  return `${SUPABASE_URL}/storage/v1/object/public/ct-temp-media/${objectPath}`
}

async function waitFinished(containerId) {
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${IG_TOKEN}`)
    const j = await r.json()
    if (j.status_code === "FINISHED") return
    if (j.status_code === "ERROR") throw new Error("container ERROR no processamento do video")
    await sleep(5000)
  }
  throw new Error("timeout esperando FINISHED")
}

async function main() {
  if (COVER && !COVER_URL && DRY_RUN) {
    COVER_URL = `<capa ${COVER} sobe pro Storage ao publicar>`
  } else if (COVER && !COVER_URL) {
    console.log("[capa] subindo pro Supabase Storage...")
    COVER_URL = await uploadCoverToStorage(COVER)
    console.log("  cover_url:", COVER_URL)
  }
  const IG_USER_ID = await resolveIgUserId(acct, flag("--ig-user-id"))
  console.log(`[reel] client=${CLIENT} slug=${SLUG} caption ${CAPTION.length} chars`)

  // container REELS (UTF-8 safe via URLSearchParams)
  const p = new URLSearchParams()
  p.append("media_type", "REELS")
  p.append("video_url", VIDEO_URL)
  p.append("caption", CAPTION)
  p.append("share_to_feed", TRIAL ? "false" : "true")
  if (COVER_URL) p.append("cover_url", COVER_URL)
  if (TRIAL) p.append("trial_params", JSON.stringify({ graduation_strategy: GRADUATION }))
  p.append("access_token", IG_TOKEN)

  if (DRY_RUN) {
    const shown = Object.fromEntries(p)
    shown.access_token = "<REDACTED>"
    console.log("[dry-run] POST " + `${GRAPH}/${IG_USER_ID}/media`)
    console.log(JSON.stringify(shown, null, 2))
    return
  }

  console.log("[1] Criar container REELS" + (COVER_URL ? " (com capa)" : " (SEM capa)") + (TRIAL ? ` (TRIAL/${GRADUATION})` : "") + "...")
  const r1 = await fetch(`${GRAPH}/${IG_USER_ID}/media`, { method: "POST", body: p })
  const j1 = await r1.json()
  if (j1.error) throw new Error("container: " + JSON.stringify(j1.error))
  console.log("  container:", j1.id)

  console.log("[2] Aguardar FINISHED...")
  await waitFinished(j1.id)

  console.log("[3] Publicar...")
  const r2 = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: j1.id, access_token: IG_TOKEN }),
  })
  const j2 = await r2.json()
  if (j2.error) throw new Error("publish: " + JSON.stringify(j2.error))

  const permalink = await fetchPermalink(acct, j2.id)
  console.log(TRIAL ? `PUBLICADO (TRIAL REEL / ${GRADUATION})` : "PUBLICADO", permalink)
  console.log("MEDIA_ID", j2.id)
  if (TRIAL && GRADUATION === "MANUAL") console.log(">>> Trial reel: nao aparece no feed/grid. Promover manual no app quando quiser.")
  if (!COVER_URL) console.log(">>> ATENCAO: publicado SEM capa. Troque manual no app ou republique com --cover.")

  await registerPublicationSafe({
    client_slug: CLIENT, platform: "instagram", content_type: "reel",
    title: SLUG, url: permalink, caption: CAPTION,
    media_urls: [VIDEO_URL],
    source_agent: "publish-ig-reel.mjs", metadata: TRIAL ? { trial: true, graduation_strategy: GRADUATION } : {},
  })
}

main().catch((e) => { console.error("Erro:", e.message); process.exit(1) })
