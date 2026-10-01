import { config } from "dotenv"
config({ path: ".env.local", quiet: true })
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

async function main() {
  const { default: pool } = await import("../../src/lib/db")
  const { lerEventosRecentesLive, assinarEventosLive } = await import("../../src/lib/sala/data/live/eventos")
  const { lerAgentesLive } = await import("../../src/lib/sala/data/live/agentes")
  const { acaoConexaoLive } = await import("../../src/lib/sala/data/live/acoes-conexao")
  const { encerrarPool } = await import("./connections-lib.mjs")
  const marca = `sala-isolamento-${randomUUID()}`
  const clientes = [`${marca}-a`, `${marca}-b`]
  const antesCliente = process.env.CT_CLIENT
  const antesUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const antesFetch = globalThis.fetch
  let iterador: AsyncIterator<unknown> | undefined
  try {
    for (const cliente of clientes) {
      mkdirSync(join("clients", cliente))
      writeFileSync(join("clients", cliente, "brand-profile.md"), "# Cliente de prova\n")
    }
    process.env.CT_CLIENT = clientes[0]
    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    for (const cliente of clientes) {
      await pool.query("insert into ct_agent_events(client_slug,event,payload,source) values($1,'pedido',$2::jsonb,'terminal')", [cliente, JSON.stringify({ resumo: cliente, caixa: 1 })])
      await pool.query("insert into ct_tasks(title,status,assigned_agent,metadata) values($1,'in_progress','ct-social',$2::jsonb)", [cliente, JSON.stringify({ client_slug: cliente, sala_test: marca })])
    }
    const eventos = await lerEventosRecentesLive()
    assert.equal(eventos.length, 1)
    assert.equal(eventos[0].resumo, clientes[0])
    const agentes = await lerAgentesLive(clientes[0])
    assert.equal(agentes.find((a) => a.slug === "ct-social")?.tarefaAtual, clientes[0])
    assert.equal(agentes.some((a) => a.tarefaAtual === clientes[1]), false)
    iterador = assinarEventosLive()[Symbol.asyncIterator]()
    const proximo = iterador.next()
    await new Promise((r) => setTimeout(r, 500))
    for (const cliente of [...clientes].reverse()) await pool.query("insert into ct_agent_events(client_slug,event,payload,source) values($1,'registrado',$2::jsonb,'terminal')", [cliente, JSON.stringify({ resumo: cliente, caixa: 6 })])
    const recebido = await Promise.race([proximo, new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error("polling não entregou o evento")), 7000))])
    assert.equal((recebido.value as { resumo: string }).resumo, clientes[0])
    const pendente = iterador.next()
    await iterador.return?.()
    assert.equal((await pendente).done, true)
    let consultasRede = 0
    globalThis.fetch = (async (input, init) => {
      if (String(input).includes("linkedin.com")) { consultasRede++; throw new Error("não deve consultar a conta de outro cliente") }
      return antesFetch(input, init)
    }) as typeof fetch
    await acaoConexaoLive(clientes[0], "linkedin", "testar")
    assert.equal(consultasRede, 0)
    console.log("Isolamento live: eventos, tarefas, polling, encerramento e token legado passaram.")
  } finally {
    await iterador?.return?.()
    globalThis.fetch = antesFetch
    if (antesCliente === undefined) delete process.env.CT_CLIENT; else process.env.CT_CLIENT = antesCliente
    if (antesUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = antesUrl
    await pool.query("delete from ct_agent_events where client_slug=any($1::text[])", [clientes])
    await pool.query("delete from ct_tasks where metadata->>'sala_test'=$1", [marca])
    await pool.query("delete from ct_connections where client_slug=any($1::text[])", [clientes])
    for (const cliente of clientes) rmSync(join("clients", cliente), { recursive: true, force: true })
    await encerrarPool()
    await pool.end()
  }
}
main().catch(() => { console.error("Prova de isolamento falhou."); process.exitCode = 1 })
