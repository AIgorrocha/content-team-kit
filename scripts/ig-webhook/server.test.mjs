// Testes do servidor ig-webhook (node --test scripts/ig-webhook/server.test.mjs).
// Sobe o server.mjs de verdade em 127.0.0.1, porta livre, com segredos ficticios e
// DRY_SEND=1 (so registra no log, nunca chama a Graph API).
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.mjs")
const SECRET = "segredo-ficticio"
const tmp = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR || os.tmpdir(), "ig-webhook-test-"))
const LOG = path.join(tmp, "events.log")
let proc, port

const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)) }) })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const logText = () => { try { return fs.readFileSync(LOG, "utf8") } catch { return "" } }
async function waitFor(fn, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(50) } return false }

function req(method, p, { headers = {}, body } = {}) {
  return new Promise((ok, fail) => {
    const r = http.request({ host: "127.0.0.1", port, method, path: p, headers }, (res) => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => ok({ status: res.statusCode, headers: res.headers, body: d }))
    })
    r.on("error", fail)
    if (body) r.write(body)
    r.end()
  })
}
const sign = (raw) => "sha256=" + crypto.createHmac("sha256", SECRET).update(raw).digest("hex")
const commentPayload = (id, from, text = "quero o GUIA") => JSON.stringify({ entry: [{ changes: [{ field: "comments", value: { id, text, from: { id: from, username: "u" }, media: { id: "m1" } } }] }] })
const postWebhook = (payload, sig = sign(payload)) => req("POST", "/ig-webhook", { headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: payload })

before(async () => {
  port = await freePort()
  fs.writeFileSync(path.join(tmp, "rules.json"), JSON.stringify([{ id: "t", keyword: "guia", followGate: false, publicReply: "ok", link: "https://exemplo.test" }]))
  proc = spawn(process.execPath, [SERVER], {
    cwd: tmp,
    env: {
      ...process.env, PORT: String(port), HOST: "127.0.0.1", DRY_SEND: "1",
      INSTAGRAM_APP_SECRET: SECRET, INSTAGRAM_ACCESS_TOKEN: "token-ficticio", IG_VERIFY_TOKEN: "verif",
      IG_USER_ID: "999", INSTAGRAM_USER_ID: "999", IG_APP_ID: "123", IG_HANDLE: "conta.teste",
      PUBLIC_BASE: "https://exemplo.test/ig-webhook", RELOAD_TOKEN: "rt-ficticio",
      RULES_FILE: path.join(tmp, "rules.json"), LOG_FILE: LOG, SEEN_FILE: path.join(tmp, "seen.json"),
      PENDING_FILE: path.join(tmp, "pending.json"), TOKEN_FILE: path.join(tmp, "token.json"), DELETIONS_FILE: path.join(tmp, "deletions.json"),
      MAX_BODY_BYTES: String(1024 * 1024), MAX_PER_USER_HOUR: "3", MAX_PER_MINUTE: "30",
    },
    stdio: "ignore",
  })
  assert.ok(await waitFor(() => logText().includes(`127.0.0.1:${port}`), 8000), "servidor nao subiu")
})
after(() => { proc?.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} })

test("reload: local direto ok, com x-forwarded-for ou x-real-ip 403, token certo ok", async () => {
  assert.equal((await req("GET", "/ig-webhook/reload")).status, 200)
  assert.equal((await req("GET", "/reload")).status, 200)
  assert.equal((await req("GET", "/ig-webhook/reload", { headers: { "x-forwarded-for": "8.8.8.8" } })).status, 403)
  assert.equal((await req("GET", "/ig-webhook/reload", { headers: { "x-real-ip": "8.8.8.8" } })).status, 403)
  assert.equal((await req("GET", "/ig-webhook/reload?token=errado", { headers: { "x-forwarded-for": "8.8.8.8" } })).status, 403)
  assert.equal((await req("GET", "/ig-webhook/reload?token=rt-ficticio", { headers: { "x-forwarded-for": "8.8.8.8" } })).status, 200)
  assert.equal((await req("GET", "/x/reload")).status, 404) // caminho exato, nao endsWith
})

test("corpo de 2 MB leva 413 (webhook e auth)", async () => {
  const big = Buffer.alloc(2 * 1024 * 1024, "a")
  for (const p of ["/ig-webhook", "/ig-webhook/auth/deauthorize", "/ig-webhook/auth/data-deletion"]) {
    const r = await req("POST", p, { headers: { "Content-Type": "application/json", "Content-Length": big.length, "x-hub-signature-256": sign(big) }, body: big }).catch(e => ({ status: e.code }))
    assert.equal(r.status, 413, p)
  }
})

test("webhook sem assinatura 401; com assinatura certa 200 e processa (sem API real)", async () => {
  const p = commentPayload("ok-1", "u-ok")
  assert.equal((await postWebhook(p, "sha256=00")).status, 401)
  assert.equal((await req("POST", "/ig-webhook", { body: p })).status, 401)
  assert.equal((await postWebhook(p)).status, 200)
  assert.ok(await waitFor(() => logText().includes('DRY send {"comment_id":"ok-1"}')))
})

test("comentario sem palavra-chave nao recebe resposta", async () => {
  assert.equal((await postWebhook(commentPayload("nokw-1", "u-nokw", "oi tudo bem"))).status, 200)
  assert.ok(await waitFor(() => logText().includes("sem keyword, ignorado comment=nokw-1")))
  assert.ok(!logText().includes("nokw-1\"}"))
})

test("callback sem state 400; state de uso unico", async () => {
  const sem = await req("GET", "/ig-webhook/auth/callback?code=abc")
  assert.equal(sem.status, 400); assert.match(sem.body, /Invalid or expired state/)
  assert.equal((await req("GET", "/ig-webhook/auth/callback?code=abc&state=inventado")).status, 400)
  const start = await req("GET", "/ig-webhook/auth/start")
  assert.equal(start.status, 302)
  const state = new URL(start.headers.location).searchParams.get("state")
  assert.match(state, /^[0-9a-f]{48}$/)
  const um = await req("GET", `/ig-webhook/auth/callback?state=${state}`) // state valido, falta o code
  assert.equal(um.status, 400); assert.match(um.body, /Missing authorization code/)
  const dois = await req("GET", `/ig-webhook/auth/callback?state=${state}`)
  assert.match(dois.body, /Invalid or expired state/)
})

test("XSS refletido: erro da URL vai escapado", async () => {
  const r = await req("GET", "/ig-webhook/auth/callback?error_description=" + encodeURIComponent(`<script>alert("x")</script>'&`))
  assert.equal(r.status, 400)
  assert.ok(!r.body.includes("<script>"))
  assert.ok(r.body.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;&amp;"))
  const d = await req("GET", "/ig-webhook/auth/data-deletion?code=" + encodeURIComponent("<img src=x>"))
  assert.ok(!d.body.includes("<img"))
})

test("limite por usuario: 3 por hora, o resto so registra", async () => {
  for (let i = 1; i <= 5; i++) await postWebhook(commentPayload(`lim-${i}`, "u-lim"))
  assert.ok(await waitFor(() => (logText().match(/LIMITE de envio atingido.*from=u-lim/g) || []).length === 2))
  assert.equal((logText().match(/DRY send \{"comment_id":"lim-/g) || []).length, 3)
})

test("token nunca aparece no log", () => {
  assert.ok(!logText().includes("token-ficticio"))
  assert.ok(!logText().includes(SECRET))
})
