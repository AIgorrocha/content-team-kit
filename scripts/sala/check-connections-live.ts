import { config } from "dotenv"
config({ path: ".env.local", quiet: true })
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { registrarConexao, buscarConexao, encerrarPool } from "./connections-lib.mjs"

async function main() {
  const { default: pool } = await import("../../src/lib/db")
  const { lerConexoesLive } = await import("../../src/lib/sala/data/live/conexoes")
  const cliente = `sala-conexoes-${randomUUID()}`
  const outro = `${cliente}-outro`
  const obtained = new Date(Date.now() - 86400000).toISOString()
  const expires = new Date(Date.now() + 86400000 * 3).toISOString()
  try {
    await Promise.all(Array.from({ length: 8 }, () => registrarConexao({ client_slug: cliente, service: "linkedin", obtained_at: obtained, expires_at: expires, status: "ok", last_checked_at: new Date().toISOString() })))
    await registrarConexao({ client_slug: outro, service: "linkedin", account_label: "outra conta", status: "unknown" })
    await registrarConexao({ client_slug: cliente, service: "linkedin", account_label: "conta sintetica" })
    const row = await buscarConexao(cliente, "linkedin")
    assert.equal(new Date(row.obtained_at).toISOString(), obtained)
    assert.equal(new Date(row.expires_at).toISOString(), expires)
    assert.equal((await pool.query("select count(*)::int n from ct_connections where client_slug=$1", [cliente])).rows[0].n, 1)
    assert.equal((await buscarConexao(outro, "linkedin")).account_label, "outra conta")
    let card = (await lerConexoesLive(cliente)).find((c) => c.id === "linkedin")!
    assert.equal(card.status, "vencendo")
    assert.equal(card.diasRestantes, 3)
    await registrarConexao({ client_slug: cliente, service: "linkedin", expires_at: new Date(Date.now() - 1000).toISOString() })
    card = (await lerConexoesLive(cliente)).find((c) => c.id === "linkedin")!
    assert.equal(card.status, "vencida")
    await registrarConexao({ client_slug: cliente, service: "linkedin", expires_at: null, obtained_at: null, status: "unknown" })
    card = (await lerConexoesLive(cliente)).find((c) => c.id === "linkedin")!
    assert.equal(card.status, "desconhecida")
    assert.equal(card.diasRestantes, null)
    console.log("Conexoes: concorrencia, isolamento, preservacao de datas e status da tela passaram.")
  } finally {
    await pool.query("delete from ct_connections where client_slug=any($1::text[])", [[cliente, outro]])
    assert.equal((await pool.query("select count(*)::int n from ct_connections where client_slug=any($1::text[])", [[cliente, outro]])).rows[0].n, 0)
    console.log("Limpeza confirmada: zero conexoes sinteticas.")
    await encerrarPool()
    await pool.end()
  }
}
main().catch(() => { console.error("Falha na prova live de conexoes."); process.exitCode = 1 })
