/**
 * cross-post.mjs
 * A partir de um conteudo do Instagram, gera versoes NATIVAS com angulo diferente
 * pra cada rede (LinkedIn, X thread, TikTok script, YouTube Shorts script).
 *
 * REGRA: NUNCA repetir o mesmo conteudo. Cada rede = angulo diferente do mesmo TEMA.
 *
 * Uso: node scripts/publishing/cross-post.mjs --tema="Tema do conteudo" [--legenda="texto da legenda IG"] [--publish]
 *
 * Sem --publish, tudo vira RASCUNHO em ct_content_items (nada vai pro ar). Com --publish, o post
 * do LinkedIn sai de verdade: so use depois do "pode" da pessoa. Os textos gerados aqui sao
 * MODELOS genericos: revise e adapte a voz da marca antes de publicar.
 */
import { config } from 'dotenv'
config({ quiet: true, path: '.env.local', override: true }); config({ quiet: true, path: '.env' })
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveClient } from '../_lib/workspace-client.mjs'
import { escapeLittleText } from './_lib/linkedin-text.mjs'
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '_lib/register.mjs')).href)

const CLIENT_SLUG = resolveClient()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID

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

// Esqueletos neutros: cada [PREENCHER ...] e escrito pelo ct-redator na voz da marca
// (clients/{slug}/brand-profile.md e voice-patterns.md). Nada de numero ou caso inventado:
// prova so com dado real da marca. O --publish recusa texto com [PREENCHER] sobrando.
function generateLinkedInPost(tema, legendaIG) {
  return `[PREENCHER: gancho de ate 140 caracteres sobre "${tema}"]

[PREENCHER: contexto em 2 a 3 frases, no tom da marca]
${legendaIG ? `
Base (legenda do Instagram, reescrever para o LinkedIn):
${legendaIG}
` : ''}
[PREENCHER: 3 a 5 pontos praticos]

[PREENCHER: prova real da marca (caso, numero, antes e depois), ou remover esta linha]

[PREENCHER: fechamento ou pergunta especifica, so se for natural]`
}

function generateXThread(tema) {
  return [
    `[PREENCHER: tweet 1, gancho sobre "${tema}", ate 280 caracteres]`,
    '[PREENCHER: tweet 2, o problema]',
    '[PREENCHER: tweet 3, primeiro ponto pratico]',
    '[PREENCHER: tweet 4, segundo ponto pratico]',
    '[PREENCHER: tweet 5, prova real da marca ou exemplo]',
    '[PREENCHER: tweet 6, resumo e chamada no tom da marca]',
  ]
}

function generateTikTokScript(tema) {
  return {
    platform: 'tiktok',
    format: 'reels_9x16',
    duration: '21-34s',
    script: `[GANCHO - 1 a 2s] [PREENCHER: frase que prende sobre "${tema}"]

[DESENVOLVIMENTO - 15 a 25s] [PREENCHER: 2 a 3 pontos, mostrar em vez de explicar]

[FECHAMENTO - 3 a 5s] [PREENCHER: chamada para acao da marca]`,
    hashtags: '[PREENCHER: ate 5 hashtags, regra em brand-profile.md]'
  }
}

function generateYouTubeShortsScript(tema) {
  return {
    platform: 'youtube_shorts',
    format: 'reels_9x16',
    duration: '30-60s',
    script: `[GANCHO - 2s] [PREENCHER: frase que prende sobre "${tema}"]

[PROBLEMA - 10s] [PREENCHER]

[SOLUCAO OU COMPARACAO - 15s] [PREENCHER]

[PROVA - 10s] [PREENCHER: dado real da marca, ou remover]

[FECHAMENTO - 5s] [PREENCHER: chamada para acao da marca]`,
    hashtags: '[PREENCHER: ate 5 hashtags, regra em brand-profile.md]'
  }
}

async function saveContentItem(item) {
  const { error } = await supabase
    .from('ct_content_items')
    .insert({ client_slug: CLIENT_SLUG, ...item })

  if (error) {
    console.warn(`  Erro salvando: ${error.message}`)
  }
}

// Devolve o URN do post (x-restli-id) ou null.
async function postToLinkedIn(text) {
  if (!LINKEDIN_TOKEN || !LINKEDIN_PERSON_ID) {
    console.log('  ⚠️  LinkedIn nao configurado, salvando como draft')
    return null
  }

  try {
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINKEDIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202606'
      },
      body: JSON.stringify({
        author: `urn:li:person:${LINKEDIN_PERSON_ID}`,
        commentary: escapeLittleText(text),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    })
    return res.status === 201 ? res.headers.get('x-restli-id') : null
  } catch (err) {
    console.warn(`  Erro LinkedIn: ${err.message}`)
    return null
  }
}

