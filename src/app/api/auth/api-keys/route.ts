import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-key"

export async function GET() {
  try {
    const session = getSession()
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeys(session.tenantId)
    return NextResponse.json({ data: keys })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSession()
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { label } = await request.json()
    const { apiKey, rawKey } = await createApiKey(
      session.tenantId,
      label || "default"
    )

    return NextResponse.json({
      data: apiKey,
      raw_key: rawKey,
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = getSession()
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { key_id } = await request.json()
    if (!key_id) {
      return NextResponse.json({ error: "key_id obrigatório" }, { status: 400 })
    }

    const revoked = await revokeApiKey(key_id, session.tenantId)
    if (!revoked) {
      return NextResponse.json({ error: "Key não encontrada" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
