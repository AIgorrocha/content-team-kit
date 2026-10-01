#!/usr/bin/env node
// Coleta publicacoes via navegador (Playwright) pras redes sem API de leitura util: LinkedIn
// (token so tem w_member_social, escreve mas o /rest/posts devolve 403) e TikTok (nunca teve
// API de leitura). Instagram tem API funcionando hoje, entao fica implementado mas pulado por
// padrao (so roda com --forcar-navegador).
//
// Reaproveita sessao logada + scraping ja existentes nos analyzers, sem duplicar login:
//   skills/ct-linkedin-analyzer/scrape.js  (PROFILE_DIR, scrollAndCollect, relativeLabelToISO)
//   skills/ct-tiktok-analyzer/scrape.js    (PROFILE_DIR, scrapeProfile, enrichVideo)
// Sessao caida ou nunca criada NUNCA e erro fatal: imprime a instrucao de login e segue pra
// proxima rede. Nunca imprime cookie/token/senha.
//
// Uso:
//   node scripts/sala/sync-publicacoes-navegador.mjs [--rede linkedin|tiktok|instagram|todas]
//     [--cliente slug] [--dias 30] [--dry-run] [--no-headless] [--forcar-navegador]
//
// Saida: mesma forma do sync-publicacoes.mjs: uma linha JSON em stdout
// { porRede: { linkedin: n, ... }, avisos: [...] }.

import dotenv from "dotenv"
import { createRequire } from "node:module"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveClient } from "../_lib/workspace-client.mjs"
import { gravar, criarPool, validarCliente } from "./sync-publicacoes.mjs"

dotenv.config({ path: ".env.local", quiet: true })

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Handle por cliente: lido de clients/{slug}/brand-profile.md, nunca fixo no codigo. Cada
// cliente do kit tem seus proprios links de rede documentados la (padrao ja usado no resto
// do repo, ex: "**TikTok**: https://www.tiktok.com/@handle").
// ---------------------------------------------------------------------------

const PADRAO_LINK = {
  tiktok: /tiktok\.com\/@([a-z0-9._-]+)/i,
  instagram: /instagram\.com\/([a-z0-9._-]+)/i,
}

function lerBrandProfile(clientSlug) {
  try { validarCliente(clientSlug) } catch { return null }
  const caminho = join(process.cwd(), "clients", clientSlug, "brand-profile.md")
  if (!existsSync(caminho)) return null
  return readFileSync(caminho, "utf8")
}

export function lerHandle(clientSlug, rede) {
  const texto = lerBrandProfile(clientSlug)
  if (!texto) return null
  const m = PADRAO_LINK[rede]?.exec(texto)
  return m ? m[1] : null
}

// LinkedIn pode ser perfil pessoal (/in/) ou pagina de empresa (/company/); o brand-profile
// documenta qual e o do cliente ativo.
export function lerAlvoLinkedin(clientSlug) {
  const texto = lerBrandProfile(clientSlug)
  if (!texto) return null
  const pessoal = /linkedin\.com\/in\/([a-z0-9-]+)/i.exec(texto)
  if (pessoal) return { tipo: "personal", handle: pessoal[1] }
  const empresa = /linkedin\.com\/company\/([a-z0-9-]+)/i.exec(texto)
  if (empresa) return { tipo: "company", handle: empresa[1] }
  return null
}

export function sessaoExpiradaMsg(rede) {
  return `Sessão do ${rede} expirou. Rode: node skills/ct-${rede}-analyzer/login-auto.js`
}

// ---------------------------------------------------------------------------
// Normalizadores puros -> mesma forma de ct_publications que sync-publicacoes.mjs usa.
// Testados em sync-publicacoes-navegador.test.mjs com fixtures, sem rede.
// ---------------------------------------------------------------------------

export function normalizarLinkedinNavegador(post, clientSlug, paraISO) {
  const urnReal = post.urn && !String(post.urn).startsWith("synthetic-") ? post.urn : null
  return {
    client_slug: clientSlug,
    rede: "linkedin",
    tipo: "post",
    url: urnReal ? `https://www.linkedin.com/feed/update/${urnReal}` : null,
    publicado_em: paraISO(post.posted_label),
    origem: "manual",
    titulo: (post.text ?? "").slice(0, 300) || null,
    capa_url: post.media?.[0]?.url ?? null,
    metricas: {
      likes: post.reactions ?? 0,
      comments: post.comments ?? 0,
      shares: post.reposts ?? 0,
    },
  }
}

