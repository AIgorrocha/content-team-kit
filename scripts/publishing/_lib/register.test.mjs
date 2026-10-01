// node --test scripts/publishing/_lib/register.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { registerPublicationSafe } from "./register.mjs"

const base = { client_slug: "acme", platform: "linkedin", content_type: "post", title: "t" }

test("sem link nao derruba o publicador: avisa e devolve null", async () => {
  const avisos = []
  const orig = console.warn
  console.warn = (m) => avisos.push(String(m))
  try {
    assert.equal(await registerPublicationSafe({ ...base, url: "" }), null)
  } finally { console.warn = orig }
  assert.ok(avisos.some((a) => a.includes("NAO foi registrada")))
  assert.ok(avisos.some((a) => a.includes("register-publication.mjs")))
})

test("com banco (simulado) grava a peca e devolve a linha", async () => {
  process.env.SUPABASE_URL = "http://banco.local"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste"
  const chamadas = []
  const origFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    chamadas.push({ url: String(url), method: init.method || "GET" })
    if (!init.method) return { json: async () => [] }
    return { ok: true, json: async () => [{ id: "abc" }] }
  }
  const log = console.log
  console.log = () => {}
  try {
    const url = "https://www.linkedin.com/feed/update/urn:li:share:7000000060939640832"
    const saved = await registerPublicationSafe({ ...base, url })
    assert.equal(saved.id, "abc")
    assert.deepEqual(chamadas.map((c) => c.method), ["GET", "POST"])
  } finally { globalThis.fetch = origFetch; console.log = log }
})
