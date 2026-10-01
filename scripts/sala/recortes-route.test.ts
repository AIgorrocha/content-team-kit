import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

const urlAnterior = process.env.DATABASE_URL
const salaDataAnterior = process.env.SALA_DATA
const supabaseUrlAnterior = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKeyAnterior = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const ambienteAnterior = process.env.NODE_ENV
Object.assign(process.env, {
  DATABASE_URL: "postgresql://127.0.0.1:1/nao-usar",
  SALA_DATA: "live",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NODE_ENV: "development",
})

let post: (req: NextRequest, contexto: { params: { slug: string } }) => Promise<Response>
let pool: { end: () => Promise<void> }

before(async () => {
  const rota = await import("../../src/app/api/sala/pecas/[slug]/recortes/route")
  const banco = await import("../../src/lib/db")
  post = rota.POST
  pool = banco.default
})

after(async () => {
  if (urlAnterior === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = urlAnterior
  if (salaDataAnterior === undefined) delete process.env.SALA_DATA
  else process.env.SALA_DATA = salaDataAnterior
  if (supabaseUrlAnterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrlAnterior
  if (supabaseKeyAnterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseKeyAnterior
  if (ambienteAnterior === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
  else Object.assign(process.env, { NODE_ENV: ambienteAnterior })
  await pool.end()
})

function pedir() {
  return post(new NextRequest("http://localhost:5056/api/sala/pecas/video-teste/recortes", { method: "POST" }), {
    params: { slug: "video-teste" },
  })
}

test("recortes não responde sucesso quando o registro live falha", async () => {
  const resposta = await pedir()
  assert.equal(resposta.status, 503)
  const corpo = await resposta.json()
  assert.deepEqual(corpo, { erro: "não foi possível registrar o pedido de recortes" })
})

test("recortes válido em mock mantém 202 sem tocar banco", async () => {
  process.env.SALA_DATA = "mock"
  const resposta = await pedir()
  assert.equal(resposta.status, 202)
  assert.deepEqual(await resposta.json(), { ok: true, mensagem: "Pedido enviado ao terminal" })
})
