/**
 * Sincroniza mídia local (imagens, vídeos) e legendas por plataforma
 * das pastas content/ para o Supabase Storage + banco de dados.
 *
 * Uso: node scripts/publishing/sync-content-media.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readdir, readFile, stat } from 'fs/promises'
import { join, extname } from 'path'
import dotenv from 'dotenv'
import { resolveClient } from '../_lib/workspace-client.mjs'

dotenv.config({ quiet: true, path: '.env.local' })
dotenv.config({ quiet: true })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'content-media'
const CLIENT_SLUG = resolveClient()
const CONTENT_ROOT = join(process.cwd(), 'content', CLIENT_SLUG)

const MEDIA_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.mov', '.webm']
const CAPTION_FILES = {
  'legenda-instagram.txt': 'instagram',
  'legenda-tiktok.txt': 'tiktok',
  'legenda-threads.txt': 'threads',
  'youtube-shorts.txt': 'youtube',
  'post-linkedin.txt': 'linkedin',
  'legenda-cowork.txt': 'instagram',
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) throw new Error(`Erro criando bucket: ${error.message}`)
    console.log(`Bucket '${BUCKET}' criado`)
  }
}

async function uploadFile(localPath, storagePath) {
  const fileData = await readFile(localPath)
  const ext = extname(localPath).toLowerCase()
  const contentType = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.gif' ? 'image/gif'
    : ext === '.mp4' ? 'video/mp4'
    : ext === '.mov' ? 'video/quicktime'
    : ext === '.webm' ? 'video/webm'
    : 'application/octet-stream'

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileData, { contentType, upsert: true })

  if (error) {
    console.error(`  Erro upload ${storagePath}: ${error.message}`)
    return null
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return urlData.publicUrl
}

async function findContentInDB(title, contentType) {
  const { data } = await supabase
    .from('ct_content_items')
    .select('id, title')
    .ilike('title', `%${title}%`)
    .eq('content_type', contentType)
    .limit(1)

  return data?.[0] ?? null
}

function slugToTitle(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

async function processFolder(folderPath, contentType, clientSlug) {
  const folderName = folderPath.split(/[/\\]/).pop()
  console.log(`\nProcessando: ${contentType}/${folderName}`)

  const files = await readdir(folderPath)
  const mediaFiles = files.filter(f => MEDIA_EXTENSIONS.includes(extname(f).toLowerCase()))
  const captionFiles = files.filter(f => Object.keys(CAPTION_FILES).includes(f))

  if (mediaFiles.length === 0 && captionFiles.length === 0) {
    console.log('  Sem mídia ou legendas, pulando')
    return
  }

  // Buscar item no banco
  const searchTitle = slugToTitle(folderName)
  let dbItem = await findContentInDB(folderName.replace(/-/g, ' '), contentType)

  if (!dbItem) {
    // Tentar busca mais ampla
    const words = folderName.split('-').filter(w => w.length > 3).slice(0, 3)
    for (const word of words) {
      dbItem = await findContentInDB(word, contentType)
      if (dbItem) break
    }
  }

  if (!dbItem) {
    console.log(`  Item nao encontrado no banco pra "${folderName}" (${contentType})`)
    return
  }

  console.log(`  Encontrado: ${dbItem.title} (${dbItem.id.substring(0, 8)}...)`)

  // Upload mídias
  const mediaUrls = []
  const sortedMedia = mediaFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] ?? '0')
    const numB = parseInt(b.match(/\d+/)?.[0] ?? '0')
    return numA - numB
  })

  for (const file of sortedMedia) {
    // Pular fotos de perfil
    if (file.includes('profile-photo') || file.includes('profile')) continue

    const storagePath = `${clientSlug}/${contentType}/${folderName}/${file}`
    const url = await uploadFile(join(folderPath, file), storagePath)
    if (url) {
      mediaUrls.push(url)
      console.log(`  Uploaded: ${file}`)
    }
  }

  // Ler legendas por plataforma
  const captionsByPlatform = {}
  for (const file of captionFiles) {
    const platform = CAPTION_FILES[file]
    const text = await readFile(join(folderPath, file), 'utf-8')
    captionsByPlatform[platform] = text.trim()
    console.log(`  Legenda ${platform}: ${text.trim().length} chars`)
  }

  // Atualizar banco
  const updates = {}
  if (mediaUrls.length > 0) updates.media_urls = mediaUrls
  if (Object.keys(captionsByPlatform).length > 0) updates.captions_by_platform = captionsByPlatform

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('ct_content_items')
      .update(updates)
      .eq('id', dbItem.id)

    if (error) {
      console.error(`  Erro atualizando banco: ${error.message}`)
    } else {
      console.log(`  Banco atualizado: ${mediaUrls.length} mídias, ${Object.keys(captionsByPlatform).length} legendas`)
    }
  }
}

async function main() {
  console.log('=== Sync Content Media ===\n')

  await ensureBucket()

  const contentTypes = ['carousels', 'reels', 'posts']
  const dbContentType = { carousels: 'carousel', reels: 'reel', posts: 'post' }

  for (const type of contentTypes) {
    const typePath = join(CONTENT_ROOT, type)
    try {
      const folders = await readdir(typePath)
      for (const folder of folders) {
        const folderPath = join(typePath, folder)
        const s = await stat(folderPath)
        if (s.isDirectory()) {
          await processFolder(folderPath, dbContentType[type], CLIENT_SLUG)
        }
      }
    } catch {
      console.log(`Pasta ${type} não encontrada, pulando`)
    }
  }

  console.log('\n=== Sincronização completa ===')
}

main().catch(console.error)
