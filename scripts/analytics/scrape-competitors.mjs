/**
 * scrape-competitors.mjs
 *
 * DUAS funcoes separadas:
 * 1. TRACKING: monitora os concorrentes (CT_COMPETITORS_IG) APENAS no Instagram
 * 2. PESQUISA: busca tendencias em LinkedIn, X, Reddit e GitHub
 *    filtradas pro publico-alvo do cliente (gestores PME, nao-tecnicos)
 *
 * Uso: node scripts/analytics/scrape-competitors.mjs
 * Cron: 0 6 * * * (diario 6h BRT)
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- TRACKING: Apenas Instagram ---
// Handles separados por virgula, sem @. Ex: CT_COMPETITORS_IG=concorrente1,concorrente2
const COMPETITORS_IG = (process.env.CT_COMPETITORS_IG || '').split(',').map(s => s.trim().replace(/^@/, '')).filter(Boolean)

// --- PESQUISA: Focada em agentes IA, sistemas com IA, cases pra gestores ---
const LINKEDIN_SEARCHES = [
  'agentes de inteligencia artificial para empresas cases',
  'como usar IA na gestao de equipes resultados',
  'sistema multiagente IA automacao empresarial',
  'Claude AI agentes autonomos implementacao',
  'IA para escritorios contabilidade advocacia',
  'cases reais automacao IA pequenas empresas Brasil'
]

const X_SEARCHES = [
  'AI agents for business managers results',
  'Claude Code AI agent automation',
  'multi-agent systems real world use cases',
  'AI replacing manual tasks business',
  'n8n AI agents workflow automation',
  'AI consulting small business ROI'
]

const REDDIT_SEARCHES = [
  'site:reddit.com/r/ClaudeAI agents automation business',
  'site:reddit.com/r/artificial AI agents real use cases',
  'site:reddit.com/r/ChatGPT business automation managers',
  'site:reddit.com/r/AutomateYourself AI agent workflow',
  'site:reddit.com/r/smallbusiness AI implementation results'
]

// GitHub: repos de agentes IA, Claude Code, sistemas multiagente
const GITHUB_SEARCHES = [
  'Claude Code AI agent stars:>200',
  'multi agent AI system stars:>500',
  'AI agent framework business stars:>300',
  'n8n AI agent workflow stars:>100',
  'Claude API agent automation stars:>200',
  'AI business automation open source stars:>300'
]

async function webSearch(query) {
  try {
    const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    return await res.text()
  } catch (err) {
    console.warn(`  Busca falhou: ${query} - ${err.message}`)
    return ''
  }
}

async function searchGitHub(query) {
  try {
    const searchTerm = query.replace(/stars:[>]?\d+/g, '').trim()
    const minStars = query.match(/stars:>(\d+)/)?.[1] || '100'
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}+stars:>${minStars}&sort=stars&order=desc&per_page=5`,
      { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ContentTeamAI/1.0' } }
    )
    const data = await res.json()
    return (data.items || []).map(repo => ({
      name: repo.full_name,
      description: repo.description || '',
      stars: repo.stargazers_count,
      url: repo.html_url,
      language: repo.language,
      topics: repo.topics || [],
      updated: repo.updated_at
    }))
  } catch (err) {
    console.warn(`  GitHub busca falhou: ${err.message}`)
    return []
  }
}

function extractSnippets(html) {
  const snippets = []
  const matches = html.match(/<span[^>]*>(.*?)<\/span>/g) || []
  for (const m of matches) {
    const text = m.replace(/<[^>]+>/g, '').trim()
    if (text.length > 40 && text.length < 500) {
      snippets.push(text)
    }
  }
  return snippets.slice(0, 5)
}

async function savePost(data) {
  const { error } = await supabase
    .from('ct_competitor_posts')
    .upsert(data, { onConflict: 'external_id' })

  if (error) console.warn(`  Erro salvando: ${error.message}`)
}

// === PARTE 1: TRACKING DE CONCORRENTES (Instagram) ===
async function trackInstagram() {
  console.log('📸 TRACKING - concorrentes no Instagram')
  let count = 0
  for (const handle of COMPETITORS_IG) {
    console.log(`  @${handle}...`)
    const html = await webSearch(`site:instagram.com ${handle} post`)
    const snippets = extractSnippets(html)
    for (const snippet of snippets) {
      await savePost({
        external_id: `ig_${handle}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        competitor_handle: handle,
        platform: 'instagram',
        source_type: 'competitor_tracking',
        content_preview: snippet,
        scraped_at: new Date().toISOString()
      })
      count++
    }
  }
  return count
}

// === PARTE 2: PESQUISA DE TENDENCIAS (LinkedIn, X, Reddit, GitHub) ===
async function researchLinkedIn() {
  console.log('\n💼 PESQUISA - Tendencias LinkedIn (filtro: gestores PME)')
  let count = 0
  for (const term of LINKEDIN_SEARCHES) {
    console.log(`  "${term}"...`)
    const html = await webSearch(`site:linkedin.com ${term}`)
    const snippets = extractSnippets(html)
    for (const snippet of snippets) {
      await savePost({
        external_id: `li_${term.slice(0, 20).replace(/\s/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        competitor_handle: term,
        platform: 'linkedin',
        source_type: 'trend_research',
        content_preview: snippet,
        scraped_at: new Date().toISOString()
      })
      count++
    }
  }
  return count
}

async function researchX() {
  console.log('\n🐦 PESQUISA - Tendencias X/Twitter (filtro: ferramentas praticas)')
  let count = 0
  for (const term of X_SEARCHES) {
    console.log(`  "${term}"...`)
    const html = await webSearch(`site:x.com ${term}`)
    const snippets = extractSnippets(html)
    for (const snippet of snippets) {
      await savePost({
        external_id: `x_${term.slice(0, 20).replace(/\s/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        competitor_handle: term,
        platform: 'x',
        source_type: 'trend_research',
        content_preview: snippet,
        scraped_at: new Date().toISOString()
      })
      count++
    }
  }
  return count
}

async function researchReddit() {
  console.log('\n🟠 PESQUISA - Reddit (filtro: casos reais, tutoriais)')
  let count = 0
  for (const term of REDDIT_SEARCHES) {
    console.log(`  "${term.replace('site:reddit.com/', '')}"...`)
    const html = await webSearch(term)
    const snippets = extractSnippets(html)
    for (const snippet of snippets) {
      await savePost({
        external_id: `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        competitor_handle: term.replace('site:reddit.com/', ''),
        platform: 'reddit',
        source_type: 'trend_research',
        content_preview: snippet,
        scraped_at: new Date().toISOString()
      })
      count++
    }
  }
  return count
}

async function researchGitHub() {
  console.log('\n🐙 PESQUISA - GitHub Repos (filtro: bem avaliados, uteis pra conteudo/produto)')
  let count = 0
  for (const query of GITHUB_SEARCHES) {
    console.log(`  "${query}"...`)
    const repos = await searchGitHub(query)
    for (const repo of repos) {
      await savePost({
        external_id: `gh_${repo.name.replace('/', '_')}_${Date.now()}`,
        competitor_handle: repo.name,
        platform: 'github',
        source_type: 'repo_research',
        content_preview: `⭐ ${repo.stars} | ${repo.language || 'n/a'} | ${repo.description} | ${repo.url}`,
        scraped_at: new Date().toISOString()
      })
      count++
      console.log(`    ⭐ ${repo.stars} - ${repo.name}: ${repo.description?.substring(0, 80)}`)
    }
  }
  return count
}

async function main() {
  console.log('🔍 Content Team - Scraping Diario')
  console.log(`📅 ${new Date().toISOString()}`)
  console.log('=' .repeat(60))

  // PARTE 1: Tracking (Instagram)
  const igCount = await trackInstagram()

  // PARTE 2: Pesquisa de tendencias
  const liCount = await researchLinkedIn()
  const xCount = await researchX()
  const rdCount = await researchReddit()
  const ghCount = await researchGitHub()

  const total = igCount + liCount + xCount + rdCount + ghCount

  console.log('\n' + '='.repeat(60))
  console.log('📊 Resumo:')
  console.log(`  📸 Instagram (tracking): ${igCount} posts`)
  console.log(`  💼 LinkedIn (pesquisa): ${liCount} tendencias`)
  console.log(`  🐦 X/Twitter (pesquisa): ${xCount} tendencias`)
  console.log(`  🟠 Reddit (pesquisa): ${rdCount} tendencias`)
  console.log(`  🐙 GitHub (repos): ${ghCount} repos`)
  console.log(`  📦 Total: ${total} itens salvos`)

  // Notificar Telegram se tiver token
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID
  if (TG_TOKEN && TG_CHAT && total > 0) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: `Scraping diario completo\n\nIG tracking: ${igCount}\nLinkedIn: ${liCount}\nX: ${xCount}\nReddit: ${rdCount}\nGitHub repos: ${ghCount}\nTotal: ${total}`
      })
    }).catch(() => {})
  }
}

main().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
