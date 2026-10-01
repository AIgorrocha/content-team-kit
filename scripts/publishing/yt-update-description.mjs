#!/usr/bin/env node
/**
 * yt-update-description.mjs - le ou atualiza a DESCRICAO de um video ja publicado.
 *   node scripts/publishing/yt-update-description.mjs read <videoId>
 *   node scripts/publishing/yt-update-description.mjs write <videoId> <arquivo-descricao.txt>
 * Precisa de YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e YOUTUBE_REFRESH_TOKEN (youtube-auth.mjs).
 * Mostre a descricao nova para a pessoa e espere o "pode" antes de rodar o write.
 * videos.update exige o snippet inteiro (title + categoryId), entao lemos antes e reenviamos.
 */
import { config } from 'dotenv'
config({ quiet: true, path: '.env.local', override: true })
config({ quiet: true, path: '.env' })
import { google } from 'googleapis'
import { readFileSync } from 'node:fs'
import { somentePrevia } from "./_lib/guarda.mjs"

const [, , MODE, VIDEO_ID, DESC_FILE] = process.argv
const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env
if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
  console.error('Missing YOUTUBE_* no .env'); process.exit(1)
}
const oauth2 = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET)
oauth2.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN })
const youtube = google.youtube({ version: 'v3', auth: oauth2 })

const fetchSnippet = async () => {
  const r = await youtube.videos.list({ part: ['snippet', 'status'], id: [VIDEO_ID] })
  const v = r.data.items?.[0]
  if (!v) { console.error('Video nao encontrado ou sem acesso:', VIDEO_ID); process.exit(1) }
  return v
}

if (MODE === 'read') {
  const v = await fetchSnippet()
  console.log(JSON.stringify({ id: v.id, channelTitle: v.snippet.channelTitle, title: v.snippet.title, categoryId: v.snippet.categoryId, tags: v.snippet.tags, privacyStatus: v.status.privacyStatus }, null, 2))
  console.log('---DESCRICAO---')
  console.log(v.snippet.description)
} else if (MODE === 'write') {
  const desc = readFileSync(DESC_FILE, 'utf8').replace(/\r\n/g, '\n').trim()
  if (somentePrevia()) { console.log('---DESCRICAO NOVA---\n' + desc); process.exit(0) }
  const v = await fetchSnippet()
  const res = await youtube.videos.update({
    part: ['snippet'],
    requestBody: {
      id: VIDEO_ID,
      snippet: {
        title: v.snippet.title,
        description: desc,
        tags: v.snippet.tags,
        categoryId: v.snippet.categoryId,
        defaultLanguage: v.snippet.defaultLanguage,
        defaultAudioLanguage: v.snippet.defaultAudioLanguage,
      },
    },
  })
  console.log('UPDATE OK. Descricao gravada, tamanho:', res.data.snippet.description.length)
} else {
  console.error('Uso: read <videoId> | write <videoId> <arquivo.txt> [--pode]'); process.exit(1)
}
