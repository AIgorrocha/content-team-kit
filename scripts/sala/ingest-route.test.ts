import { after, test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { POST } from "../../src/app/api/sala/eventos/ingest/route"
import pool from "../../src/lib/db"
import { listarClientesDisponiveis } from "../../src/lib/sala/fontes"

const tokenAnterior = process.env.SALA_HOOK_TOKEN
const supabaseUrlAnterior = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKeyAnterior = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ambienteAnterior = process.env.NODE_ENV
Object.assign(process.env, {
  SALA_HOOK_TOKEN: "token-de-teste-local",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NODE_ENV: "development",
})

after(async () => {
  if (tokenAnterior === undefined) delete process.env.SALA_HOOK_TOKEN
  else process.env.SALA_HOOK_TOKEN = tokenAnterior
  if (supabaseUrlAnterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrlAnterior
  if (supabaseKeyAnterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseKeyAnterior
  if (ambienteAnterior === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
  else Object.assign(process.env, { NODE_ENV: ambienteAnterior })
  await pool.end()
})

function pedir(body: unknown) {
  return POST(
    new NextRequest("http://localhost:5056/api/sala/eventos/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-sala-token": "token-de-teste-local" },
      body: JSON.stringify(body),
    })
  )
}

test("ingestão rejeita cliente inexistente e traversal antes do banco", async () => {
  for (const clientSlug of ["cliente-inexistente-de-teste", "../../fora", "clients/fora", ""]) {
    const resposta = await pedir({ event: "registrado", source: "terminal", client_slug: clientSlug })
    assert.equal(resposta.status, 400)
    assert.deepEqual(await resposta.json(), { erro: "Cliente não cadastrado no workspace" })
  }
})

test("workspace expõe cliente cadastrado para validação multicliente", () => {
  const cliente = listarClientesDisponiveis()[0]?.slug
  assert.ok(cliente, "o workspace precisa ter ao menos um cliente cadastrado")
  assert.match(cliente, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
})
