/**
 * process-video.mjs
 * Processa video do YouTube Longo: transcreve, identifica cortes,
 * gera scripts pra TikTok/Shorts/Reels/LinkedIn com angulos diferentes.
 *
 * Uso: node scripts/video/process-video.mjs --url="https://youtube.com/watch?v=XXX"
 * Ou:  node scripts/video/process-video.mjs --file="/path/to/video.mp4"
 */
import './_env.mjs'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')
const CAPTIONS_BASE = join(tmpdir(), 'yt-captions')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function parseArgs() {
  const args = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w[\w-]*)=(.+)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

async function getYouTubeCaptions(url) {
  try {
    // Tenta usar yt-dlp pra baixar legendas
    // Sem shell: a URL vai em array, depois de "--", e so http(s) e aceito.
    if (!/^https?:\/\//i.test(url)) throw new Error('URL invalida (so http ou https)')
    execFileSync(
      'yt-dlp',
      ['--skip-download', '--write-auto-subs', '--sub-lang', 'pt,en', '--sub-format', 'json3', '-o', CAPTIONS_BASE, '--', url],
      { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'], shell: false }
    )
    console.log('  Legendas baixadas via yt-dlp')

    // Tentar ler legendas em PT ou EN
    for (const lang of ['pt', 'en']) {
      try {
        const captionsFile = `${CAPTIONS_BASE}.${lang}.json3`
        const data = JSON.parse(readFileSync(captionsFile, 'utf8'))
        return data.events
          ?.filter(e => e.segs)
          .map(e => ({
            time: Math.floor((e.tStartMs || 0) / 1000),
            text: e.segs.map(s => s.utf8).join('').trim()
          }))
          .filter(e => e.text)
      } catch { continue }
    }
  } catch (err) {
    console.warn('  yt-dlp falhou, tentando alternativa:', err.message)
  }
  return null
}

async function transcribeWithWhisper(filePath) {
  if (!OPENAI_API_KEY) {
    console.warn('  ⚠️  OPENAI_API_KEY nao configurada, Whisper indisponivel')
    return null
  }

  console.log('  🎤 Transcrevendo com Whisper API...')
  try {
    const fileBuffer = readFileSync(filePath)
    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), 'audio.mp4')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    })

    const data = await res.json()
    return data.segments?.map(s => ({
      time: Math.floor(s.start),
      text: s.text.trim()
    })) || null
  } catch (err) {
    console.warn('  Whisper falhou:', err.message)
    return null
  }
}

function identifyCuts(transcript) {
  if (!transcript || transcript.length === 0) return []

  // Agrupa em blocos de ~30s
  const blocks = []
  let currentBlock = { startTime: 0, text: '', segments: [] }

  for (const seg of transcript) {
    currentBlock.segments.push(seg)
    currentBlock.text += ' ' + seg.text

    if (seg.time - currentBlock.startTime >= 30 || seg === transcript[transcript.length - 1]) {
      blocks.push({ ...currentBlock })
      currentBlock = { startTime: seg.time, text: '', segments: [] }
    }
  }

  // Seleciona os 4 melhores blocos (por "interesse" heuristico)
  const scored = blocks.map(b => ({
    ...b,
    score: (b.text.match(/\?/g) || []).length * 2 + // perguntas
      (b.text.match(/!/g) || []).length * 1.5 + // exclamacoes
      (b.text.match(/\d+/g) || []).length * 1 + // numeros/dados
      (b.text.length > 100 ? 1 : 0) // conteudo substancial
  }))

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((block, i) => {
      const angles = [
        { platform: 'tiktok', angle: 'Momento mais impactante / demo rapida', duration: '21-34s', avatar: 'avatar_casual' },
        { platform: 'youtube_shorts', angle: 'Dica pratica isolada + CTA pro video completo', duration: '30-60s', avatar: 'avatar_formal' },
        { platform: 'instagram_reels', angle: 'Bastidor ou resultado visual', duration: '15-30s', avatar: 'avatar_casual' },
        { platform: 'linkedin', angle: 'Insight principal em texto (NAO video)', duration: 'n/a', avatar: 'n/a' }
      ]
      return {
        ...angles[i],
        startTime: block.startTime,
        endTime: block.startTime + (block.segments.length > 0
          ? block.segments[block.segments.length - 1].time - block.startTime + 5
          : 30),
        transcript: block.text.trim()
      }
    })
}

