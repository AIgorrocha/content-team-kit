import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { ConfiguracaoManual } from "@/lib/sala/data/live/configuracao"

// Lê a configuração (banco, modelos, chaves presentes, kit). O servidor só expõe NOMES
// de variável de ambiente presentes, nunca o valor: ver construirConfiguracao no seed do mock.
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const configuracao = await getSala().configuracao()
    return NextResponse.json({ configuracao })
  } catch (err) {
    console.error("[api/sala/config] GET falhou:", err)
    return NextResponse.json({ erro: "não foi possível carregar a configuração" }, { status: 500 })
  }
}

interface CorpoAlterarConfiguracao {
  parte?: string
  valor?: unknown
}

// Só "banco" e "modelos" são alteráveis na Fase 1 (bate com SalaData.alterarConfiguracao).
export async function PATCH(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoAlterarConfiguracao
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return NextResponse.json({ erro: "corpo inválido" }, { status: 400 })
  const { parte, valor } = corpo
  if (parte !== "banco" && parte !== "modelos") {
    return NextResponse.json({ erro: "campo parte inválido, use 'banco' ou 'modelos'" }, { status: 400 })
  }
  // "banco" é objeto ({modo, url, ok}); "modelos" é array de objeto (Configuracao["modelos"]).
  // Ambos passam em `typeof === "object" && !== null`; string/número/booleano não.
  if (typeof valor !== "object" || valor === null) {
    return NextResponse.json({ erro: "campo obrigatório: valor (objeto)" }, { status: 400 })
  }

  try {
    const configuracao = await getSala().alterarConfiguracao(parte, valor)
    return NextResponse.json({ configuracao })
  } catch (err) {
    if (err instanceof ConfiguracaoManual) return NextResponse.json({ erro: err.message }, { status: 501 })
    console.error("[api/sala/config] PATCH falhou:", err)
    return NextResponse.json({ erro: "não foi possível alterar a configuração" }, { status: 500 })
  }
}