export function normalizarTiktokNavegador(video, clientSlug) {
  return {
    client_slug: clientSlug,
    rede: "tiktok",
    tipo: "video",
    url: video.href ?? null,
    publicado_em: video.created_at ?? null,
    origem: "manual",
    titulo: (video.caption ?? "").slice(0, 300) || null,
    capa_url: null,
    metricas: {
      views: video.views ?? 0,
      likes: video.likes ?? 0,
      comments: video.comments ?? 0,
      shares: video.shares ?? 0,
    },
  }
}

export function normalizarInstagramNavegador(url, clientSlug) {
  return {
    client_slug: clientSlug,
    rede: "instagram",
    tipo: url.includes("/reel/") ? "reel" : "feed",
    url,
    publicado_em: null,
    origem: "manual",
    titulo: null,
    capa_url: null,
    metricas: {},
  }
}

// ---------------------------------------------------------------------------
// Coletores (Playwright de verdade). Cada um abre a sessao persistente da skill dona,
// verifica se ainda esta logada e devolve { itens, aviso }. Erro nunca sobe: vira aviso.
// ---------------------------------------------------------------------------

async function abrirContexto(profileDir, headless) {
  if (!existsSync(profileDir)) return null
  const { chromium } = require("playwright")
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
    timeout: 15000,
  })
  context.setDefaultTimeout(10000)
  context.setDefaultNavigationTimeout(15000)
  const limite = setTimeout(() => { void context.close().catch(() => {}) }, 35000)
  limite.unref()
  context.once("close", () => clearTimeout(limite))
  return context
}

function urlPareceLogin(url) {
  return /\/login|\/uas\/login|\/authwall|\/checkpoint|\/accounts\/login/i.test(url)
}

async function coletarLinkedinNavegador({ clientSlug, desde, headless }) {
  const alvo = lerAlvoLinkedin(clientSlug)
  if (!alvo) return { itens: [], aviso: `linkedin: sem link do LinkedIn em clients/${clientSlug}/brand-profile.md` }

  const { PROFILE_DIR, scrollAndCollect, relativeLabelToISO } = require(
    "../../skills/ct-linkedin-analyzer/scrape.js"
  )
  const context = await abrirContexto(PROFILE_DIR, headless)
  if (!context) return { itens: [], aviso: sessaoExpiradaMsg("linkedin") }

  try {
    const page = context.pages()[0] || (await context.newPage())
    const url = alvo.tipo === "company"
      ? `https://www.linkedin.com/company/${alvo.handle}/posts/`
      : `https://www.linkedin.com/in/${alvo.handle}/recent-activity/all/`
    await page.goto(url, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)
    if (urlPareceLogin(page.url())) return { itens: [], aviso: sessaoExpiradaMsg("linkedin") }

    const posts = await scrollAndCollect(page, 20)
    const itens = posts
      .map((p) => normalizarLinkedinNavegador(p, clientSlug, relativeLabelToISO))
      .filter((it) => it.url && (!it.publicado_em || new Date(it.publicado_em) >= desde))
    return { itens, aviso: null }
  } catch (e) {
    return { itens: [], aviso: "linkedin: coleta indisponível ou tempo limite atingido" }
  } finally {
    await context.close()
  }
}

async function coletarTiktokNavegador({ clientSlug, desde, headless }) {
  const handle = lerHandle(clientSlug, "tiktok")
  if (!handle) return { itens: [], aviso: `tiktok: sem link do TikTok em clients/${clientSlug}/brand-profile.md` }

  const { PROFILE_DIR, scrapeProfile, enrichVideo } = require("../../skills/ct-tiktok-analyzer/scrape.js")
  const context = await abrirContexto(PROFILE_DIR, headless)
  if (!context) return { itens: [], aviso: sessaoExpiradaMsg("tiktok") }

  try {
    const page = context.pages()[0] || (await context.newPage())
    const dados = await scrapeProfile(page, handle, 30)
    for (const video of dados.videos) await enrichVideo(page, video)
    const itens = dados.videos
      .map((v) => normalizarTiktokNavegador(v, clientSlug))
      .filter((it) => it.url && (!it.publicado_em || new Date(it.publicado_em) >= desde))
    return { itens, aviso: null }
  } catch (e) {
    const expirou = /login expirou|nao carregou/i.test(e.message)
    return { itens: [], aviso: expirou ? sessaoExpiradaMsg("tiktok") : "tiktok: coleta indisponível ou tempo limite atingido" }
  } finally {
    await context.close()
  }
}

