import { NextRequest, NextResponse } from "next/server"
import { getSession, createTenant, signToken, COOKIE_NAME } from "@/lib/auth"
import { initTenantSchema } from "@/lib/tenant-db"

export async function POST(request: NextRequest) {
  try {
    const session = getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { workspace_name, database_url } = await request.json()

    if (!workspace_name || !database_url) {
      return NextResponse.json(
        { error: "Nome do workspace e URL do banco são obrigatórios" },
        { status: 400 }
      )
    }

    // Generate slug from name
    const slug = workspace_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")

    // Test connection and create schema
    try {
      await initTenantSchema(database_url)
    } catch (error) {
      return NextResponse.json(
        { error: "Não foi possível conectar ao banco de dados. Verifique a URL." },
        { status: 400 }
      )
    }

    // Create tenant
    const tenant = await createTenant(
      workspace_name,
      slug,
      database_url,
      session.userId
    )

    // Issue new token with tenant
    const newToken = signToken({
      userId: session.userId,
      tenantId: tenant.id,
      role: "owner",
    })

    const response = NextResponse.json({
      success: true,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    })

    response.cookies.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    )
  }
}
