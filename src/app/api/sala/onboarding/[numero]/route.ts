import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { ConflitoEdicao } from "@/lib/sala/types"

interface CorpoGravarBloco {
  cliente?: string
  respostas?: Record<string, unknown>
  hash?: string
}

// Grava as respostas de um bloco do onboarding e marca gravado = true.
export async function POST(req: NextRequest, { params }: { params: { numero: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  const numero = Number(params.numero)
  if (!Number.isInteger(numero) || numero < 0 || numero > 7) {
    return NextResponse.json({ erro: "número de bloco inválido, use 0 a 7" }, { status: 400 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  const { respostas, hash, cliente } = corpo as CorpoGravarBloco
  if (cliente !== undefined && cliente !== (await getSala().clienteAtivo()).slug) {
    return NextResponse.json({ erro: "O cliente mudou. Recarregue a entrevista." }, { status: 409 })
  }
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas)) {
    return NextResponse.json({ erro: "campo obrigatório: respostas" }, { status: 400 })
  }
  if (hash !== undefined && (typeof hash !== "string" || !/^[0-9a-f]{64}$/i.test(hash))) {
    return NextResponse.json({ erro: "hash inválido, recarregue o bloco" }, { status: 400 })
  }

  try {
    const bloco = await getSala().gravarBloco(numero, respostas, hash)
    return NextResponse.json({ bloco })
  } catch (err) {
    if (err instanceof ConflitoEdicao) {
      // Nunca devolve o conteúdo completo do arquivo, só o hash pra decidir recarregar.
      return NextResponse.json(
        { erro: "o arquivo mudou desde que foi carregado, recarregue o onboarding", hashAtual: err.hashAtual },
        { status: 409 }
      )
    }
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    if (/hash|desconhecida|inválid|excede|limite/i.test(mensagem)) {
      return NextResponse.json({ erro: "Respostas ou hash inválidos. Confira os campos e recarregue o bloco." }, { status: 400 })
    }
    if (mensagem.includes("não encontrado")) {
      return NextResponse.json({ erro: "Arquivo do cliente ausente. Copie o arquivo correspondente de clients/_template antes de gravar." }, { status: 404 })
    }
    return NextResponse.json({ erro: "erro ao gravar o bloco" }, { status: 500 })
  }
}
