// Nucleo OAuth da Sala Fase 2 (D2). Funcoes finas o bastante pra serem chamadas
// pelas rotas /api/sala/oauth/{rede} e testadas localmente com fetch simulado.
import { randomBytes, createHmac, timingSafeEqual, createHash } from "node:crypto"
import { OAuth2Client, LinkedIn, Google, generateCodeVerifier, OAuth2Tokens } from "arctic"
import { query } from "@/lib/db"
import { lerSegredoSala } from "@/lib/sala/cofre"
import type { NomeCampoCofre } from "@/lib/sala/cofre-campos"

export const REDES_OAUTH = ["linkedin", "youtube", "instagram", "meta_ads"] as const
export type RedeOAuth = (typeof REDES_OAUTH)[number]

export function redeValida(rede: string): rede is RedeOAuth {
  return (REDES_OAUTH as readonly string[]).includes(rede)
}

const ORIGIN_PADRAO = "http://localhost:5056"
const COOKIE_MAX_AGE_SEGUNDOS = 600
const COOKIE_TAMANHO_MAXIMO = 4096
const PROPOSITO_HMAC = "sala-oauth-state"

interface EstadoOAuth {
  userId: string
  cliente: string
  rede: RedeOAuth
  nonce: string
  expiry: number
  verifier?: string
}

interface EstadoOAuthRow {
  state_hash: string
}

function chaveHmac(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters")
  }
  return Buffer.from(key, "utf-8")
}

function assinar(payload: string): string {
  return createHmac("sha256", chaveHmac()).update(`${PROPOSITO_HMAC}:${payload}`).digest("base64url")
}

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8")
  const bufB = Buffer.from(b, "utf-8")
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function hashState(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex")
}

export function resolverOrigin(): string {
  const bruta = process.env.SALA_OAUTH_ORIGIN || ORIGIN_PADRAO
  try {
    const url = new URL(bruta)
    const protocoloValido = url.protocol === "http:" || url.protocol === "https:"
    const hostLoopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    const semExtras =
      url.username === "" && url.password === "" && (url.pathname === "" || url.pathname === "/") && url.search === "" && url.hash === ""
    if (protocoloValido && (hostLoopback || url.protocol === "https:") && semExtras) {
      return `${url.protocol}//${url.host}`
    }
  } catch {
    // Configuracao invalida deve falhar sem expor o valor.
  }
  throw new Error("Endereco OAuth invalido")
}

function nomeCookie(rede: RedeOAuth): string {
  return `sala_oauth_state_${rede}`
}

