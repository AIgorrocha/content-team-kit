// scripts/publishing/_lib/ig-account.mjs
// Escolha da conta de Instagram pela CHAVE (--account principal|business), nao pelo slug.
// Os quatro publicadores de Instagram usam isto: mesma regra, um lugar so.
//
//   principal -> INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID (token IGAA, graph.instagram.com)
//   business  -> INSTAGRAM_BUSINESS_ACCESS_TOKEN (ou META_ACCESS_TOKEN EAAN) /
//                INSTAGRAM_BUSINESS_USER_ID (graph.facebook.com quando o token e EAAN)

import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const VERSION = "v21.0"
export const IG_ACCOUNT_KEYS = ["principal", "business"]

const ENV_HINT = {
  principal: "INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID (veja docs/CONECTAR-REDES.md, secao Instagram)",
  business: "INSTAGRAM_BUSINESS_ACCESS_TOKEN (ou META_ACCESS_TOKEN) e INSTAGRAM_BUSINESS_USER_ID",
}

/**
 * Resolve a conta. `accounts` e `env` so existem para teste; em uso normal vem do kit.
 * Devolve { key, clientSlug, handle, token, userId, direct, graph }.
 * Lanca erro claro (sem imprimir token) se a chave e invalida ou a conta nao esta configurada.
 */
export function resolveIgAccount({ account = "principal", accounts, env = process.env } = {}) {
  if (!IG_ACCOUNT_KEYS.includes(account)) {
    throw new Error(`--account invalido: "${account}". Use principal ou business.`)
  }
  const all = accounts || require("../../../skills/_shared/ig-accounts.cjs").CLIENT_ACCOUNTS
  const acc = all[account]
  if (!acc) {
    throw new Error(`Conta Instagram "${account}" nao configurada. Preencha ${ENV_HINT[account]} no .env.local.`)
  }
  const { token, userId } = acc.creds(env)
  if (!token) {
    throw new Error(`Token da conta "${account}" faltando. Preencha ${ENV_HINT[account]} no .env.local.`)
  }
  const direct = String(token).startsWith("IGAA")
  return {
    key: account,
    clientSlug: acc.clientSlug,
    handle: acc.handle || "",
    token,
    userId: userId || "",
    direct,
    graph: direct ? `https://graph.instagram.com/${VERSION}` : `https://graph.facebook.com/${VERSION}`,
  }
}

/** Id da conta: o configurado, ou /me quando o token e IGAA. Token EAAN exige o id no .env.local. */
export async function resolveIgUserId(acc, override = null, fetchFn = fetch) {
  const id = override || acc.userId
  if (id) return id
  if (!acc.direct) {
    throw new Error(`INSTAGRAM_BUSINESS_USER_ID obrigatorio para a conta "${acc.key}" (token nao e IGAA)`)
  }
  const r = await fetchFn(`${acc.graph}/me?fields=user_id&access_token=${acc.token}`)
  const j = await r.json()
  if (j.error) throw new Error("nao consegui resolver o id da conta Instagram: " + (j.error.message || "erro"))
  return j.user_id || j.id
}

/** Permalink real do post (nunca o id de midia). Null se a Graph nao devolver. */
export async function fetchPermalink(acc, mediaId, fetchFn = fetch) {
  const r = await fetchFn(`${acc.graph}/${mediaId}?fields=permalink&access_token=${acc.token}`)
  const j = await r.json().catch(() => ({}))
  return j.permalink || null
}

/** Instagram aceita no maximo 5 hashtags por post desde dez/2025 (references/instagram-algoritmo.md). */
export function assertMaxHashtags(caption, max = 5) {
  const n = (String(caption).match(/#[\p{L}_][\p{L}\p{N}_]*/gu) || []).length
  if (n > max) {
    throw new Error(`legenda tem ${n} hashtags; o Instagram aceita no maximo ${max}. Corte para ${max} ou menos e rode de novo.`)
  }
  return n
}
