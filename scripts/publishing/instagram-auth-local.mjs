#!/usr/bin/env node
/**
 * instagram-auth-local.mjs - Gera o token de PUBLICAR do Instagram (token IGAA de longa duracao,
 * Instagram Login, usado com graph.instagram.com) e grava no .env.local, sem imprimir o token.
 *
 * O painel (Conectar/Testar) so le metricas. Quem publica (publish-ig-*.mjs, post-carousel.mjs)
 * usa INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID do .env.local, preenchidos aqui.
 *
 * Antes (1 vez), no app da Meta (developers.facebook.com) > Instagram > "API setup with Instagram
 * login" (confira na tela): copiar o "Instagram app ID" e o "Instagram app secret" (NAO sao o ID
 * e a chave do app principal) para IG_OAUTH_CLIENT_ID e IG_OAUTH_CLIENT_SECRET no .env.local, e
 * cadastrar em "Valid OAuth redirect URIs": http://localhost:8765/callback
 *
 * Uso:
 *   node scripts/publishing/instagram-auth-local.mjs                    gera o token (conta principal)
 *   node scripts/publishing/instagram-auth-local.mjs --account business  grava nas variaveis INSTAGRAM_BUSINESS_*
 *   node scripts/publishing/instagram-auth-local.mjs --renovar          renova o token atual (vale 60 dias; rode a cada ~50)
 *   node scripts/publishing/instagram-auth-local.mjs --completar        token ja colado no .env.local: descobre o INSTAGRAM_USER_ID
 *
 * Se a Meta recusar o endereco http://localhost, gere o token pelo botao "Generate token" do
 * proprio painel da Meta, cole em INSTAGRAM_ACCESS_TOKEN e rode --completar.
 */
import { config } from "dotenv"
config({ quiet: true, path: ".env.local", override: true }); config({ quiet: true, path: ".env" })
import { captureAuthCode, newState, saveEnvVar, registrarSemFalhar, OAUTH_REDIRECT } from "./_lib/oauth-local.mjs"
import { buildAuthUrl, pickShortToken, diasAteVencer, IG_ENV_VARS } from "./_lib/ig-oauth.mjs"

const ENV_FILE = ".env.local"
const args = process.argv.slice(2)
const has = (n) => args.includes(n)
const accIdx = args.indexOf("--account")
const account = accIdx >= 0 ? args[accIdx + 1] : "principal"
const vars = IG_ENV_VARS[account]
if (!vars) { console.error('--account invalido: use principal ou business.'); process.exit(1) }

const erro = (msg) => { console.error(msg); process.exit(1) }
const graphJson = async (url, init) => {
  const r = await fetch(url, init)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) erro(`A Meta recusou (${r.status}): ${j.error?.message || j.error_message || "sem detalhe"}`)
  return j
}
async function gravarConta(token) {
  saveEnvVar(ENV_FILE, vars.token, token)
  const me = await graphJson(`https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${token}`)
  const id = me.user_id || me.id
  if (id) saveEnvVar(ENV_FILE, vars.userId, String(id))
  console.log(`Conta conectada: @${me.username || "?"} (${vars.userId} salvo).`)
}

if (has("--completar")) {
  const token = process.env[vars.token]
  if (!token) erro(`${vars.token} esta vazio no .env.local. Cole o token la primeiro.`)
  await gravarConta(token)
  process.exit(0)
}

if (has("--renovar")) {
  const token = process.env[vars.token]
  if (!token) erro(`${vars.token} esta vazio no .env.local. Nada para renovar.`)
  const j = await graphJson(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`)
  saveEnvVar(ENV_FILE, vars.token, j.access_token)
  console.log(`Token renovado e salvo em ${ENV_FILE}. Vale mais ~${diasAteVencer(j.expires_in) ?? "?"} dias. Nao foi impresso.`)
  process.exit(0)
}

const { IG_OAUTH_CLIENT_ID: APP_ID, IG_OAUTH_CLIENT_SECRET: APP_SECRET } = process.env
if (!APP_ID || !APP_SECRET) {
  erro("Faltam IG_OAUTH_CLIENT_ID e IG_OAUTH_CLIENT_SECRET no .env.local (docs/CONECTAR-REDES.md, secao Instagram).")
}
const state = newState()
try {
  const code = await captureAuthCode({ authUrl: buildAuthUrl({ appId: APP_ID, redirect: OAUTH_REDIRECT, state }), state })
  // A Meta as vezes devolve o code com "#_" no fim.
  const curto = pickShortToken(await graphJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: "authorization_code", redirect_uri: OAUTH_REDIRECT, code: code.replace(/#_$/, "") }),
  }))
  const longo = await graphJson(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${APP_SECRET}&access_token=${curto.token}`)
  await gravarConta(longo.access_token)
  console.log(`Token de longa duracao salvo em ${ENV_FILE} (vale ~${diasAteVencer(longo.expires_in) ?? 60} dias). Nao foi impresso.`)
  await registrarSemFalhar({
    service: "instagram", obtained_at: new Date().toISOString(),
    expires_at: longo.expires_in ? new Date(Date.now() + longo.expires_in * 1000).toISOString() : null,
    renew_kind: "manual", status: "ok",
  })
  console.log("Pronto. Teste sem publicar: node scripts/publishing/publish-ig-image.mjs <imagem.png> --caption-file <legenda.txt> --dry-run")
} catch (e) {
  erro("Falha na autorizacao: " + e.message)
}