export function montarSetCookie(rede: RedeOAuth, valor: string, maxAgeSegundos: number): string {
  const origin = resolverOrigin()
  const secure = origin.startsWith("https://")
  const partes = [
    `${nomeCookie(rede)}=${valor}`,
    `Path=/api/sala/oauth/${rede}`,
    `Max-Age=${maxAgeSegundos}`,
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (secure) partes.push("Secure")
  return partes.join("; ")
}

export function limparSetCookie(rede: RedeOAuth): string {
  return `${nomeCookie(rede)}=; Path=/api/sala/oauth/${rede}; Max-Age=0; HttpOnly; SameSite=Lax`
}

export async function criarEstadoOAuth(params: {
  userId: string
  cliente: string
  rede: RedeOAuth
}): Promise<{ state: string; cookie: string; verifier?: string }> {
  chaveHmac()
  resolverOrigin()
  const nonce = randomBytes(32).toString("base64url")
  const expiry = Date.now() + COOKIE_MAX_AGE_SEGUNDOS * 1000
  const verifier = params.rede === "youtube" ? generateCodeVerifier() : undefined

  const stateHash = hashState(nonce)
  await query(
    `insert into ct_sala_oauth_states (state_hash, client_slug, user_id, service, expires_at)
     values ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
    [stateHash, params.cliente, params.userId, params.rede, expiry]
  )

  const estado: EstadoOAuth = {
    userId: params.userId,
    cliente: params.cliente,
    rede: params.rede,
    nonce,
    expiry,
    verifier,
  }
  const payload = Buffer.from(JSON.stringify(estado), "utf-8").toString("base64url")
  const assinatura = assinar(payload)
  const cookie = `${payload}.${assinatura}`

  return { state: nonce, cookie, verifier }
}

export function lerEstadoCookie(cookieValue: string | undefined | null): EstadoOAuth | null {
  if (!cookieValue) return null
  if (cookieValue.length > COOKIE_TAMANHO_MAXIMO) return null

  const partes = cookieValue.split(".")
  if (partes.length !== 2) return null
  const [payload, assinatura] = partes
  if (!payload || !assinatura) return null

  try {
    const assinaturaEsperada = assinar(payload)
    if (!compararSeguro(assinatura, assinaturaEsperada)) return null
    const json = Buffer.from(payload, "base64url").toString("utf-8")
    const estado = JSON.parse(json) as EstadoOAuth
    if (
      typeof estado.userId !== "string" ||
      typeof estado.cliente !== "string" ||
      typeof estado.nonce !== "string" ||
      typeof estado.expiry !== "number" ||
      !redeValida(estado.rede)
    ) {
      return null
    }
    if (Date.now() > estado.expiry) return null
    return estado
  } catch {
    return null
  }
}

export async function consumirNonceOAuth(params: {
  nonce: string
  cliente: string
  userId: string
  rede: RedeOAuth
}): Promise<boolean> {
  const stateHash = hashState(params.nonce)
  const rows = await query<EstadoOAuthRow>(
    `update ct_sala_oauth_states
     set used_at = now()
     where state_hash = $1
       and client_slug = $2
       and user_id = $3
       and service = $4
       and used_at is null
       and expires_at > now()
     returning state_hash`,
    [stateHash, params.cliente, params.userId, params.rede]
  )
  return rows.length > 0
}

interface CredenciaisApp {
  clientId: string
  clientSecret: string
}

const CAMPOS_APP: Record<RedeOAuth, [NomeCampoCofre, NomeCampoCofre]> = {
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
  instagram: ["IG_APP_ID", "INSTAGRAM_APP_SECRET"],
  meta_ads: ["IG_APP_ID", "INSTAGRAM_APP_SECRET"],
}

function credenciaisApp(rede: RedeOAuth, credenciais?: Partial<CredenciaisApp>): CredenciaisApp {
  const [chaveId, chaveSecret] = CAMPOS_APP[rede]
  const clientId = credenciais?.clientId ?? process.env[chaveId]
  const clientSecret = credenciais?.clientSecret ?? process.env[chaveSecret]
  if (!clientId || !clientSecret) {
    throw new Error(`Credenciais do app ausentes para ${rede}`)
  }
  return { clientId, clientSecret }
}

export async function credenciaisOAuthDaSala(cliente: string, rede: RedeOAuth): Promise<CredenciaisApp> {
  const [chaveId, chaveSecret] = CAMPOS_APP[rede]
  return credenciaisApp(rede, {
    clientId: await lerSegredoSala(cliente, chaveId) ?? "",
    clientSecret: await lerSegredoSala(cliente, chaveSecret) ?? "",
  })
}

function redirectUri(rede: RedeOAuth): string {
  return `${resolverOrigin()}/api/sala/oauth/${rede}/callback`
}

export function validarConfiguracaoOAuth(rede: RedeOAuth, credenciais?: Partial<CredenciaisApp>): void {
  chaveHmac()
  resolverOrigin()
  credenciaisApp(rede, credenciais)
}

const META_AUTH_URL = "https://www.facebook.com/v26.0/dialog/oauth"
const META_TOKEN_URL = "https://graph.facebook.com/v26.0/oauth/access_token"

function escoposMeta(rede: "instagram" | "meta_ads"): string[] {
  if (rede === "instagram") return ["public_profile", "instagram_basic", "pages_show_list"]
  return ["public_profile", "ads_read"]
}

export function montarUrlAutorizacao(rede: RedeOAuth, state: string, verifier?: string, credenciais?: Partial<CredenciaisApp>): URL {
  const { clientId, clientSecret } = credenciaisApp(rede, credenciais)
  const redirect = redirectUri(rede)

  if (rede === "linkedin") {
    const provider = new LinkedIn(clientId, clientSecret, redirect)
    return provider.createAuthorizationURL(state, ["openid", "profile"])
  }

  if (rede === "youtube") {
    if (!verifier) throw new Error("Verifier PKCE ausente para youtube")
    const provider = new Google(clientId, clientSecret, redirect)
    const url = provider.createAuthorizationURL(state, verifier, ["https://www.googleapis.com/auth/youtube.readonly"])
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
    return url
  }

  const client = new OAuth2Client(clientId, clientSecret, redirect)
  return client.createAuthorizationURL(META_AUTH_URL, state, escoposMeta(rede))
}

const TIMEOUT_TROCA_MS = 10000

export interface TokensObtidos {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date | null
}

function extrairTokens(tokens: OAuth2Tokens): TokensObtidos {
  const accessToken = tokens.accessToken()
  let refreshToken: string | undefined
  if (tokens.hasRefreshToken()) {
    refreshToken = tokens.refreshToken()
  }
  let expiresAt: Date | null = null
  try {
    expiresAt = tokens.accessTokenExpiresAt()
  } catch {
    expiresAt = null
  }
  return { accessToken, refreshToken, expiresAt }
}

export async function trocarCodigoPorTokens(rede: RedeOAuth, code: string, verifier?: string, credenciais?: Partial<CredenciaisApp>): Promise<TokensObtidos> {
  const { clientId, clientSecret } = credenciaisApp(rede, credenciais)
  const endpoints: Record<RedeOAuth, string> = {
    linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
    youtube: "https://oauth2.googleapis.com/token",
    instagram: META_TOKEN_URL,
    meta_ads: META_TOKEN_URL,
  }
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(rede), client_id: clientId, client_secret: clientSecret })
  if (rede === "youtube") {
    if (!verifier) throw new Error("Verifier PKCE ausente")
    body.set("code_verifier", verifier)
  }
  const resposta = await fetch(endpoints[rede], {
    method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" },
    redirect: "error", signal: AbortSignal.timeout(TIMEOUT_TROCA_MS),
  })
  if (!resposta.ok) throw new Error("Falha na autorizacao")
  return extrairTokens(new OAuth2Tokens(await resposta.json()))
}
