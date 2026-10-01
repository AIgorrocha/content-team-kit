import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lista os 25 agentes (base, bridge, ads) pra grade do Time.
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const agentes = await getSala().agentes()
    return NextResponse.json({ agentes })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
