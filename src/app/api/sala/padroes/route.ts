import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lista os padrões visuais vigentes por tipo de conteúdo (cartão "Padrão vigente" da tela).
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const padroes = await getSala().padroes()
    return NextResponse.json({ padroes })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
