import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lista as peças de nível 1 (sem peça mãe) pro quadro de etapas. Filtro do pipeline real
// (Batelada B4) já vem aplicado por dentro de SalaData.pecas() (live filtra por
// pipelineReal, ver data/live/pecas.ts e data/live/index.ts; mock não tem esse conceito
// e devolve tudo).
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const pecas = await getSala().pecas()
    return NextResponse.json({ pecas })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
