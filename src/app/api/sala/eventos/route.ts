import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Lista os eventos mais recentes ao vivo (usado no carregamento inicial e na
// reconexão do hook use-sala-eventos após uma queda do SSE).
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  const limiteParam = req.nextUrl.searchParams.get("limite")
  const limite = limiteParam ? Number(limiteParam) : undefined

  try {
    const eventos = await getSala().eventosRecentes(limite && !Number.isNaN(limite) ? limite : undefined)
    return NextResponse.json({ eventos })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
