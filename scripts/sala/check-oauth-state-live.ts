import { config } from "dotenv"
config({ path: ".env.local", quiet: true })
import assert from "node:assert/strict"
import { randomUUID, createHash } from "node:crypto"

async function main() {
  const oauth = await import("../../src/lib/sala/oauth")
  const { default: pool } = await import("../../src/lib/db")
  const cliente = `sala-oauth-state-${randomUUID()}`
  const userId = "usuario-sintetico"
  const savedFetch = globalThis.fetch
  const envAnterior = { ...process.env }
  try {
    process.env.SALA_OAUTH_ORIGIN = "https://kit.example.test"
    assert.equal(oauth.resolverOrigin(), "https://kit.example.test")
    process.env.SALA_OAUTH_ORIGIN = "http://kit.example.test"
    assert.throws(() => oauth.resolverOrigin())
    process.env.SALA_OAUTH_ORIGIN = "http://localhost:5057"
    for (const key of ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "IG_APP_ID", "INSTAGRAM_APP_SECRET"]) process.env[key] = "config-sintetica"
    const estado = await oauth.criarEstadoOAuth({ cliente, userId, rede: "linkedin" })
    const lido = oauth.lerEstadoCookie(estado.cookie)!
    assert.equal(lido.nonce, estado.state)
    assert.equal(oauth.lerEstadoCookie(`${estado.cookie}x`), null)
    assert.equal(oauth.lerEstadoCookie("x".repeat(4097)), null)
    assert.equal(oauth.lerEstadoCookie("sem.assinatura"), null)
    assert.match(oauth.montarSetCookie("linkedin", estado.cookie, 600), /HttpOnly; SameSite=Lax/)
    assert.equal(await oauth.consumirNonceOAuth({ nonce: estado.state, cliente: `${cliente}-outro`, userId, rede: "linkedin" }), false)
    assert.equal(await oauth.consumirNonceOAuth({ nonce: estado.state, cliente, userId: "outro", rede: "linkedin" }), false)
    assert.equal(await oauth.consumirNonceOAuth({ nonce: estado.state, cliente, userId, rede: "youtube" }), false)
    const consumo = await Promise.all(Array.from({ length: 8 }, () => oauth.consumirNonceOAuth({ nonce: estado.state, cliente, userId, rede: "linkedin" })))
    assert.equal(consumo.filter(Boolean).length, 1)
    const vencido = await oauth.criarEstadoOAuth({ cliente, userId, rede: "linkedin" })
    await pool.query("update ct_sala_oauth_states set expires_at=now()-interval '1 second' where state_hash=$1", [createHash("sha256").update(vencido.state).digest("hex")])
    assert.equal(await oauth.consumirNonceOAuth({ nonce: vencido.state, cliente, userId, rede: "linkedin" }), false)
    const google = await oauth.criarEstadoOAuth({ cliente, userId, rede: "youtube" })
    const url = oauth.montarUrlAutorizacao("youtube", google.state, google.verifier)
    assert.equal(url.searchParams.get("code_challenge_method"), "S256")
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:5057/api/sala/oauth/youtube/callback")
    assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/youtube.readonly")
    let chamadas = 0
    globalThis.fetch = async (_url, init) => {
      chamadas++
      assert.equal(init?.method, "POST")
      assert.equal(init?.redirect, "error")
      assert.ok(init?.signal)
      const body = init?.body as URLSearchParams
      assert.equal(body.get("grant_type"), "authorization_code")
      if (String(_url).includes("googleapis")) assert.equal(body.get("code_verifier"), google.verifier)
      return new Response(JSON.stringify({ access_token: "token-sintetico", refresh_token: "refresh-sintetico", expires_in: 3600 }), { status: 200 })
    }
    for (const rede of oauth.REDES_OAUTH) {
      const tokens = await oauth.trocarCodigoPorTokens(rede, "code-sintetico", google.verifier)
      assert.equal(tokens.accessToken, "token-sintetico")
      assert.ok(tokens.expiresAt && tokens.expiresAt.getTime() > Date.now())
    }
    assert.equal(chamadas, 4)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
    await assert.rejects(oauth.trocarCodigoPorTokens("linkedin", "invalido"), /Falha na autorizacao/)
    console.log("OAuth: origem, HMAC, vinculo usuario/cliente/rede, nonce unico, expiracao, PKCE e troca simulada das quatro redes passaram.")
  } finally {
    globalThis.fetch = savedFetch
    for (const key of Object.keys(process.env)) if (!(key in envAnterior)) delete process.env[key]
    Object.assign(process.env, envAnterior)
    await pool.query("delete from ct_sala_oauth_states where client_slug=$1", [cliente])
    assert.equal((await pool.query("select count(*)::int n from ct_sala_oauth_states where client_slug=$1", [cliente])).rows[0].n, 0)
    console.log("Limpeza confirmada: zero estados OAuth sinteticos.")
    await pool.end()
  }
}
main().catch(() => { console.error("Falha na prova do estado OAuth."); process.exitCode = 1 })
