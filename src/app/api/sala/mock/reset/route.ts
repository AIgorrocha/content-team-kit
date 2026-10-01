import { NextResponse, type NextRequest } from "next/server"
import { getSala } from "@/lib/sala/data"
import { definirCenario } from "@/lib/sala/data/mock/state"

// Reinicia o estado do mock da Sala de Comando (recria o seed do zero). No provedor
// live isto é no-op (SalaData.reset() já trata isso). POST é o contrato oficial da rota
// (ver plano da Sala); GET fica disponível também só pra facilitar checagem manual no
// navegador em desenvolvimento.
// `?cenario=vazio` troca pro cenário genérico (sem dado de cliente) mesmo que o
// clients/{slug}/sala-mock/seed.json exista; qualquer outro valor (ou ausência) volta pro
// padrão. Ignorado no provedor live (definirCenario só afeta o estado do mock).
export async function POST(req: NextRequest) {
  const cenario = req.nextUrl.searchParams.get("cenario") === "vazio" ? "vazio" : "padrao"
  definirCenario(cenario)
  await getSala().reset()
  return NextResponse.json({ ok: true, cenario })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
