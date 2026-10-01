import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lê os 8 blocos (0 a 7) do assistente de onboarding (skills/ct-onboarding/SKILL.md).
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const blocos = await getSala().onboarding()
    return NextResponse.json({ blocos })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
