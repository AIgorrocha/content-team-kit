import { config } from "dotenv"
config({ path: ".env.local", quiet: true })
import assert from "node:assert/strict"
import { randomUUID, randomBytes, createHash } from "node:crypto"

async function main() {
  const { default: pool } = await import("../../src/lib/db")
  const { salvarCredencialOAuth, lerCredencialOAuth } = await import("../../src/lib/sala/oauth-credentials")
  const cliente = `sala-oauth-${randomUUID()}`
  const outro = `${cliente}-outro`
  const tokenA = randomBytes(24).toString("hex")
  const tokenB = randomBytes(24).toString("hex")
  const refresh = randomBytes(24).toString("hex")
  const expires = new Date(Date.now() + 3600000)
  const keys = [cliente, outro].map((slug) => createHash("sha256").update(slug).digest("hex"))
  try {
    await salvarCredencialOAuth({ cliente, rede: "linkedin", accessToken: tokenA, refreshToken: refresh, expiresAt: expires })
    await salvarCredencialOAuth({ cliente: outro, rede: "linkedin", accessToken: tokenB })
    const a = await lerCredencialOAuth(cliente, "linkedin")
    const b = await lerCredencialOAuth(outro, "linkedin")
    assert.equal(a?.accessToken, tokenA)
    assert.equal(a?.refreshToken, refresh)
    assert.equal(b?.accessToken, tokenB)
    const rows = (await pool.query("select encrypted_value,iv,auth_tag from ct_credentials where service='sala_oauth_linkedin' and credential_key=any($1::text[])", [keys])).rows
    assert.equal(rows.length, 2)
    for (const row of rows) {
      assert.ok(row.iv && row.auth_tag)
      assert.equal(row.encrypted_value.includes(tokenA), false)
      assert.equal(row.encrypted_value.includes(tokenB), false)
      assert.equal(row.encrypted_value.includes(refresh), false)
    }
    await salvarCredencialOAuth({ cliente, rede: "linkedin", accessToken: tokenB, expiresAt: expires })
    assert.equal((await lerCredencialOAuth(cliente, "linkedin"))?.refreshToken, refresh)
    const conexao = (await pool.query("select credential_ref,obtained_at,expires_at from ct_connections where client_slug=$1 and service='linkedin'", [cliente])).rows[0]
    assert.ok(conexao.credential_ref && conexao.obtained_at)
    assert.equal(new Date(conexao.expires_at).getTime(), expires.getTime())
    await salvarCredencialOAuth({ cliente, rede: "youtube", accessToken: tokenA, refreshToken: refresh, expiresAt: expires })
    assert.equal((await pool.query("select expires_at from ct_connections where client_slug=$1 and service='youtube'", [cliente])).rows[0].expires_at, null)
    await pool.query("update ct_connections set credential_ref=$1 where client_slug=$2 and service='linkedin'", [conexao.credential_ref, outro])
    assert.equal(await lerCredencialOAuth(outro, "linkedin"), null)
    console.log("OAuth: criptografia, referencia, datas, preservacao de refresh e isolamento passaram.")
  } finally {
    await pool.query("delete from ct_connections where client_slug=any($1::text[])", [[cliente, outro]])
    await pool.query("delete from ct_credentials where service=any($1::text[]) and credential_key=any($2::text[])", [["sala_oauth_linkedin", "sala_oauth_youtube"], keys])
    assert.equal((await pool.query("select count(*)::int n from ct_credentials where service=any($1::text[]) and credential_key=any($2::text[])", [["sala_oauth_linkedin", "sala_oauth_youtube"], keys])).rows[0].n, 0)
    console.log("Limpeza confirmada: zero credenciais sinteticas.")
    await pool.end()
  }
}
main().catch(() => { console.error("Falha na prova do cofre OAuth."); process.exitCode = 1 })
