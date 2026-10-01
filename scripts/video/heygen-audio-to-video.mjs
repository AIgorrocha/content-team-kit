#!/usr/bin/env node
/**
 * heygen-audio-to-video.mjs - Pipeline completo: audio local → HeyGen avatar video
 *
 * Uso:
 *   node scripts/video/heygen-audio-to-video.mjs /path/to/audio.mp3 [--avatar ID] [--client slug]
 *
 * Saida (stdout JSON):
 *   { "videoId": "xxx", "videoPath": "output/videos/heygen-xxx.mp4", "duration": 47 }
 *
 * Env vars (em .env.local): HEYGEN_API_KEY (obrigatoria), HEYGEN_AVATAR_ID (ou --avatar).
 * A voz e SEMPRE o audio real da pessoa (nunca TTS). O fundo vem da cor "Background"
 * de clients/{slug}/design-system.md (--client, ou a marca ativa do .workspace).
 */

import './_env.mjs'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { resolveClient } from '../_lib/workspace-client.mjs'
import { brandFor } from './_brand.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const VIDEO_DIR = resolve(ROOT, 'output/videos')
const AUDIO_DIR = resolve(ROOT, 'output/audios')

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY
const DEFAULT_AVATAR_ID = process.env.HEYGEN_AVATAR_ID // id do seu avatar no HeyGen

const POLL_INTERVAL_MS = 15_000
const MAX_POLL_ATTEMPTS = 40 // 10 min max

for (const dir of [VIDEO_DIR, AUDIO_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Uso: node scripts/video/heygen-audio-to-video.mjs /path/to/audio.mp3 [--avatar ID] [--client slug]')
    process.exit(1)
  }

  const audioPath = args[0]
  let avatarId = DEFAULT_AVATAR_ID

  const avatarIdx = args.indexOf('--avatar')
  if (avatarIdx !== -1 && args[avatarIdx + 1]) {
    avatarId = args[avatarIdx + 1]
  }

  const clientIdx = args.indexOf('--client')
  const slug = clientIdx !== -1 && args[clientIdx + 1] ? args[clientIdx + 1] : resolveClient()

  return { audioPath, avatarId, background: brandFor(slug).bg }
}

function ensureMp3(inputPath) {
  const ext = extname(inputPath).toLowerCase()
  if (ext === '.mp3') return inputPath

  const timestamp = Date.now()
  const mp3Path = resolve(AUDIO_DIR, `${timestamp}.mp3`)

  try {
    execFileSync(process.env.FFMPEG_BIN || 'ffmpeg', ['-i', inputPath, '-acodec', 'libmp3lame', '-q:a', '2', mp3Path, '-y'], {
      stdio: 'pipe'
    })
    console.error(`Convertido pra MP3: ${mp3Path}`)
    return mp3Path
  } catch (err) {
    throw new Error(`FFmpeg falhou: ${err.message}`)
  }
}

async function uploadAudio(audioPath) {
  const audioBuffer = readFileSync(audioPath)

  const res = await fetch('https://upload.heygen.com/v1/asset', {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'audio/mpeg'
    },
    body: audioBuffer
  })

  const data = await res.json()

  if (!data.data?.url) {
    throw new Error(`Upload falhou: ${JSON.stringify(data)}`)
  }

  console.error(`Audio uploaded: ${data.data.url}`)
  return data.data.url
}

async function generateVideo(audioUrl, avatarId, background) {
  const body = {
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal',
        avatar_version: 'v4'
      },
      voice: {
        type: 'audio',
        audio_url: audioUrl
      },
      background: { type: 'color', value: background }
    }],
    dimension: { width: 1080, height: 1920 }
  }

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()

  if (!data.data?.video_id) {
    throw new Error(`Gerar video falhou: ${JSON.stringify(data)}`)
  }

  console.error(`Video solicitado: ${data.data.video_id}`)
  return data.data.video_id
}

async function pollUntilReady(videoId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      { headers: { 'X-Api-Key': HEYGEN_API_KEY } }
    )
    const data = await res.json()
    const status = data.data?.status

    console.error(`Poll ${i + 1}/${MAX_POLL_ATTEMPTS}: ${status}`)

    if (status === 'completed') {
      return {
        videoUrl: data.data.video_url,
        duration: data.data.duration
      }
    }

    if (status === 'failed') {
      throw new Error(`HeyGen falhou: ${data.data?.error || 'erro desconhecido'}`)
    }
  }

  throw new Error(`Timeout: video nao ficou pronto em ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
}

async function downloadVideo(videoUrl, videoId) {
  const outputPath = resolve(VIDEO_DIR, `heygen-${videoId}.mp4`)
  const res = await fetch(videoUrl)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(outputPath, buffer)
  console.error(`Video salvo: ${outputPath} (${buffer.length} bytes)`)
  return outputPath
}

async function main() {
  if (!HEYGEN_API_KEY) {
    console.error('ERRO: HEYGEN_API_KEY nao configurada (.env.local)')
    process.exit(1)
  }

  const { audioPath, avatarId, background } = parseArgs()

  if (!avatarId) {
    console.error('ERRO: informe --avatar ID ou HEYGEN_AVATAR_ID no .env.local')
    process.exit(1)
  }

  if (!existsSync(audioPath)) {
    console.error(`ERRO: Arquivo nao encontrado: ${audioPath}`)
    process.exit(1)
  }

  console.error(`Iniciando pipeline HeyGen...`)
  console.error(`Audio: ${audioPath}`)
  console.error(`Avatar: ${avatarId}`)

  const mp3Path = ensureMp3(audioPath)
  const audioUrl = await uploadAudio(mp3Path)
  const videoId = await generateVideo(audioUrl, avatarId, background)
  const { videoUrl, duration } = await pollUntilReady(videoId)
  const videoPath = await downloadVideo(videoUrl, videoId)

  // Saida JSON no stdout (logs vao pra stderr)
  console.log(JSON.stringify({ videoId, videoPath, duration }))
}

main().catch(err => {
  console.error(`ERRO: ${err.message}`)
  process.exit(1)
})
