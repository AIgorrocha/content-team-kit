#!/usr/bin/env node
// Sincroniza ct_publications com o que de fato saiu em cada rede (Batelada B6).
//
// Le Instagram Graph API (feed, reels, stories dos ultimos N dias), YouTube Data API
// (uploads do canal) e LinkedIn (posts via /rest/posts) com o token do .env.local; TikTok
// nao tem API de leitura, entao usa o que o coletor semanal ja gravou em
// ct_metrics_snapshots. Grava tudo em ct_publications com upsert por (client_slug, rede, url).
//
// Credencial ausente NUNCA e erro fatal: a rede e pulada com um aviso curto (regra do kit:
// nunca imprimir token nem URL com token).
//
// Uso:
//   node scripts/sala/sync-publicacoes.mjs [--cliente slug] [--dias 30]
//     [--rede instagram|youtube|linkedin|tiktok|todas] [--dry-run]
//
// Saida: uma linha de log por passo em stderr, e por ultimo uma linha JSON em stdout
// { porRede: { instagram: n, ... }, avisos: [...] } pra rota da API consumir.

import dotenv from "dotenv"
import { Pool } from "pg"
import { fileURLToPath } from "node:url"
import { ALLOWED, resolveClient } from "../_lib/workspace-client.mjs"

dotenv.config({ path: ".env.local", quiet: true })

// ---------------------------------------------------------------------------
// Normalizadores puros (Rung 7 da ladder: so o minimo, sem classe/estado). Cada um recebe
// o item cru da API/tabela de origem e devolve a linha pronta pra gravar em ct_publications.
// Testados em sync-publicacoes.test.mjs com fixtures inline, sem rede.
// ---------------------------------------------------------------------------

const TIPO_POR_MEDIA_PRODUCT = { REELS: "reel", STORY: "story", AD: "feed" }

export function normalizarInstagram(item, clientSlug) {
  const tipo = TIPO_POR_MEDIA_PRODUCT[item.media_product_type] ?? "feed"
  return {
    client_slug: clientSlug,
    rede: "instagram",
    tipo,
    url: item.permalink ?? null,
    publicado_em: item.timestamp ?? null,
    origem: "api",
    titulo: (item.caption ?? "").slice(0, 300) || null,
    capa_url: item.thumbnail_url ?? item.media_url ?? null,
    metricas: {
      like_count: item.like_count ?? 0,
      comments_count: item.comments_count ?? 0,
    },
  }
}

// duration ISO 8601 (ex: "PT45S", "PT4M13S") -> segundos. Video ate 3min E vertical
// (assumido pelo YouTube como Short quando <=180s; sem acesso direto ao flag "isShort" na
// Data API v3 publica, essa duracao e a melhor aproximacao disponivel sem API extra).
function duracaoEmSegundos(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "")
  if (!m) return null
  const [, h, min, s] = m
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0)
}

export function normalizarYoutube(item, clientSlug) {
  const segundos = duracaoEmSegundos(item.contentDetails?.duration)
  const tipo = segundos != null && segundos <= 180 ? "short" : "video"
  const url = tipo === "short"
    ? `https://www.youtube.com/shorts/${item.id}`
    : `https://www.youtube.com/watch?v=${item.id}`
  return {
    client_slug: clientSlug,
    rede: "youtube",
    tipo,
    url,
    publicado_em: item.snippet?.publishedAt ?? null,
    origem: "api",
    titulo: item.snippet?.title ?? null,
    capa_url: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    metricas: {
      views: Number(item.statistics?.viewCount ?? 0),
      likes: Number(item.statistics?.likeCount ?? 0),
      comments: Number(item.statistics?.commentCount ?? 0),
    },
  }
}

export function normalizarLinkedin(item, clientSlug) {
  const commentary = (item.commentary ?? item.commentaryV2?.text ?? "").toString()
  return {
    client_slug: clientSlug,
    rede: "linkedin",
    tipo: "post",
    url: item.id ? `https://www.linkedin.com/feed/update/${item.id}` : null,
    publicado_em: item.createdAt ? new Date(item.createdAt).toISOString() : null,
    origem: "api",
    titulo: commentary.slice(0, 300) || null,
    capa_url: null,
    metricas: {},
  }
}

