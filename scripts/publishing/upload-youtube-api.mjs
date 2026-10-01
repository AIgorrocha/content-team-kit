#!/usr/bin/env node
/**
 * upload-youtube-api.mjs - Upload de vídeo pro YouTube via Data API v3 (OAuth refresh token)
 * Serve pra QUALQUER vídeo (longo ou Short), não só um projeto específico.
 *
 * Uso: node scripts/publishing/upload-youtube-api.mjs <video> <titulo.txt> <descricao.txt> [tags.txt] [--long] [--client slug]
 * --long: imprime a URL como vídeo longo (watch?v=) em vez de /shorts/
 * --client: marca da peca no registro (padrao: marca ativa)
 * Depois de publicar, registra a peca em ct_content_items (sem banco configurado, so avisa).
 */
import { config } from 'dotenv'
config({ path: '.env.local', override: true })
config({ path: '.env' })
import { google } from 'googleapis'
import { readFileSync, createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '_lib/register.mjs')).href)

const rawArgs = process.argv.slice(2)
const clientIdx = rawArgs.indexOf('--client')
const CLIENT = clientIdx >= 0 ? rawArgs[clientIdx + 1] : null
const argv = rawArgs.filter((a, i) => a !== '--long' && a !== '--client' && !(clientIdx >= 0 && i === clientIdx + 1))
const IS_LONG = rawArgs.includes('--long')
const [VIDEO, TITULO_FILE, DESC_FILE, TAGS_FILE] = argv

if (!VIDEO || !TITULO_FILE || !DESC_FILE) {
  console.error('Uso: node upload-youtube-api.mjs <video.mp4> <titulo.txt> <descricao.txt> [tags.txt] [--long]')
  process.exit(1)
}

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env
if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
  console.error('Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN no .env')
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET)
oauth2.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN })

const youtube = google.youtube({ version: 'v3', auth: oauth2 })

const titulo = readFileSync(TITULO_FILE, 'utf8').trim()
const descricao = readFileSync(DESC_FILE, 'utf8').trim()
const tags = TAGS_FILE
  ? readFileSync(TAGS_FILE, 'utf8').split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  : []

const sizeMB = (statSync(VIDEO).size / 1024 / 1024).toFixed(1)
console.log(`Arquivo: ${VIDEO} (${sizeMB} MB)`)
console.log(`Titulo: ${titulo}`)
console.log(`Tags: ${tags.length}`)
console.log(`Iniciando upload...`)

async function insert(withTags) {
  return youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: titulo,
        description: descricao,
        tags: withTags ? tags : undefined,
        categoryId: '28', // Science & Technology
        defaultLanguage: 'pt-BR',
        defaultAudioLanguage: 'pt-BR'
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
        embeddable: true,
        license: 'youtube'
      }
    },
    media: {
      body: createReadStream(VIDEO)
    }
  }, {
    onUploadProgress: (evt) => {
      const pct = ((evt.bytesRead / statSync(VIDEO).size) * 100).toFixed(1)
      process.stdout.write(`\r  ${pct}% (${(evt.bytesRead / 1024 / 1024).toFixed(1)} MB)   `)
    }
  })
}

// 06/set/2026: o YouTube às vezes rejeita o lote de tags inteiro com
// "invalidTags" sem dizer qual tag é o problema. Workaround: sobe sem tags,
// depois aplica cada tag uma por vez via videos.update (isola a tag ruim
// em vez de travar o upload inteiro).
let res
try {
  res = await insert(tags.length > 0)
} catch (e) {
  const reason = e?.errors?.[0]?.reason || e?.response?.data?.error?.errors?.[0]?.reason
  if (reason !== 'invalidTags' || tags.length === 0) throw e
  console.log(`\ninvalidTags no lote inteiro, subindo sem tags e aplicando uma a uma...`)
  res = await insert(false)
  const applied = []
  for (const tag of tags) {
    try {
      await youtube.videos.update({ part: ['snippet'], requestBody: { id: res.data.id, snippet: { title: titulo, description: descricao, categoryId: '28', tags: [...applied, tag] } } })
      applied.push(tag)
    } catch {
      console.log(`  tag rejeitada, pulando: ${tag}`)
    }
  }
  console.log(`  tags aplicadas: ${applied.length}/${tags.length}`)
}

console.log('\nPUBLICADO')
console.log(`Video ID: ${res.data.id}`)
console.log(`URL: https://youtube.com/${IS_LONG ? 'watch?v=' : 'shorts/'}${res.data.id}`)
console.log(`Studio: https://studio.youtube.com/video/${res.data.id}/edit`)

await registerPublicationSafe({
  client_slug: CLIENT,
  platform: 'youtube',
  content_type: IS_LONG ? 'video' : 'short',
  title: titulo,
  url: `https://youtube.com/${IS_LONG ? 'watch?v=' : 'shorts/'}${res.data.id}`,
  caption: descricao,
  hashtags: tags.length ? tags : null,
  source_agent: 'upload-youtube-api.mjs',
})
