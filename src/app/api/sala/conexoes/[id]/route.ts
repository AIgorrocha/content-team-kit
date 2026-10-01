import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import type { Conexao } from "@/lib/sala/types"

const ACOES_VALIDAS: NonNullable<Conexao["acao"]>[] = ["conectar", "renovar", "testar", "copiar_trecho"]

interface CorpoAcaoConexao {
  acao?: string
}

// Só requisição de mesma origem pode disparar ações sobre conexão (troca credencial, dispara
// OAuth): sem Origin (chamada servidor-a-servidor, fora de browser) deixa passar; com Origin
// presente e diferente do host da própria rota, barra (POST muda estado, então CSRF importa
// aqui mesmo com auth por cookie).
function mesmaOrigem(req: NextRequest): boolean {
  const origem = req.headers.get("origin")
  if (!origem) return true
  try {
    return new URL(origem).origin === req.nextUrl.origin
  } catch {
    return false
  }
}

// Executa uma ação sobre a conexão (conectar, renovar, testar; copiar_trecho é só client-side,
// mas a rota aceita do mesmo jeito). No mock, "renovar" volta o status pra ok e soma 60 dias
// à validade; no live, conectar/renovar das redes com OAuth devolve {redirect} pro fluxo
// /api/sala/oauth/{rede} em vez de {conexao}.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  if (!mesmaOrigem(req)) {
    return NextResponse.json({ erro: "origem não permitida" }, { status: 403 })
  }

  let corpo: CorpoAcaoConexao
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  if (typeof corpo !== "object" || corpo === null) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  const { acao } = corpo
  if (typeof acao !== "string" || !ACOES_VALIDAS.includes(acao as NonNullable<Conexao["acao"]>)) {
    return NextResponse.json({ erro: `campo acao inválido, use um de: ${ACOES_VALIDAS.join(", ")}` }, { status: 400 })
  }

  try {
    const resultado = await getSala().acaoConexao(params.id, acao as NonNullable<Conexao["acao"]>)
    if ("redirect" in resultado) return NextResponse.json({ redirect: resultado.redirect })
    return NextResponse.json({ conexao: resultado })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    if (mensagem.includes("não encontrada")) {
      return NextResponse.json({ erro: mensagem }, { status: 404 })
    }
    if (mensagem.includes("não disponível para esta conexão")) {
      return NextResponse.json({ erro: mensagem }, { status: 400 })
    }
    // Qualquer outro erro (banco, credencial, rede) não vaza detalhe interno pro cliente.
    return NextResponse.json({ erro: "não foi possível executar a ação" }, { status: 500 })
  }
}