export function normalizarTiktokSnapshot(row) {
  return {
    client_slug: row.client_slug,
    rede: "tiktok",
    tipo: "video",
    url: row.post_url ?? null,
    publicado_em: row.published_at ?? null,
    origem: "api",
    titulo: row.post_type ? `TikTok ${row.post_type}` : null,
    capa_url: row.metrics?.cover_url ?? null,
    metricas: {
      views: row.views ?? 0,
      likes: row.likes ?? 0,
      comments: row.comments ?? 0,
      shares: row.shares ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Coletores (fazem rede/banco). Recebem env e fetchImpl pra ficarem testaveis, mas os
// testes de verdade so cobrem os normalizadores acima; os coletores rodam contra a API
// real quando chamados pelo CLI.
// ---------------------------------------------------------------------------

function jsonFetch(fetchImpl, url, init) {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(10000) }).then(async (resp) => {
    const corpo = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return corpo
  }).catch((erro) => {
    throw new Error(/^HTTP \d{3}$/.test(erro.message) ? erro.message : "requisição indisponível")
  })
}

// Token de Instagram Login (OAuth direto, prefixo IGAA) fala com graph.instagram.com e usa
// o node "me"; token de System User via Facebook Graph (prefixo EAA) fala com
// graph.facebook.com e usa o ig-user-id. Mesma distincao de skills/_shared/ig-accounts.cjs,
// reimplementada aqui minima (so o host/id, sem a complexidade de duas contas por cliente).
function isIgDirectToken(token) {
  return String(token ?? "").startsWith("IGAA")
}

export async function coletarInstagram({ env, fetchImpl, clientSlug, desde }) {
  const token = env.INSTAGRAM_ACCESS_TOKEN
  const userId = env.INSTAGRAM_USER_ID
  if (!token || (!isIgDirectToken(token) && !userId)) return { itens: [], aviso: "instagram: credencial ausente, pulado" }

  const base = isIgDirectToken(token) ? "https://graph.instagram.com" : "https://graph.facebook.com/v21.0"
  const id = isIgDirectToken(token) ? "me" : userId
  const campos = "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count"
  const itens = []
  let next = `${base}/${id}/media?fields=${campos}&limit=50`
  try {
    for (let pagina = 0; next && pagina < 10; pagina++) {
      const paginaUrl = new URL(next)
      if (paginaUrl.origin !== new URL(base).origin) throw new Error("paginação inválida")
      paginaUrl.searchParams.delete("access_token")
      const corpo = await jsonFetch(fetchImpl, paginaUrl.href, { headers: { Authorization: `Bearer ${token}` } })
      for (const m of corpo.data ?? []) {
        if (m.timestamp && new Date(m.timestamp) < desde) continue
        itens.push(normalizarInstagram(m, clientSlug))
      }
      const ultimaData = corpo.data?.[corpo.data.length - 1]?.timestamp
      const acabouJanela = ultimaData && new Date(ultimaData) < desde
      next = !acabouJanela && corpo.paging?.next ? corpo.paging.next : null
    }
    return { itens, aviso: null }
  } catch (e) {
    return { itens, aviso: `instagram: falha na API (${e.message})` }
  }
}

async function coletarYoutube({ env, fetchImpl, clientSlug, desde }) {
  const { YOUTUBE_CLIENT_ID: clientId, YOUTUBE_CLIENT_SECRET: clientSecret, YOUTUBE_REFRESH_TOKEN: refreshToken } = env
  if (!clientId || !clientSecret || !refreshToken) {
    return { itens: [], aviso: "youtube: credencial ausente, pulado" }
  }
  try {
    const tokenBody = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
    })
    const tokenResp = await jsonFetch(fetchImpl, "https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody,
    })
    const accessToken = tokenResp.access_token
    const auth = { Authorization: `Bearer ${accessToken}` }

    const canal = await jsonFetch(fetchImpl, "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: auth })
    const uploadsId = canal.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsId) return { itens: [], aviso: "youtube: canal sem playlist de uploads" }

    const videoIds = []
    let pageToken = ""
    let paraTras = false
    for (let pagina = 0; !paraTras && pagina < 10; pagina++) {
      const q = `playlistId=${uploadsId}&part=contentDetails&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`
      const corpo = await jsonFetch(fetchImpl, `https://www.googleapis.com/youtube/v3/playlistItems?${q}`, { headers: auth })
      for (const it of corpo.items ?? []) {
        const publicadoEm = it.contentDetails?.videoPublishedAt
        if (publicadoEm && new Date(publicadoEm) < desde) { paraTras = true; break }
        if (it.contentDetails?.videoId) videoIds.push(it.contentDetails.videoId)
      }
      if (!paraTras && corpo.nextPageToken) pageToken = corpo.nextPageToken
      else break
    }

    const itens = []
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50)
      const corpo = await jsonFetch(fetchImpl, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${chunk.join(",")}`, { headers: auth })
      for (const v of corpo.items ?? []) itens.push(normalizarYoutube(v, clientSlug))
    }
    return { itens, aviso: null }
  } catch (e) {
    return { itens: [], aviso: `youtube: falha na API (${e.message})` }
  }
}

async function coletarLinkedin({ env, fetchImpl, clientSlug, desde }) {
  const token = env.LINKEDIN_ACCESS_TOKEN
  if (!token) return { itens: [], aviso: "linkedin: credencial ausente, pulado" }
  try {
    const me = await jsonFetch(fetchImpl, "https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    })
    const authorUrn = me.sub ? `urn:li:person:${me.sub}` : null
    if (!authorUrn) return { itens: [], aviso: "linkedin: sem identidade do autor" }

    const itens = []
    let start = 0
    const pageSize = 50
    for (let pagina = 0; pagina < 10; pagina++) {
      const q = `author=${encodeURIComponent(authorUrn)}&q=author&count=${pageSize}&start=${start}`
      const corpo = await jsonFetch(fetchImpl, `https://api.linkedin.com/rest/posts?${q}`, {
        headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": "202509", "X-Restli-Protocol-Version": "2.0.0" },
      })
      const lote = corpo.elements ?? []
      let parou = false
      for (const p of lote) {
        if (p.createdAt && p.createdAt < desde.getTime()) { parou = true; break }
        itens.push(normalizarLinkedin(p, clientSlug))
      }
      if (parou || lote.length < pageSize) break
      start += lote.length
    }
    return { itens, aviso: null }
  } catch (e) {
    return { itens: [], aviso: `linkedin: falha na API (${e.message})` }
  }
}

