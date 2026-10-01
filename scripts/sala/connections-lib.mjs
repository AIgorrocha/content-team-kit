// Biblioteca de conexoes (ct_connections): registro por upsert e checagem de status
// sem nunca expor segredo. Pool so e instanciado quando alguma funcao de escrita/leitura
// no banco e chamada; quem chama esta lib deve encerrar com encerrarPool() ao terminar.
import { Pool } from "pg"
import { existsSync } from "node:fs"

let pool = null

function sslConfig(databaseUrl, env) {
  const isLocalDb = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
  return !isLocalDb && env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : undefined
}

function getPool(env = process.env) {
  if (!pool) {
    const databaseUrl = env.DATABASE_URL
    if (!databaseUrl) throw new Error("DATABASE_URL ausente")
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig(databaseUrl, env),
      max: 5,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

export async function encerrarPool() {
  if (pool) {
    const p = pool
    pool = null
    await p.end()
  }
}

const CAMPOS_ATUALIZAVEIS = [
  "account_label",
  "account_id_externo",
  "obtained_at",
  "expires_at",
  "status",
  "renew_kind",
  "last_checked_at",
  "last_used_at",
  "credential_ref",
]

// Upsert manual por (client_slug, service) via advisory lock, sem depender de unique
// novo que poderia falhar com dados antigos ja existentes na tabela.
export async function registrarConexao(dados, { env = process.env } = {}) {
  const { client_slug = null, service } = dados
  if (!service) throw new Error("service obrigatorio")
  const p = getPool(env)
  const client = await p.connect()
  try {
    await client.query("BEGIN")
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
      `${client_slug || ""}:${service}`,
    ])
    const existente = await client.query(
      `select id from public.ct_connections
       where service = $1 and coalesce(client_slug, '') = coalesce($2, '')
       order by last_checked_at desc nulls last, obtained_at desc nulls last, id limit 1`,
      [service, client_slug]
    )
    const camposPresentes = CAMPOS_ATUALIZAVEIS.filter((c) =>
      Object.prototype.hasOwnProperty.call(dados, c)
    )
    let linha
    if (existente.rows[0]) {
      const id = existente.rows[0].id
      if (camposPresentes.length === 0) {
        const atual = await client.query(`select * from public.ct_connections where id = $1`, [id])
        linha = atual.rows[0]
      } else {
        const valores = [id, ...camposPresentes.map((c) => dados[c])]
        const sets = camposPresentes.map((c, i) => `${c} = $${i + 2}`)
        const resultado = await client.query(
          `update public.ct_connections set ${sets.join(", ")} where id = $1 returning *`,
          valores
        )
        linha = resultado.rows[0]
      }
    } else {
      const colunas = ["client_slug", "service", ...camposPresentes]
      const valores = [client_slug, service, ...camposPresentes.map((c) => dados[c])]
      const marcadores = valores.map((_, i) => `$${i + 1}`)
      const resultado = await client.query(
        `insert into public.ct_connections (${colunas.join(", ")})
         values (${marcadores.join(", ")}) returning *`,
        valores
      )
      linha = resultado.rows[0]
    }
    await client.query("COMMIT")
    return linha
  } catch (erro) {
    await client.query("ROLLBACK")
    throw erro
  } finally {
    client.release()
  }
}

export async function buscarConexao(clientSlug, service, { env = process.env } = {}) {
  const p = getPool(env)
  const resultado = await p.query(
    `select * from public.ct_connections
     where service = $1 and coalesce(client_slug, '') = coalesce($2, '')
     order by last_checked_at desc nulls last, obtained_at desc nulls last, id limit 1`,
    [service, clientSlug]
  )
  return resultado.rows[0] || null
}

async function comTimeout(promessa, ms) {
  let timer
  try {
    return await Promise.race([promessa, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms) })])
  } finally { clearTimeout(timer) }
}