// Sem scraper/sessao dedicados no repo hoje (a API do Instagram funciona). Fica implementado
// no formato dos outros dois pra quando precisar, mas so roda com --forcar-navegador.
async function coletarInstagramNavegador({ clientSlug, desde, headless }) {
  const handle = lerHandle(clientSlug, "instagram")
  if (!handle) return { itens: [], aviso: `instagram: sem link do Instagram em clients/${clientSlug}/brand-profile.md` }

  const profileDir = join(process.cwd(), "skills", "ct-instagram-analyzer", ".instagram-profile")
  const context = await abrirContexto(profileDir, headless)
  if (!context) return { itens: [], aviso: sessaoExpiradaMsg("instagram") }

  try {
    const page = context.pages()[0] || (await context.newPage())
    await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(3000)
    if (urlPareceLogin(page.url())) return { itens: [], aviso: sessaoExpiradaMsg("instagram") }

    const links = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (as) => [
      ...new Set(as.map((a) => a.href)),
    ])
    // Sem data por post na grade (precisaria abrir cada um); dias vira so limite de contagem.
    const itens = links.slice(0, 30).map((url) => normalizarInstagramNavegador(url, clientSlug))
    return { itens, aviso: null }
  } catch (e) {
    return { itens: [], aviso: "instagram: coleta indisponível ou tempo limite atingido" }
  } finally {
    await context.close()
  }
}

export const COLETORES_NAVEGADOR = {
  linkedin: coletarLinkedinNavegador,
  tiktok: coletarTiktokNavegador,
  instagram: coletarInstagramNavegador,
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { cliente: null, dias: 30, rede: "todas", dryRun: false, headless: true, forcarNavegador: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cliente") args.cliente = argv[++i]
    else if (argv[i] === "--dias") args.dias = Number(argv[++i])
    else if (argv[i] === "--rede") args.rede = argv[++i]
    else if (argv[i] === "--dry-run") args.dryRun = true
    else if (argv[i] === "--no-headless") args.headless = false
    else if (argv[i] === "--forcar-navegador") args.forcarNavegador = true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const clientSlug = validarCliente(args.cliente ?? resolveClient())
  const desde = new Date(Date.now() - args.dias * 24 * 60 * 60 * 1000)
  const redesAlvo = args.rede === "todas" ? ["linkedin", "tiktok", "instagram"] : [args.rede]

  const databaseUrl = process.env.DATABASE_URL
  if (!args.dryRun && !databaseUrl) {
    console.error("DATABASE_URL nao definida (.env.local).")
    process.exitCode = 1
    return
  }
  const pool = criarPool(databaseUrl)

  const porRede = {}
  const avisos = []

  for (const rede of redesAlvo) {
    if (rede === "instagram" && !args.forcarNavegador) {
      const aviso = "instagram: API ja funciona, navegador pulado (use --forcar-navegador pra forcar)"
      avisos.push(aviso)
      console.error(`[sync-publicacoes-navegador] ${aviso}`)
      continue
    }
    const coletor = COLETORES_NAVEGADOR[rede]
    if (!coletor) { avisos.push(`${rede}: rede desconhecida`); continue }

    console.error(`[sync-publicacoes-navegador] coletando ${rede}...`)
    const resultado = await coletor({ clientSlug, desde, headless: args.headless })
    if (resultado.aviso) {
      avisos.push(resultado.aviso)
      console.error(`[sync-publicacoes-navegador] ${resultado.aviso}`)
    }
    const gravados = args.dryRun ? resultado.itens.length : await gravar(pool, resultado.itens)
    porRede[rede] = gravados
    console.error(`[sync-publicacoes-navegador] ${rede}: ${gravados} publicacao(oes)${args.dryRun ? " (dry-run, nao gravado)" : ""}`)
  }

  if (pool) await pool.end()
  console.log(JSON.stringify({ porRede, avisos }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("Falha ao sincronizar publicações via navegador. Confira o cliente e a conexão.")
    process.exitCode = 1
  })
}
