import { config } from 'dotenv'
config({ quiet: true, path: '.env.local', override: true }); config({ quiet: true, path: '.env' })
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const { registerPublicationSafe } = await import(pathToFileURL(path.join(here, '_lib/register.mjs')).href)
const { resolveIgAccount, resolveIgUserId, fetchPermalink, assertMaxHashtags } = await import(pathToFileURL(path.join(here, '_lib/ig-account.mjs')).href)

// --- Args ---
const args = process.argv.slice(2)
const flag = (n) => { const i = args.findIndex(a => a === n || a.startsWith(n + '=')); if (i < 0) return null; const a = args[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[i + 1] }
const has = (n) => args.includes(n)
// item = caminho/url; o valor de "--flag valor" (sem "=") nao conta como item
const VALUE_FLAGS = ['--account', '--client', '--slug', '--caption', '--caption-file', '--bucket', '--prefix', '--ig-user-id']
const items = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]))
const DRY_RUN = has('--dry-run')
const SLUG = flag('--slug') || 'carrossel'
const captionFlag = flag('--caption')
const captionFileFlag = flag('--caption-file')
// PORTA BLOQUEANTE: preferir sempre --caption-file (arquivo UTF-8), nunca inline no shell
const caption = captionFileFlag
  ? readFileSync(captionFileFlag, 'utf8').split(/\n-{3,}\n/)[0].trim()
  : (captionFlag || '')

if (/Ã.|Â./.test(caption)) {
  console.error('❌ MOJIBAKE detectado na legenda. Abortando antes de publicar.')
  process.exit(1)
}

try { assertMaxHashtags(caption) } catch (e) { console.error('❌', e.message); process.exit(1) }

if (items.length < 2) {
  console.log('Uso: node scripts/publishing/post-carousel.mjs img1.png video2.mp4 ... --caption-file=legenda.txt [--account principal|business] [--client slug] [--slug nome] [--dry-run]')
  console.log('Item pode ser caminho local (sobe pro Supabase) OU url publica ja pronta (reusa direto). Min 2, max 10 se tiver video.')
  process.exit(1)
}

// --- Conta escolhida pela chave (--account principal|business, padrao principal) ---
let acct
try { acct = resolveIgAccount({ account: flag('--account') || 'principal' }) } catch (e) { console.error('Erro:', e.message); process.exit(1) }
const CLIENT = flag('--client') || acct.clientSlug
const IG_TOKEN = acct.token
const GRAPH = acct.graph

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = flag('--bucket') || 'content-media'
const PREFIX = flag('--prefix') || `${CLIENT}/carousels/${SLUG}/`
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY) ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null

function isVideo(pathOrUrl) { return /\.mp4(\?|$)/i.test(pathOrUrl) }

// --- Helpers ---
async function uploadToSupabase(filePath) {
  if (!supabase) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY faltando pra subir midia local')
  const fileName = `${PREFIX}${basename(filePath)}`
  const fileBuffer = readFileSync(filePath)
  const contentType = isVideo(filePath) ? 'video/mp4'
    : /\.jpe?g$/i.test(filePath) ? 'image/jpeg'
    : 'image/png'

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, fileBuffer, { contentType, upsert: true })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return data.publicUrl
}

async function igApi(endpoint, body) {
  const res = await fetch(`${GRAPH}${endpoint}`, {
    method: 'POST',
    body: new URLSearchParams({ ...body, access_token: IG_TOKEN }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`IG API: ${JSON.stringify(data.error)}`)
  return data
}

async function waitForContainer(containerId, { tries = 30, intervalMs = 2000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${IG_TOKEN}`)
    const data = await res.json()
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR') throw new Error(`Container ${containerId} falhou`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Timeout aguardando container')
}

async function postCarousel(mediaItems, caption, igUserId) {
  const hasVideo = mediaItems.some(isVideo)
  if (hasVideo && mediaItems.length > 10) throw new Error('Carrossel com video: maximo 10 itens (limite real do Instagram).')
  if (!hasVideo && mediaItems.length > 20) throw new Error('Instagram permite no maximo 20 imagens por carrossel.')

  // 1. Upload pro Supabase (so quem for caminho local; url http(s) e reusada direto)
  console.log(`\n📤 Resolvendo ${mediaItems.length} midias (upload so das locais)...`)
  const urls = []
  for (const m of mediaItems) {
    if (/^https?:\/\//i.test(m)) { console.log(`  ↪ ${m} (ja publica)`); urls.push(m); continue }
    if (!existsSync(m)) throw new Error(`arquivo local nao existe: ${m}`)
    const url = await uploadToSupabase(m)
    console.log(`  ✅ ${basename(m)} → ${url}`)
    urls.push(url)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Nao vai chamar a Graph API. Plano:')
    urls.forEach((u, i) => console.log(`  [${i + 1}] ${isVideo(u) ? 'VIDEO' : 'IMAGE'} ${u}`))
    console.log(`  caption (${caption.length} chars):\n${caption}`)
    console.log(`  POST ${GRAPH}/${igUserId}/media (media_type=CAROUSEL, children=<${urls.length} ids>)`)
    return { permalink: null, dryRun: true, urls }
  }

  // 2. Criar container pra cada item (imagem OU video)
  console.log('\n📦 Criando containers no Instagram...')
  const childIds = []
  for (const url of urls) {
    const body = isVideo(url)
      ? { media_type: 'VIDEO', video_url: url, is_carousel_item: 'true' }
      : { image_url: url, is_carousel_item: 'true' }
    const { id } = await igApi(`/${igUserId}/media`, body)
    console.log(`  📦 Container: ${id} (${isVideo(url) ? 'video' : 'imagem'})`)
    childIds.push(id)
  }

  // 3. Aguardar cada container ficar pronto (video demora mais)
  console.log('\n⏳ Aguardando processamento...')
  for (let i = 0; i < childIds.length; i++) {
    await waitForContainer(childIds[i], isVideo(urls[i]) ? { tries: 60, intervalMs: 5000 } : {})
  }

  // 4. Criar carrossel
  console.log('\n🎠 Criando carrossel...')
  const { id: carouselId } = await igApi(`/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  })
  console.log(`  🎠 Carrossel: ${carouselId}`)
  await waitForContainer(carouselId)

  // 5. Publicar
  console.log('\n🚀 Publicando...')
  const { id: postId } = await igApi(`/${igUserId}/media_publish`, { creation_id: carouselId })

  // 6. Buscar permalink
  const post = { permalink: await fetchPermalink(acct, postId) }

  console.log(`\n✅ PUBLICADO!`)
  console.log(`📎 ${post.permalink}`)

  await registerPublicationSafe({
    client_slug: CLIENT,
    platform: 'instagram',
    content_type: 'carousel',
    title: SLUG,
    url: post.permalink,
    caption,
    media_urls: urls,
    source_agent: 'post-carousel.mjs',
  })

  return { ...post, urls, mediaId: postId }
}

// --- Main ---
const igUserId = await resolveIgUserId(acct, flag('--ig-user-id')).catch(err => { console.error('❌ Erro:', err.message); process.exit(1) })
postCarousel(items, caption, igUserId).catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
