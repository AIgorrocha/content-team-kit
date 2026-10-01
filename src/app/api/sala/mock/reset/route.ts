import { NextResponse, type NextRequest } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { getSala } from "@/lib/sala/data"
import { definirCenario } from "@/lib/sala/data/mock/state"

// Reinicia o estado do mock da Sala de Comando (recria o seed do zero). No provedor
// live isto é no-op (SalaData.reset() já trata isso). Só POST (GET mudava estado e podia ser
// disparado por qualquer site), e passa pela mesma checagem das demais rotas da Sala.
// `?cenario=vazio` troca pro cenário genérico (sem dado de cliente) mesmo que o
// clients/{slug}/sala-mock/seed.json exista; qualquer outro valor (ou ausência) volta pro
// padrão. Ignorado no provedor live (definirCenario só afeta o estado do mock).
export async function POST(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: auth.error === "Não autorizado" ? 401 : 403 })
  const cenario = req.nextUrl.searchParams.get("cenario") === "vazio" ? "vazio" : "padrao"
  definirCenario(cenario)
  await getSala().reset()
  return NextResponse.json({ ok: true, cenario })
}