async function coletarTiktok({ pool, clientSlug, desde }) {
  try {
    const { rows } = await pool.query(
      `select client_slug, post_url, post_type, published_at, views, likes, comments, shares, metrics
       from ct_metrics_snapshots
       where client_slug = $1 and platform = 'tiktok' and post_url is not null
         and (published_at is null or published_at >= $2)`,
      [clientSlug, desde.toISOString()]
    )
    return { itens: rows.map(normalizarTiktokSnapshot), aviso: null }
  } catch (e) {
    return { itens: [], aviso: `tiktok: falha ao ler ct_metrics_snapshots (${e.message})` }
  }
}

const COLETORES = { instagram: coletarInstagram, youtube: coletarYoutube, linkedin: coletarLinkedin }

export async function gravar(pool, itens) {
  let gravados = 0
  for (const item of itens) {
    if (!item.url) continue // sem chave de dedup, nao entra (regra do indice unico)
    await pool.query(
      `insert into public.ct_publications
         (client_slug, rede, tipo, url, publicado_em, origem, titulo, capa_url, metricas)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (client_slug, rede, url) where url is not null do update set
         tipo = excluded.tipo,
         publicado_em = coalesce(excluded.publicado_em, ct_publications.publicado_em),
         titulo = coalesce(excluded.titulo, ct_publications.titulo),
         capa_url = coalesce(excluded.capa_url, ct_publications.capa_url),
         metricas = excluded.metricas`,
      [item.client_slug, item.rede, item.tipo, item.url, item.publicado_em, item.origem, item.titulo, item.capa_url, JSON.stringify(item.metricas ?? {})]
    )
    gravados++
  }
  return gravados
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function criarPool(databaseUrl) {
  if (!databaseUrl) return null
  const isLocalDb = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    ssl: !isLocalDb && process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : undefined,
  })
}

// Rede sem API de leitura de verdade (TikTok) ou aviso de falha de permissao (403/ACCESS_DENIED):
// chama o coletor por navegador da Batelada B11 (import dinamico, so quando precisa, pra nao
// pesar toda sincronizacao com o custo de abrir o Chromium quando a API ja respondeu).
async function tentarNavegador(rede, { clientSlug, desde }) {
  try {
    const mod = await import("./sync-publicacoes-navegador.mjs")
    const coletor = mod.COLETORES_NAVEGADOR[rede]
    if (!coletor) return null
    return await coletor({ clientSlug, desde, headless: true })
  } catch (e) {
    return { itens: [], aviso: `${rede}: navegador indisponível` }
  }
}

