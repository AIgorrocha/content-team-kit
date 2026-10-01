import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lista as regras do cliente ativo (arquivo de correções, ex. regras-cliente.md) pra tela de Padrões. Escrita fica em
// /api/sala/regras/[id] (PUT), no mesmo padrão de /api/sala/agentes/[slug].
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const regras = await getSala().regras()
    return NextResponse.json({ regras })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
