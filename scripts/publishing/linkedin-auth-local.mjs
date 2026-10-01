#!/usr/bin/env node
/**
 * linkedin-auth-local.mjs - Gera o token de PUBLICAR do LinkedIn (escopo w_member_social)
 * e grava no .env.local, sem imprimir o token. Tambem descobre o LINKEDIN_PERSON_ID.
 *
 * O painel (Conectar/Testar) so le metricas. Quem publica (post-linkedin.mjs e
 * publish-linkedin-*.mjs) usa o LINKEDIN_ACCESS_TOKEN do .env.local, gerado aqui.
 *
 * Antes (1 vez): LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET no .env.local, e no app do LinkedIn
 * (aba Autenticacao, URLs de redirecionamento) cadastrar exatamente:
 *   http://localhost:8765/callback
 * O app precisa dos produtos "Share on LinkedIn" e "Sign In with LinkedIn using OpenID Connect".
 *
 * Uso: node scripts/publishing/linkedin-auth-local.mjs
 * Opcional: LINKEDIN_SCOPES no .env.local (padrao: w_member_social openid profile). Para publicar
 * como pagina de empresa, o app precisa da Community Management API e do escopo w_organization_social.
 * O token dura cerca de 60 dias: rode de novo para renovar.
 */
import { config } from "dotenv"
config({ path: ".env.local", override: true }); config({ path: ".env" })
import { captureAuthCode, newState, saveEnvVar, registrarSemFalhar, OAUTH_REDIRECT } from "./_lib/oauth-local.mjs"

const ENV_FILE = ".env.local"
const { LINKEDIN_CLIENT_ID: CLIENT_ID, LINKEDIN_CLIENT_SECRET: CLIENT_SECRET } = process.env
const SCOPES = process.env.LINKEDIN_SCOPES || "w_member_social openid profile"
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Faltam LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET no .env.local (docs/CONECTAR-REDES.md, secao LinkedIn).")
  process.exit(1)
}

const state = newState()
const authUrl = "https://www.linkedin.com/oauth/v2/authorization?response_type=code"
  + `&client_id=${encodeURIComponent(CLIENT_ID)}`
  + `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT)}`
  + `&scope=${encodeURIComponent(SCOPES)}`
  + `&state=${state}`

try {
  const code = await captureAuthCode({ authUrl, state })
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: OAUTH_REDIRECT, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) {
    console.error(`Falha ao trocar o codigo por token (${r.status}): ${j.error_description || j.error || "sem detalhe"}`)
    process.exit(1)
  }
  saveEnvVar(ENV_FILE, "LINKEDIN_ACCESS_TOKEN", j.access_token)
  const dias = j.expires_in ? Math.round(j.expires_in / 86400) : null
  console.log(`TOKEN salvo em ${ENV_FILE}${dias ? ` (vale ~${dias} dias)` : ""}. Nao foi impresso.`)

  const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${j.access_token}` } })
  const p = await me.json().catch(() => ({}))
  if (p.sub) {
    saveEnvVar(ENV_FILE, "LINKEDIN_PERSON_ID", p.sub)
    console.log(`LINKEDIN_PERSON_ID salvo. Conta conectada: ${p.name || p.sub}`)
  } else {
    console.log("Nao consegui ler o perfil (falta o escopo openid/profile). Preencha LINKEDIN_PERSON_ID na mao.")
  }
  await registrarSemFalhar({
    service: "linkedin", obtained_at: new Date().toISOString(),
    expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null,
    renew_kind: "manual", status: "ok",
  })
  console.log("Pronto. Teste sem publicar: node scripts/publishing/post-linkedin.mjs --caption-file <texto.txt> --dry-run")
} catch (e) {
  console.error("Falha na autorizacao:", e.message)
  process.exit(1)
}