function generateCutScripts(cuts, tema) {
  return cuts.map(cut => {
    if (cut.platform === 'linkedin') {
      return {
        ...cut,
        script: `Gravei um video sobre ${tema} e o insight principal e este:\n\n${cut.transcript.substring(0, 500)}\n\nO video completo esta no meu YouTube (link na bio).\n\nO que voce acha desse ponto?\n\n#IAparaNegócios #Automação #Produtividade #ConsultorIA #GestãoInteligente`
      }
    }

    return {
      ...cut,
      script: `[CORTE: ${cut.startTime}s - ${cut.endTime}s]\n\n[HOOK - 1s] ${cut.transcript.split('.')[0]}\n\n[CONTEUDO - ${cut.duration}]\n${cut.transcript.substring(0, 300)}\n\n[CTA] Link na bio pro video completo!\n\nAvatar: ${cut.avatar}\nAngulo: ${cut.angle}`
    }
  })
}

async function main() {
  const args = parseArgs()
  const videoUrl = args.url
  const videoFile = args.file
  const tema = args.tema || 'Video YouTube'

  if (!videoUrl && !videoFile) {
    console.log('Uso:')
    console.log('  node scripts/video/process-video.mjs --url="https://youtube.com/watch?v=XXX" [--tema="Tema"]')
    console.log('  node scripts/video/process-video.mjs --file="/path/to/video.mp4" [--tema="Tema"]')
    process.exit(1)
  }

  console.log(`🎬 Process Video - Tema: "${tema}"`)
  console.log(`📅 ${new Date().toISOString()}\n`)

  // 1. Transcrever
  let transcript = null

  if (videoUrl) {
    console.log('📝 Obtendo transcricao do YouTube...')
    transcript = await getYouTubeCaptions(videoUrl)
  }

  if (!transcript && videoFile) {
    console.log('📝 Transcrevendo arquivo de video...')
    transcript = await transcribeWithWhisper(videoFile)
  }

  if (!transcript) {
    console.log('⚠️  Nao conseguiu transcrever. Crie os scripts manualmente.')
    console.log('  Dica: instale yt-dlp ou configure OPENAI_API_KEY pro Whisper')
    process.exit(1)
  }

  console.log(`✅ Transcricao: ${transcript.length} segmentos\n`)

  // 2. Identificar cortes
  console.log('✂️  Identificando momentos-chave...')
  const cuts = identifyCuts(transcript)
  console.log(`  ${cuts.length} cortes identificados\n`)

  // 3. Gerar scripts
  console.log('📝 Gerando scripts por plataforma...')
  const scripts = generateCutScripts(cuts, tema)

  // 4. Salvar em content/videos/
  const slug = tema.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-')
  const outputDir = resolve(ROOT, 'output', 'video-cortes', slug)
  mkdirSync(outputDir, { recursive: true })

  for (const script of scripts) {
    const filename = `${script.platform}-script.md`
    const content = `# ${script.platform.toUpperCase()} - ${tema}\n\nAngulo: ${script.angle}\nDuracao: ${script.duration}\nAvatar: ${script.avatar}\nCorte: ${script.startTime}s - ${script.endTime}s\n\n---\n\n${script.script}`
    writeFileSync(resolve(outputDir, filename), content)
    console.log(`  ✅ ${filename}`)
  }

  // Salvar transcricao completa
  writeFileSync(
    resolve(outputDir, 'transcricao.txt'),
    transcript.map(s => `[${s.time}s] ${s.text}`).join('\n')
  )
  console.log('  ✅ transcricao.txt')

  // 5. Salvar no Supabase
  for (const script of scripts) {
    await supabase.from('ct_content_items').insert({
      title: `${tema} - ${script.platform}`,
      platform: script.platform.replace('_', ''),
      content_type: script.platform === 'linkedin' ? 'linkedin_post' : 'reels',
      content_body: script.script,
      status: 'draft',
      source_url: videoUrl || videoFile,
      source_agent: 'process-video',
      approval_notes: `Corte ${script.startTime}s-${script.endTime}s, avatar: ${script.avatar}`
    })
  }

  console.log(`\n💾 ${scripts.length} itens salvos no Supabase`)
  console.log(`📁 Scripts em: output/video-cortes/${slug}/`)
  console.log('\n✅ Processamento completo!')
  console.log('  Proximos passos:')
  console.log('  1. Revise os scripts em output/video-cortes/')
  console.log('  2. Grave/edite cada corte (skill ct-video-editor ou ct-reel)')
  console.log('  3. Nada e publicado sem o "pode" explicito: aprove no Supabase e use as skills ct-publicar-*')
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
