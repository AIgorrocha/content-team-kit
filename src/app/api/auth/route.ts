import { NextRequest, NextResponse } from "next/server"
import { signToken } from "@/lib/jwt"

const COOKIE_NAME = "ct-auth-token"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = body.username ?? body.email ?? ""
    const password = body.password ?? ""

    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD

    if (!validUsername || !validPassword) {
      return NextResponse.json(
        { error: "Autenticação não configurada" },
        { status: 503 }
      )
    }

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos" },
        { status: 401 }
      )
    }

    const token = signToken({ userId: "admin", tenantId: "admin", role: "admin" })
    const response = NextResponse.json({ success: true, hasTenant: true })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