async function main() {
  const args = parseArgs()
  const tema = args.tema || args.theme
  const legendaIG = args.legenda || ''

  if (!tema) {
    console.log('Uso: node scripts/publishing/cross-post.mjs --tema="Tema do conteudo" [--legenda="legenda IG"] [--publish]')
    process.exit(1)
  }

  console.log(`🔄 Cross-Post - Tema: "${tema}"`)
  console.log(`📅 ${new Date().toISOString()}\n`)

  // 1. LinkedIn - Storytelling + dados
  console.log('💼 Gerando post LinkedIn...')
  const linkedinText = generateLinkedInPost(tema, legendaIG)
  if (process.argv.includes('--publish') && linkedinText.includes('[PREENCHER')) {
    console.error('Texto do LinkedIn ainda tem [PREENCHER]. Peca ao ct-redator para escrever antes de publicar.')
    process.exit(1)
  }
  const linkedinUrn = process.argv.includes('--publish') ? await postToLinkedIn(linkedinText) : null
  const linkedinPublished = !!linkedinUrn
  if (linkedinPublished) {
    await registerPublicationSafe({
      client_slug: CLIENT_SLUG, platform: 'linkedin', content_type: 'post', title: tema,
      url: `https://www.linkedin.com/feed/update/${linkedinUrn}`, caption: linkedinText,
      source_url: 'cross-post:instagram', source_agent: 'cross-post.mjs',
    })
  } else {
    await saveContentItem({
      title: tema,
      platform: 'linkedin',
      content_type: 'linkedin_post',
      content_body: linkedinText,
      status: 'draft',
      source_url: 'cross-post:instagram',
      created_by: 'remix-auto'
    })
  }
  console.log(`  ${linkedinPublished ? '✅ Publicado e registrado' : '📝 Salvo como draft (use --publish depois do "pode")'}`)

  // 2. X Thread - Insights em lista
  console.log('\n🐦 Gerando thread X/Twitter...')
  const xThread = generateXThread(tema)
  await saveContentItem({
    title: tema,
    platform: 'x',
    content_type: 'x_thread',
    content_body: JSON.stringify(xThread),
    status: 'draft',
    source_url: 'cross-post:instagram',
    created_by: 'remix-auto',
    approval_notes: `${xThread.length} tweets na thread`
  })
  console.log(`  📝 Thread com ${xThread.length} tweets salva como draft`)

  // 3. TikTok - Script para avatar HeyGen
  console.log('\n🎵 Gerando script TikTok...')
  const tiktokScript = generateTikTokScript(tema)
  await saveContentItem({
    title: tema,
    platform: 'tiktok',
    content_type: 'reels',
    content_body: JSON.stringify(tiktokScript),
    status: 'draft',
    source_url: 'cross-post:instagram',
    created_by: 'doppel-auto',
    approval_notes: `Esqueleto: preencher os [PREENCHER], ${tiktokScript.duration}`
  })
  console.log(`  📝 Esqueleto TikTok salvo (${tiktokScript.duration})`)

  // 4. YouTube Shorts - Script para avatar diferente
  console.log('\n📺 Gerando script YouTube Shorts...')
  const shortsScript = generateYouTubeShortsScript(tema)
  await saveContentItem({
    title: tema,
    platform: 'youtube',
    content_type: 'youtube_short',
    content_body: JSON.stringify(shortsScript),
    status: 'draft',
    source_url: 'cross-post:instagram',
    created_by: 'doppel-auto',
    approval_notes: `Esqueleto: preencher os [PREENCHER], ${shortsScript.duration}`
  })
  console.log(`  📝 Esqueleto Shorts salvo (${shortsScript.duration})`)

  // 5. Threads - lembrete pra compartilhar do IG
  console.log('\n🧵 Threads: compartilhar direto do Instagram (sem API)')

  console.log('\n✅ Cross-post completo!')
  console.log('  💼 LinkedIn: publicado/draft')
  console.log('  🐦 X: thread draft (postar manual)')
  console.log('  🎵 TikTok: script pronto (gravar com HeyGen)')
  console.log('  📺 Shorts: script pronto (gravar com HeyGen)')
  console.log('  🧵 Threads: compartilhar do IG manualmente')
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
