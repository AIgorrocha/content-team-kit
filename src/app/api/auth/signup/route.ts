import { NextRequest, NextResponse } from "next/server"
import { createUser, findUserByEmail, signToken, COOKIE_NAME } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { email, name, password } = await request.json()

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Todos os campos são obrigatórios" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      )
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 409 }
      )
    }

    const user = await createUser(email, name, password)

    const token = signToken({
      userId: user.id,
      tenantId: "",
      role: "",
    })

    const response = NextResponse.json({ success: true }, { status: 201 })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch {
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}