function parseArgs(argv) {
  const args = { cliente: null, dias: 30, rede: "todas", dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cliente") args.cliente = argv[++i]
    else if (argv[i] === "--dias") args.dias = Number(argv[++i])
    else if (argv[i] === "--rede") args.rede = argv[++i]
    else if (argv[i] === "--dry-run") args.dryRun = true
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const clientSlug = validarCliente(args.cliente ?? resolveClient())
  const desde = new Date(Date.now() - args.dias * 24 * 60 * 60 * 1000)
  const redesAlvo = args.rede === "todas" ? ["instagram", "youtube", "linkedin", "tiktok"] : [args.rede]

  const databaseUrl = process.env.DATABASE_URL
  if (!args.dryRun && !databaseUrl) {
    console.error("DATABASE_URL nao definida (.env.local).")
    process.exitCode = 1
    return
  }
  const pool = criarPool(databaseUrl)

  await import("tsx")
  const { lerCredencialOAuth } = await import("../../src/lib/sala/oauth-credentials.ts")
  const { default: db } = await import("../../src/lib/db.ts")
  const poolCofre = db.default ?? db
  const porRede = {}
  const via = {}
  const avisos = []

  for (const rede of redesAlvo) {
    console.error(`[sync-publicacoes] coletando ${rede}...`)
    let resultado
    let origemDado = "api"
    if (rede === "tiktok") {
      resultado = await coletarTiktok({ pool, clientSlug, desde })
    } else {
      const coletor = COLETORES[rede]
      if (!coletor) { avisos.push(`${rede}: rede desconhecida`); continue }
      const env = ambienteDoCliente(process.env, clientSlug)
      try {
        const cred = await lerCredencialOAuth(clientSlug, rede)
        if (cred) {
          if (rede === "instagram") env.INSTAGRAM_ACCESS_TOKEN = cred.accessToken
          if (rede === "linkedin") env.LINKEDIN_ACCESS_TOKEN = cred.accessToken
          if (rede === "youtube") env.YOUTUBE_REFRESH_TOKEN = cred.refreshToken ?? ""
        }
        resultado = await coletor({ env, fetchImpl: fetch, clientSlug, desde })
      } catch {
        resultado = { itens: [], aviso: `${rede}: credencial salva indisponível` }
      }
    }
    if (resultado.aviso) avisos.push(resultado.aviso)

    // TikTok nunca teve API de leitura (so o snapshot semanal); LinkedIn devolve 403 porque o
    // token so tem escopo de escrita. Nos dois casos, tenta o coletor por navegador (B11) antes
    // de desistir da rede.
    const semApi = rede === "tiktok" && resultado.itens.length === 0
    const permissaoNegada = /403|ACCESS_DENIED/i.test(resultado.aviso ?? "")
    if (semApi || permissaoNegada) {
      const fallback = await tentarNavegador(rede, { clientSlug, desde })
      if (fallback?.itens?.length) {
        resultado = fallback
        origemDado = "navegador"
        console.error(`[sync-publicacoes] ${rede}: API sem dado, usando navegador`)
      } else if (fallback?.aviso) {
        avisos.push(fallback.aviso)
      }
    }

    const gravados = args.dryRun ? resultado.itens.length : await gravar(pool, resultado.itens)
    porRede[rede] = gravados
    via[rede] = origemDado
    console.error(`[sync-publicacoes] ${rede}: ${gravados} publicacao(oes) via ${origemDado}${args.dryRun ? " (dry-run, nao gravado)" : ""}`)
  }

  if (pool) await pool.end()
  await poolCofre.end()
  console.log(JSON.stringify({ porRede, via, avisos }))
}

export function validarCliente(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !ALLOWED.has(slug)) {
    throw new Error("Cliente inexistente ou inválido")
  }
  return slug
}

// So roda o CLI quando chamado diretamente (o caminho do modulo bate com o argv[1]); os
// testes importam so os normalizadores acima, sem disparar main().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error("Falha ao sincronizar publicações. Confira a conexão e o banco local.")
    process.exitCode = 1
    process.exit(1)
  })
}

// Variáveis de uma instalação antiga só pertencem ao cliente explicitamente vinculado.
export function ambienteDoCliente(env, cliente) {
  const resultado = { ...env }
  if (env.SALA_LEGACY_TOKEN_CLIENT !== cliente) {
    for (const chave of ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID", "LINKEDIN_ACCESS_TOKEN", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_ACCESS_TOKEN"]) delete resultado[chave]
  }
  return resultado
}
