/**
 * scrape-playwright.mjs
 *
 * Scraping real com Playwright (navegador headless).
 * Funciona sem login pra Instagram, Reddit, X (via Nitter), LinkedIn (via Google).
 *
 * TRACKING: concorrentes (CT_COMPETITORS_IG) no Instagram (perfis publicos)
 * PESQUISA: Tendencias de agentes IA, sistemas IA, cases gestores
 *
 * Uso: node scripts/analytics/scrape-playwright.mjs
 * Cron: 0 6 * * * (diario 6h BRT)
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- Config ---
// Handles separados por virgula, sem @. Ex: CT_COMPETITORS_IG=concorrente1,concorrente2
const COMPETITORS_IG = (process.env.CT_COMPETITORS_IG || '').split(',').map(s => s.trim().replace(/^@/, '')).filter(Boolean)

const RESEARCH_QUERIES = {
  linkedin: [
    'agentes de IA para gestores de empresas cases reais',
    'automacao inteligente IA resultados empresas PME',
    'inteligencia artificial negocios gestao equipes'
  ],
  x_nitter: [
    // Nitter mirrors publicos (sem login)
    'AI agents business automation',
    'Claude Code AI agent',
    'multi agent system real use case'
  ],
  reddit: [
    { sub: 'ClaudeAI', sort: 'hot' },
    { sub: 'artificial', sort: 'hot' },
    { sub: 'ChatGPT', query: 'automation business' },
    { sub: 'AutomateYourself', sort: 'hot' },
    { sub: 'smallbusiness', query: 'AI automation' }
  ],
  github: [
    'Claude Code AI agent',
    'multi agent AI system',
    'AI agent framework business',
    'n8n AI agent workflow',
    'AI automation open source'
  ]
}

// --- Helpers ---
async function savePost(data) {
  const { error } = await supabase
    .from('ct_competitor_posts')
    .upsert(data, { onConflict: 'external_id' })
  if (error) console.warn(`  DB: ${error.message}`)
  else return true
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// --- INSTAGRAM: Scraping de perfis publicos ---
async function scrapeInstagram(page) {
  console.log('\n📸 TRACKING - concorrentes no Instagram')
  let count = 0

  for (const handle of COMPETITORS_IG) {
    console.log(`  @${handle}...`)
    try {
      await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(2000)

      // Tentar pegar posts do feed
      const posts = await page.evaluate(() => {
        const articles = document.querySelectorAll('article a[href*="/p/"]')
        const results = []
        articles.forEach(a => {
          const href = a.getAttribute('href')
          const img = a.querySelector('img')
          const alt = img ? img.getAttribute('alt') : ''
          if (href && alt) {
            results.push({ url: `https://www.instagram.com${href}`, caption: alt })
          }
        })
        return results.slice(0, 6)
      })

      // Se nao achou via articles, tenta meta tags
      if (posts.length === 0) {
        const metaPosts = await page.evaluate(() => {
          const metas = document.querySelectorAll('meta[property="og:description"], meta[name="description"]')
          const results = []
          metas.forEach(m => {
            const content = m.getAttribute('content')
            if (content && content.length > 20) {
              results.push({ caption: content, url: window.location.href })
            }
          })
          return results.slice(0, 3)
        })
        posts.push(...metaPosts)
      }

      for (const post of posts) {
        const saved = await savePost({
          external_id: `ig_${handle}_${uid()}`,
          competitor_handle: handle,
          platform: 'instagram',
          source_type: 'competitor_tracking',
          content_preview: post.caption.substring(0, 500),
          scraped_at: new Date().toISOString()
        })
        if (saved) count++
      }

      if (posts.length === 0) {
        // Fallback: pegar bio/descricao da pagina
        const bio = await page.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span'))
          return spans.filter(s => s.textContent.length > 30 && s.textContent.length < 300)
            .map(s => s.textContent).slice(0, 2)
        })
        for (const text of bio) {
          await savePost({
            external_id: `ig_bio_${handle}_${uid()}`,
            competitor_handle: handle,
            platform: 'instagram',
            source_type: 'competitor_tracking',
            content_preview: text,
            scraped_at: new Date().toISOString()
          })
          count++
        }
      }

      console.log(`    ${posts.length || 'bio'} posts encontrados`)
    } catch (err) {
      console.warn(`    Erro: ${err.message.substring(0, 80)}`)
    }

    await page.waitForTimeout(1500 + Math.random() * 1500) // anti-rate-limit
  }
  return count
}

// --- SEARXNG: Metabuscador local (http://localhost:8888) ---
const SEARXNG_URL = 'http://localhost:8888'

async function searchSearXNG(query, maxResults = 5) {
  try {
    const res = await fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`, {
      headers: { 'Accept': 'application/json' }
    })
    const data = await res.json()
    return (data.results || []).slice(0, maxResults).map(r => ({
      title: r.title || '',
      snippet: r.content || '',
      url: r.url || ''
    }))
  } catch (err) {
    console.warn(`    SearXNG erro: ${err.message.substring(0, 80)}`)
    return []
  }
}

// --- LINKEDIN + X + REDDIT: Via SearXNG local ---
async function searchPlatform(queries, platform, label) {
  console.log(`\n${label}`)
  let count = 0

  for (const query of queries) {
    console.log(`  "${query.substring(0, 60)}..."`)
    const results = await searchSearXNG(query, 5)

    for (const r of results) {
      const text = `${r.title}\n${r.snippet}`
      if (text.length > 30) {
        const saved = await savePost({
          external_id: `${platform}_${uid()}`,
          competitor_handle: query.substring(0, 50),
          platform,
          source_type: 'trend_research',
          content_preview: text.substring(0, 500),
          scraped_at: new Date().toISOString()
        })
        if (saved) count++
      }
    }

    console.log(`    ${results.length} resultados`)
    await new Promise(r => setTimeout(r, 500))
  }
  return count
}

async function scrapeLinkedIn() {
  const queries = RESEARCH_QUERIES.linkedin.map(q => `site:linkedin.com ${q}`)
  return searchPlatform(queries, 'linkedin', '💼 PESQUISA - LinkedIn (via SearXNG)')
}

async function scrapeX() {
  const queries = RESEARCH_QUERIES.x_nitter.map(q => `site:x.com ${q}`)
  return searchPlatform(queries, 'x', '🐦 PESQUISA - X/Twitter (via SearXNG)')
}

// --- REDDIT: Via SearXNG ---
async function scrapeReddit() {
  console.log('\n🟠 PESQUISA - Reddit (via SearXNG)')
  let count = 0

  for (const config of RESEARCH_QUERIES.reddit) {
    console.log(`  r/${config.sub}${config.query ? ` "${config.query}"` : ''}...`)
    try {
      const query = config.query
        ? `site:reddit.com/r/${config.sub} ${config.query}`
        : `site:reddit.com/r/${config.sub} AI agents`
      const results = await searchSearXNG(query, 8)

      const posts = results.filter(r => r.title.length > 15).map(r => ({
        title: r.title,
        score: '?',
        url: r.url
      }))

      for (const post of posts) {
        if (post.title.length > 15) {
          const saved = await savePost({
            external_id: `rd_${config.sub}_${uid()}`,
            competitor_handle: `r/${config.sub}`,
            platform: 'reddit',
            source_type: 'trend_research',
            content_preview: `[${post.score} pts] ${post.title}`.substring(0, 500),
            scraped_at: new Date().toISOString()
          })
          if (saved) count++
        }
      }

      console.log(`    ${posts.length} posts`)
    } catch (err) {
      console.warn(`    Erro: ${err.message.substring(0, 80)}`)
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return count
}

// --- GITHUB: API oficial (ja funciona sem browser) ---
async function scrapeGitHub() {
  console.log('\n🐙 PESQUISA - GitHub Repos (API oficial)')
  let count = 0

  for (const query of RESEARCH_QUERIES.github) {
    console.log(`  "${query}"...`)
    try {
      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`,
        { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ContentTeamAI/1.0' } }
      )
      const data = await res.json()

      for (const repo of (data.items || [])) {
        const saved = await savePost({
          external_id: `gh_${repo.full_name.replace('/', '_')}_${uid()}`,
          competitor_handle: repo.full_name,
          platform: 'github',
          source_type: 'repo_research',
          content_preview: `⭐ ${repo.stargazers_count} | ${repo.language || 'n/a'} | ${repo.description || ''} | ${repo.html_url}`.substring(0, 500),
          scraped_at: new Date().toISOString()
        })
        if (saved) count++
        console.log(`    ⭐ ${repo.stargazers_count} - ${repo.full_name}`)
      }
    } catch (err) {
      console.warn(`    Erro: ${err.message.substring(0, 80)}`)
    }
  }
  return count
}

// --- MAIN ---
async function main() {
  console.log('🔍 Content Team - Scraping com Playwright')
  console.log(`📅 ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    geolocation: { latitude: -23.55, longitude: -46.63 },
    timezoneId: 'America/Sao_Paulo'
  })

  const page = await context.newPage()

  // Aceitar cookies do Google (GDPR)
  try {
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 10000 })
    const consentBtn = await page.$('button:has-text("Accept"), button:has-text("Aceitar"), button:has-text("I agree")')
    if (consentBtn) { await consentBtn.click(); await page.waitForTimeout(1000) }
  } catch {}

  // Aceitar cookies do Reddit
  try {
    await page.goto('https://old.reddit.com', { waitUntil: 'domcontentloaded', timeout: 10000 })
    const redditBtn = await page.$('button:has-text("Accept"), button:has-text("OK")')
    if (redditBtn) { await redditBtn.click(); await page.waitForTimeout(1000) }
  } catch {}

  let igCount = 0, liCount = 0, xCount = 0, rdCount = 0, ghCount = 0

  try {
    igCount = await scrapeInstagram(page)
    liCount = await scrapeLinkedIn()
    xCount = await scrapeX()
    rdCount = await scrapeReddit()
    ghCount = await scrapeGitHub()
  } finally {
    await browser.close()
  }

  const total = igCount + liCount + xCount + rdCount + ghCount

  console.log('\n' + '='.repeat(60))
  console.log('📊 Resumo:')
  console.log(`  📸 Instagram (tracking): ${igCount}`)
  console.log(`  💼 LinkedIn (pesquisa): ${liCount}`)
  console.log(`  🐦 X/Twitter (pesquisa): ${xCount}`)
  console.log(`  🟠 Reddit (pesquisa): ${rdCount}`)
  console.log(`  🐙 GitHub (repos): ${ghCount}`)
  console.log(`  📦 Total: ${total}`)

  // Notificar Telegram
  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const TG_CHAT = process.env.TELEGRAM_CHAT_ID
  if (TG_TOKEN && TG_CHAT) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: `Scraping diario completo (Playwright)\n\nIG tracking: ${igCount}\nLinkedIn: ${liCount}\nX: ${xCount}\nReddit: ${rdCount}\nGitHub: ${ghCount}\nTotal: ${total}`
      })
    }).catch(() => {})
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message)
  process.exit(1)
})