// Classifica pela data de expiracao ja registrada (nunca fabricada aqui).
// Sem data conhecida, o servico segue "ok" enquanto a API responder valido.
function classificarPorExpiracao(expiresAt) {
  if (!expiresAt) return { status: "ok", motivo: null, expiraEmDias: null }
  const restante = new Date(expiresAt).getTime() - Date.now()
  if (!Number.isFinite(restante)) return { status: "unknown", motivo: "data invalida", expiraEmDias: null }
  const dias = Math.ceil(restante / 86400000)
  if (restante <= 0) return { status: "vencida", motivo: "data de expiracao no passado", expiraEmDias: dias }
  if (dias <= 7) return { status: "vencendo", motivo: null, expiraEmDias: dias }
  return { status: "ok", motivo: null, expiraEmDias: dias }
}

async function checarLinkedin({ env, fetchImpl, expiresAt, timeoutMs }) {
  const token = env.LINKEDIN_ACCESS_TOKEN
  if (!token) return { status: "unknown", motivo: "token ausente", expiraEmDias: null }
  try {
    const resposta = await comTimeout(
      fetchImpl("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      timeoutMs
    )
    if (resposta.status === 401) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    if (!resposta.ok) return { status: "unknown", motivo: `http ${resposta.status}`, expiraEmDias: null }
    const identidade = await resposta.json()
    if (typeof identidade?.sub !== "string" || !identidade.sub) return { status: "unknown", motivo: "identidade ausente", expiraEmDias: null }
    return classificarPorExpiracao(expiresAt)
  } catch {
    return { status: "unknown", motivo: "falha de rede", expiraEmDias: null }
  }
}

async function checarMeta({ env, fetchImpl, timeoutMs }) {
  const token = env.META_ACCESS_TOKEN
  if (!token) return { status: "unknown", motivo: "token ausente", expiraEmDias: null }
  try {
    const resposta = await comTimeout(
      fetchImpl("https://graph.facebook.com/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      timeoutMs
    )
    if (resposta.status === 401) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    const corpo = await resposta.json()
    if ([190, 102].includes(corpo?.error?.code)) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    if (!resposta.ok || !corpo?.id) return { status: "unknown", motivo: "checagem inconclusiva", expiraEmDias: null }
    return { status: "ok", motivo: null, expiraEmDias: null }
  } catch {
    return { status: "unknown", motivo: "falha de rede", expiraEmDias: null }
  }
}

async function checarInstagram({ env, fetchImpl, timeoutMs }) {
  const token = env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return { status: "unknown", motivo: "token ausente", expiraEmDias: null }
  const nativo = env.INSTAGRAM_TOKEN_KIND === "nativo"
  const host = nativo ? "graph.instagram.com" : "graph.facebook.com"
  try {
    const resposta = await comTimeout(
      fetchImpl(`https://${host}/me`, { headers: { Authorization: `Bearer ${token}` } }),
      timeoutMs
    )
    if (resposta.status === 401) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    const identidade = await resposta.json()
    if ([190, 102].includes(identidade?.error?.code)) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    if (!resposta.ok || !identidade?.id) return { status: "unknown", motivo: "checagem inconclusiva", expiraEmDias: null }
    const appId = env.IG_APP_ID
    const appSecret = env.INSTAGRAM_APP_SECRET
    if (appId && appSecret) {
      const debugResp = await comTimeout(
        fetchImpl(
          `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}`,
          { headers: { Authorization: `Bearer ${appId}|${appSecret}` } }
        ),
        timeoutMs
      )
      if (debugResp.ok) {
        const corpo = await debugResp.json()
        if (corpo?.data?.is_valid === false) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
        if (corpo?.data?.is_valid !== true) return { status: "unknown", motivo: "checagem inconclusiva", expiraEmDias: null }
        const expiraEm = corpo?.data?.expires_at
        if (typeof expiraEm === "number" && expiraEm > 0) {
          const expires_at = new Date(expiraEm * 1000).toISOString()
          return { ...classificarPorExpiracao(expires_at), expires_at }
        }
      } else {
        return { status: "unknown", motivo: "checagem inconclusiva", expiraEmDias: null }
      }
    }
    return { status: "ok", motivo: null, expiraEmDias: null }
  } catch {
    return { status: "unknown", motivo: "falha de rede", expiraEmDias: null }
  }
}

async function checarYoutube({ env, fetchImpl, timeoutMs }) {
  const refreshToken = env.YOUTUBE_REFRESH_TOKEN
  const clientId = env.YOUTUBE_CLIENT_ID
  const clientSecret = env.YOUTUBE_CLIENT_SECRET
  if (!refreshToken && env.YOUTUBE_ACCESS_TOKEN) {
    return checarCanalYoutube(env.YOUTUBE_ACCESS_TOKEN, fetchImpl, timeoutMs)
  }
  if (!refreshToken || !clientId || !clientSecret) {
    return { status: "unknown", motivo: "credenciais ausentes", expiraEmDias: null }
  }
  try {
    const tokenResp = await comTimeout(
      fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }),
      timeoutMs
    )
    if (tokenResp.status === 400) {
      const corpo = await tokenResp.json().catch(() => ({}))
      if (corpo.error === "invalid_grant") return { status: "vencida", motivo: "refresh token invalido", expiraEmDias: null }
      return { status: "unknown", motivo: "erro na renovacao", expiraEmDias: null }
    }
    if (!tokenResp.ok) return { status: "unknown", motivo: `http ${tokenResp.status}`, expiraEmDias: null }
    const { access_token } = await tokenResp.json()
    if (!access_token) return { status: "unknown", motivo: "sem access token", expiraEmDias: null }
    return checarCanalYoutube(access_token, fetchImpl, timeoutMs)
  } catch {
    return { status: "unknown", motivo: "falha de rede", expiraEmDias: null }
  }
}

