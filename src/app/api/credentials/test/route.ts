import { NextRequest, NextResponse } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getServiceCredentials } from "@/lib/queries/credentials"
import { z } from "zod"

const testSchema = z.object({
  service: z.enum(["openai", "mailjet"]),
})

async function testOpenAI(creds: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const key = creds.api_key
  if (!key) return { ok: false, message: "API key não configurada" }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return { ok: true, message: "OpenAI conectada!" }
    if (res.status === 401) return { ok: false, message: "API key inválida" }
    return { ok: false, message: `OpenAI respondeu com status ${res.status}` }
  } catch (error) {
    return { ok: false, message: `Erro ao conectar: ${error instanceof Error ? error.message : "erro"}` }
  }
}

async function testMailjet(creds: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const apiKey = creds.api_key
  const secretKey = creds.secret_key
  if (!apiKey || !secretKey) return { ok: false, message: "Chaves Mailjet não configuradas" }

  try {
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64")
    const res = await fetch("https://api.mailjet.com/v3/REST/apikey", {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return { ok: true, message: "Mailjet conectado!" }
    if (res.status === 401) return { ok: false, message: "Chaves inválidas" }
    return { ok: false, message: `Mailjet respondeu com status ${res.status}` }
  } catch (error) {
    return { ok: false, message: `Erro ao conectar: ${error instanceof Error ? error.message : "erro"}` }
  }
}

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const { service } = testSchema.parse(body)

    const creds = await getServiceCredentials(db, service)

    const testers: Record<string, (c: Record<string, string>) => Promise<{ ok: boolean; message: string }>> = {
      openai: testOpenAI,
      mailjet: testMailjet,
    }

    const result = await testers[service](creds)
    return result
  })
}
