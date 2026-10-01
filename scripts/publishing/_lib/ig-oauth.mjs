// scripts/publishing/_lib/ig-oauth.mjs
// Pecas puras do login do Instagram (Instagram Login, token IGAA de longa duracao).
// Usadas por scripts/publishing/instagram-auth-local.mjs e testadas sem rede.

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
]

/** Variaveis do .env.local por conta (mesmas que scripts/publishing/_lib/ig-account.mjs le). */
export const IG_ENV_VARS = {
  principal: { token: "INSTAGRAM_ACCESS_TOKEN", userId: "INSTAGRAM_USER_ID" },
  business: { token: "INSTAGRAM_BUSINESS_ACCESS_TOKEN", userId: "INSTAGRAM_BUSINESS_USER_ID" },
}

export function buildAuthUrl({ appId, redirect, state, scopes = IG_SCOPES }) {
  const u = new URL("https://www.instagram.com/oauth/authorize")
  u.searchParams.set("client_id", appId)
  u.searchParams.set("redirect_uri", redirect)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", scopes.join(","))
  u.searchParams.set("state", state)
  return u.toString()
}

/** A Meta devolve { access_token, user_id } ou { data: [ { access_token, user_id } ] }. */
export function pickShortToken(json) {
  const d = json?.data?.[0] || json || {}
  if (!d.access_token) throw new Error("a Meta nao devolveu token de acesso")
  return { token: d.access_token, userId: d.user_id ? String(d.user_id) : "" }
}

/** Dias ate o token vencer, para avisar a pessoa (sem mostrar o token). */
export const diasAteVencer = (expiresIn) => (expiresIn ? Math.round(expiresIn / 86400) : null)
