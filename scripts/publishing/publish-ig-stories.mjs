#!/usr/bin/env node
/**
 * publish-ig-stories.mjs - Publicador de STORIES (imagem) no Instagram via Graph API.
 *
 * Publica N stories de imagem EM ORDEM (uma por vez, com delay), pra manter a
 * sequencia correta no viewer. Story de imagem NAO tem caption/legenda pela API:
 * o texto tem que estar na propria imagem.
 *
 * Uso:
 *   node scripts/publishing/publish-ig-stories.mjs \
 *     --account principal --client {slug-do-cliente} --slug meu-arco \
 *     --image-url https://.../story-01.png \
 *     --image-url https://.../story-02.png \
 *     --image-url https://.../story-03.png \
 *     --image-url https://.../story-04.png
 *
 * Flags:
 *   --image-url <url>   URL publica de imagem (PNG/JPG). Repetir na ordem de publicacao.
 *   --account <chave>   principal (padrao, INSTAGRAM_*) ou business (INSTAGRAM_BUSINESS_*, token EAAN ok).
 *   --client / --slug   log e registro no banco (--client padrao = marca ativa).
 *   --arc <nome>        arco narrativo gravado no metadata (padrao = o valor de --slug).
 *   --pode              publica de verdade (so depois do "pode" do dono); sem ele, so lista as telas
 *   --dry-run           cria o container do 1o story e NAO publica (prova token/permissao).
 *   --delay-ms <n>      intervalo entre stories (default 4000).
 *   --ig-user-id <id>   opcional (senao usa o id do .env.local ou resolve do token via /me).
 *
 * Env: credenciais da conta escolhida, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { exigirSlug, somentePrevia } from "./_lib/guarda.mjs"
config({ quiet: true, path: ".env.local", override: true }); config({ quiet: true, path: ".env" })
const here = path.dirname(fileURLToPath(import.meta.url))
const { registerPublicationSafe } = await import(pathToFileURL(path.join(here, "_lib/register.mjs")).href)
const { resolveIgAccount, resolveIgUserId, fetchPermalink } = await import(pathToFileURL(path.join(here, "_lib/ig-account.mjs")).href)

const args = process.argv.slice(2)
const flagAll = (n) => args.reduce((a, v, i) => (v === n && args[i + 1] ? [...a, args[i + 1]] : a), [])
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const has = (n) => args.includes(n)

let acct
try { acct = resolveIgAccount({ account: flag("--account") || "principal" }) } catch (e) { console.error(e.message); process.exit(1) }
const GRAPH = acct.graph
const IG_TOKEN = acct.token

const IMAGES = flagAll("--image-url")
const CLIENT = exigirSlug("--client", flag("--client")) || acct.clientSlug
const SLUG = exigirSlug("--slug", flag("--slug")) || "stories"
const ARC = flag("--arc") || SLUG
const DRY = has("--dry-run")
const PREVIA = somentePrevia()
const DELAY = parseInt(flag("--delay-ms") || "4000", 10)
if (IMAGES.length === 0) { console.error("passe pelo menos um --image-url"); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function createContainer(igUserId, imageUrl) {
  const p = new URLSearchParams()
  p.append("image_url", imageUrl)
  p.append("media_type", "STORIES")
  p.append("access_token", IG_TOKEN)
  const r = await fetch(`${GRAPH}/${igUserId}/media`, { method: "POST", body: p })
  const j = await r.json()
  if (j.error) throw new Error("container STORIES: " + JSON.stringify(j.error))
  return j.id
}

async function waitFinished(containerId) {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${IG_TOKEN}`)
    const j = await r.json()
    if (j.status_code === "FINISHED") return
    if (j.status_code === "ERROR") throw new Error("container ERROR no processamento")
    await sleep(3000)
  }
  // imagem geralmente fica FINISHED rapido; se nao, segue tentando publicar mesmo assim
}

async function publish(igUserId, creationId) {
  const r = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: IG_TOKEN }),
  })
  const j = await r.json()
  if (j.error) throw new Error("publish: " + JSON.stringify(j.error))
  return j.id
}

// Um registro por story, cada um com o permalink (sem ele a peca nao cruza com metrica).
// Permalink de story nao vira chave de join: o registro avisa, mas grava.
async function registerStories(published) {
  for (let i = 0; i < published.length; i++) {
    const { mediaId, permalink } = published[i]
    await registerPublicationSafe({
      client_slug: CLIENT, platform: "instagram", content_type: "story",
      title: `Story ${SLUG} ${i + 1}/${IMAGES.length}`,
      url: permalink || `instagram-story:${mediaId}`, media_urls: [IMAGES[i]],
      source_agent: "publish-ig-stories.mjs",
      metadata: { slug: SLUG, arc: ARC, media_id: mediaId, tela: i + 1, total: IMAGES.length },
    })
  }
}

async function main() {
  const IG_USER_ID = await resolveIgUserId(acct, flag("--ig-user-id"))
  console.log(`[stories] client=${CLIENT} slug=${SLUG} telas=${IMAGES.length} ig_user=${IG_USER_ID}`)

  if (PREVIA && !DRY) {
    console.log("[pre-visualizacao] stories que seriam publicados, em ordem:")
    IMAGES.forEach((u, i) => console.log(`  [${i + 1}/${IMAGES.length}] ${u}`))
    return
  }
  if (DRY) {
    console.log("[dry-run] criando container do 1o story (NAO publica)...")
    const cid = await createContainer(IG_USER_ID, IMAGES[0])
    console.log("[dry-run] OK - container criado sem erro 190/permissao:", cid)
    console.log("[dry-run] token publica story. Nada foi publicado.")
    return
  }

  const published = []
  for (let i = 0; i < IMAGES.length; i++) {
    const n = i + 1
    console.log(`[${n}/${IMAGES.length}] container...`, IMAGES[i])
    const cid = await createContainer(IG_USER_ID, IMAGES[i])
    await waitFinished(cid)
    const mediaId = await publish(IG_USER_ID, cid)
    published.push({ mediaId, permalink: await fetchPermalink(acct, mediaId) })
    console.log(`[${n}/${IMAGES.length}] PUBLICADO media_id=${mediaId}`)
    if (i < IMAGES.length - 1) await sleep(DELAY)
  }
  console.log("TODOS PUBLICADOS:", published.map((p) => p.mediaId).join(","))
  await registerStories(published)
}

main().catch((e) => { console.error("Erro:", e.message); process.exit(1) })
