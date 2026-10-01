import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { Pool } from "pg"
import { NextRequest } from "next/server"

const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const CHAVE_TESTE = "cofre-teste-chave-sintetica-com-mais-de-trinta-e-dois-caracteres"
const CLIENTE_A = `cofre-a-${randomUUID()}`
const CLIENTE_B = `cofre-b-${randomUUID()}`
const NOME_OPENAI = "OPENAI_API_KEY" as const
const NOME_LINKEDIN_ID = "LINKEDIN_CLIENT_ID" as const
const NOME_LINKEDIN_SECRET = "LINKEDIN_CLIENT_SECRET" as const
const SEGREDO_OPENAI = "segredo-openai-sintetico"
const SEGREDO_LINKEDIN_ID = "cliente-linkedin-sintetico"
const SEGREDO_LINKEDIN_SECRET = "segredo-linkedin-sintetico"

function chave(cliente: string, nome: string): string {
  return createHash("sha256").update(`${cliente}:${nome}`, "utf-8").digest("hex")
}

async function main() {
  const ambienteAnterior = { ...process.env }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: false })
  try {
    Object.assign(process.env, {
      DATABASE_URL,
      DATABASE_SSL: "false",
      SALA_DATA: "live",
      NODE_ENV: "development",
      CREDENTIALS_ENCRYPTION_KEY: CHAVE_TESTE,
      SALA_OAUTH_ORIGIN: "http://localhost:5056",
      LINKEDIN_CLIENT_ID: "env-linkedin-id-sintetico",
      LINKEDIN_CLIENT_SECRET: "env-linkedin-secret-sintetico",
    })
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const cofre = await import("../../src/lib/sala/cofre")
    const oauth = await import("../../src/lib/sala/oauth")
    const rotaCofre = await import("../../src/app/api/sala/cofre/route")

    await cofre.salvarSegredoSala(CLIENTE_A, NOME_OPENAI, SEGREDO_OPENAI)
    await cofre.salvarSegredoSala(CLIENTE_A, NOME_LINKEDIN_ID, SEGREDO_LINKEDIN_ID)
    await cofre.salvarSegredoSala(CLIENTE_A, NOME_LINKEDIN_SECRET, SEGREDO_LINKEDIN_SECRET)

    const cifra = await pool.query<{ encrypted_value: string }>(
      "select encrypted_value from ct_credentials where service = $1 and credential_key = $2",
      ["sala_cofre", chave(CLIENTE_A, NOME_OPENAI)]
    )
    assert.equal(cifra.rows.length, 1)
    assert.notEqual(cifra.rows[0].encrypted_value, SEGREDO_OPENAI)
    assert.equal(await cofre.lerSegredoSala(CLIENTE_A, NOME_OPENAI), SEGREDO_OPENAI)
    assert.equal(await cofre.lerSegredoSala(CLIENTE_B, NOME_OPENAI), null)

    const camposA = await cofre.listarCamposCofre(CLIENTE_A)
    const camposB = await cofre.listarCamposCofre(CLIENTE_B)
    assert.equal(camposA.find((campo) => campo.nome === NOME_OPENAI)?.presente, true)
    assert.equal(camposB.find((campo) => campo.nome === NOME_OPENAI)?.presente, false)

    const ambienteOAuthAntes = {
      id: process.env.LINKEDIN_CLIENT_ID,
      secret: process.env.LINKEDIN_CLIENT_SECRET,
    }
    const credenciais = await oauth.credenciaisOAuthDaSala(CLIENTE_A, "linkedin")
    const url = oauth.montarUrlAutorizacao("linkedin", "estado-sintetico", undefined, credenciais)
    assert.equal(url.searchParams.get("client_id"), SEGREDO_LINKEDIN_ID)
    assert.deepEqual(
      { id: process.env.LINKEDIN_CLIENT_ID, secret: process.env.LINKEDIN_CLIENT_SECRET },
      ambienteOAuthAntes
    )

    const get = await rotaCofre.GET(new NextRequest("http://localhost:5056/api/sala/cofre"))
    const getTexto = await get.text()
    assert.equal(get.status, 200)
    assert.ok(getTexto.includes("presente"))
    assert.ok(!getTexto.includes(SEGREDO_OPENAI))
    assert.ok(!getTexto.includes("encrypted_value"))

    const corpo = JSON.stringify({ cliente: CLIENTE_A, nome: NOME_OPENAI, valor: SEGREDO_OPENAI })
    const semOrigin = await rotaCofre.POST(new NextRequest("http://localhost:5056/api/sala/cofre", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: corpo,
    }))
    assert.equal(semOrigin.status, 403)
    const origemExterna = await rotaCofre.POST(new NextRequest("http://localhost:5056/api/sala/cofre", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://externo.example" }, body: corpo,
    }))
    assert.notEqual(origemExterna.status, 200)
    const clienteAlterado = await rotaCofre.POST(new NextRequest("http://localhost:5056/api/sala/cofre", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5056" }, body: corpo,
    }))
    assert.equal(clienteAlterado.status, 403)

    console.log("Cofre: 16 assercoes passaram; criptografia, isolamento, metadados, origem e OAuth por cliente comprovados.")
  } finally {
    await pool.query(
      "delete from ct_credentials where service = $1 and credential_key = any($2::text[])",
      ["sala_cofre", [
        chave(CLIENTE_A, NOME_OPENAI), chave(CLIENTE_A, NOME_LINKEDIN_ID), chave(CLIENTE_A, NOME_LINKEDIN_SECRET),
        chave(CLIENTE_B, NOME_OPENAI), chave(CLIENTE_B, NOME_LINKEDIN_ID), chave(CLIENTE_B, NOME_LINKEDIN_SECRET),
      ]]
    )
    const restantes = await pool.query<{ quantidade: number }>(
      "select count(*)::int as quantidade from ct_credentials where service = $1 and credential_key = any($2::text[])",
      ["sala_cofre", [
        chave(CLIENTE_A, NOME_OPENAI), chave(CLIENTE_A, NOME_LINKEDIN_ID), chave(CLIENTE_A, NOME_LINKEDIN_SECRET),
        chave(CLIENTE_B, NOME_OPENAI), chave(CLIENTE_B, NOME_LINKEDIN_ID), chave(CLIENTE_B, NOME_LINKEDIN_SECRET),
      ]]
    )
    assert.equal(restantes.rows[0].quantidade, 0)
    await pool.end()
    for (const nome of Object.keys(process.env)) if (!(nome in ambienteAnterior)) delete process.env[nome]
    Object.assign(process.env, ambienteAnterior)
    console.log("Limpeza confirmada: 0 registros sintéticos no cofre.")
  }
}

main().catch(() => {
  console.error("Falha na prova do cofre.")
  process.exitCode = 1
})