async function checarCanalYoutube(access_token, fetchImpl, timeoutMs) {
  try {
    const canalResp = await comTimeout(
      fetchImpl("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      timeoutMs
    )
    if (canalResp.status === 401) return { status: "vencida", motivo: "token invalido", expiraEmDias: null }
    if (!canalResp.ok) return { status: "unknown", motivo: `http ${canalResp.status}`, expiraEmDias: null }
    const canais = await canalResp.json()
    if (!Array.isArray(canais?.items) || !canais.items.some((canal) => canal?.id)) return { status: "unknown", motivo: "canal ausente", expiraEmDias: null }
    return { status: "ok", motivo: null, expiraEmDias: null }
  } catch {
    return { status: "unknown", motivo: "falha de rede", expiraEmDias: null }
  }
}

async function checarTiktok({ sessionDir }) {
  if (sessionDir && existsSync(sessionDir)) {
    return { status: "session", motivo: null, expiraEmDias: null }
  }
  return { status: "unknown", motivo: "sessao nao configurada", expiraEmDias: null }
}

// Checagem em rede, sem segredo no retorno; fetchImpl e injetavel pra teste com respostas simuladas.
export async function checarConexao(service, opcoes = {}) {
  const { env = process.env, fetchImpl: origemFetch = fetch, expiresAt = null, sessionDir = null, timeoutMs = 8000 } = opcoes
  const fetchImpl = (url, init) => origemFetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) })
  switch (service) {
    case "linkedin":
      return checarLinkedin({ env, fetchImpl, expiresAt, timeoutMs })
    case "meta_ads":
      return checarMeta({ env, fetchImpl, timeoutMs })
    case "instagram":
      return checarInstagram({ env, fetchImpl, timeoutMs })
    case "youtube":
      return checarYoutube({ env, fetchImpl, timeoutMs })
    case "tiktok":
      return checarTiktok({ sessionDir })
    default:
      return { status: "unknown", motivo: "servico desconhecido", expiraEmDias: null }
  }
}
