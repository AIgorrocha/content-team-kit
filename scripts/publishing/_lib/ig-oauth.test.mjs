// node --test scripts/publishing/_lib/ig-oauth.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildAuthUrl, pickShortToken, diasAteVencer, IG_ENV_VARS } from "./ig-oauth.mjs"

test("url de autorizacao tem app, retorno, escopo de publicar e state", () => {
  const u = new URL(buildAuthUrl({ appId: "123", redirect: "http://localhost:8765/callback", state: "s" }))
  assert.equal(u.origin + u.pathname, "https://www.instagram.com/oauth/authorize")
  assert.equal(u.searchParams.get("client_id"), "123")
  assert.equal(u.searchParams.get("redirect_uri"), "http://localhost:8765/callback")
  assert.match(u.searchParams.get("scope"), /instagram_business_content_publish/)
  assert.equal(u.searchParams.get("state"), "s")
})

test("aceita as duas formas de resposta da Meta e recusa resposta sem token", () => {
  assert.deepEqual(pickShortToken({ access_token: "IGAA1", user_id: 7 }), { token: "IGAA1", userId: "7" })
  assert.deepEqual(pickShortToken({ data: [{ access_token: "IGAA2", user_id: "8" }] }), { token: "IGAA2", userId: "8" })
  assert.throws(() => pickShortToken({ error: "x" }), /nao devolveu token/)
})

test("contas gravam nas variaveis que os publicadores leem", () => {
  assert.equal(IG_ENV_VARS.principal.token, "INSTAGRAM_ACCESS_TOKEN")
  assert.equal(IG_ENV_VARS.business.userId, "INSTAGRAM_BUSINESS_USER_ID")
  assert.equal(diasAteVencer(5184000), 60)
})
