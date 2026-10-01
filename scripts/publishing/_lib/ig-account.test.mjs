// node --test scripts/publishing/_lib/ig-account.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveIgAccount, resolveIgUserId } from "./ig-account.mjs"

const creds = {
  principal: (env) => ({ token: env.INSTAGRAM_ACCESS_TOKEN || "", userId: env.INSTAGRAM_USER_ID || "" }),
  business: (env) => ({ token: env.INSTAGRAM_BUSINESS_ACCESS_TOKEN || "", userId: env.INSTAGRAM_BUSINESS_USER_ID || "" }),
}
const accounts = {
  principal: { clientSlug: "acme", handle: "acme", creds: creds.principal },
  business: { clientSlug: "acme", handle: "acme.biz", creds: creds.business },
}
const env = {
  INSTAGRAM_ACCESS_TOKEN: "IGAAprincipal", INSTAGRAM_USER_ID: "111",
  INSTAGRAM_BUSINESS_ACCESS_TOKEN: "EAANbusiness", INSTAGRAM_BUSINESS_USER_ID: "222",
}

test("padrao e a conta principal, token IGAA usa graph.instagram.com", () => {
  const a = resolveIgAccount({ accounts, env })
  assert.equal(a.key, "principal")
  assert.equal(a.token, "IGAAprincipal")
  assert.equal(a.userId, "111")
  assert.ok(a.direct && a.graph.startsWith("https://graph.instagram.com/"))
})

test("--account business escolhe pela chave e usa graph.facebook.com com token EAAN", () => {
  const a = resolveIgAccount({ account: "business", accounts, env })
  assert.equal(a.key, "business")
  assert.equal(a.token, "EAANbusiness")
  assert.equal(a.userId, "222")
  assert.ok(!a.direct && a.graph.startsWith("https://graph.facebook.com/"))
})

test("mesmo slug nas duas contas nao mistura as credenciais", () => {
  assert.equal(accounts.principal.clientSlug, accounts.business.clientSlug)
  assert.notEqual(resolveIgAccount({ accounts, env }).token, resolveIgAccount({ account: "business", accounts, env }).token)
})

test("chave invalida, conta ausente e token ausente dao erro claro", () => {
  assert.throws(() => resolveIgAccount({ account: "outra", accounts, env }), /invalido/)
  assert.throws(() => resolveIgAccount({ account: "business", accounts: { principal: accounts.principal }, env }), /nao configurada/)
  assert.throws(() => resolveIgAccount({ accounts, env: {} }), /Token da conta "principal" faltando/)
})

test("token EAAN sem id no .env.local pede o id; IGAA resolve por /me", async () => {
  const eaan = resolveIgAccount({ account: "business", accounts, env: { ...env, INSTAGRAM_BUSINESS_USER_ID: "" } })
  await assert.rejects(() => resolveIgUserId(eaan), /INSTAGRAM_BUSINESS_USER_ID/)
  const igaa = resolveIgAccount({ accounts, env: { ...env, INSTAGRAM_USER_ID: "" } })
  const fake = async () => ({ json: async () => ({ user_id: "999" }) })
  assert.equal(await resolveIgUserId(igaa, null, fake), "999")
  assert.equal(await resolveIgUserId(igaa, "555", fake), "555")
})

test("limite de 5 hashtags no Instagram", async () => {
  const { assertMaxHashtags } = await import("./ig-account.mjs")
  assert.equal(assertMaxHashtags("texto #a #b #c #d #e"), 5)
  assert.equal(assertMaxHashtags("Rank #4 e C# nao contam"), 0)
  assert.throws(() => assertMaxHashtags("#a #b #c #d #e #f"), /6 hashtags/)
})
