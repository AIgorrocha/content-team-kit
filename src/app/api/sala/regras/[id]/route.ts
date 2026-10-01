import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { ConflitoEdicao, type Selo } from "@/lib/sala/types"

const SELOS_VALIDOS: Selo[] = ["FIXA", "REINCIDENTE", "HIPOTESE", "MEDIDO", "MECANICA"]

interface CorpoSalvarRegra {
  texto?: string
  selo?: string
  baseHash?: string
}

// Salva o texto e/ou o selo de uma regra. baseHash é o Regra.hash carregado pelo editor:
// se a regra mudou nesse meio tempo (outra sessão salvou primeiro), devolve 409 com a
// versão atual pro editor oferecer "Recarregar" em vez de sobrescrever sem avisar. Mesmo
// padrão de /api/sala/agentes/[slug] (PUT).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoSalvarRegra
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  const { texto, selo, baseHash } = corpo
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ erro: "campo obrigatório: texto" }, { status: 400 })
  }
  if (typeof selo !== "string" || !SELOS_VALIDOS.includes(selo as Selo)) {
    return NextResponse.json({ erro: `campo selo inválido, use um de: ${SELOS_VALIDOS.join(", ")}` }, { status: 400 })
  }
  if (typeof baseHash !== "string" || !baseHash) {
    return NextResponse.json({ erro: "campo obrigatório: baseHash" }, { status: 400 })
  }

  try {
    const regra = await getSala().salvarRegra(params.id, texto, selo as Selo, baseHash)
    return NextResponse.json({ regra })
  } catch (err) {
    if (err instanceof ConflitoEdicao) {
      return NextResponse.json(
        { erro: "a regra mudou desde que foi carregada", atual: err.atual, hashAtual: err.hashAtual },
        { status: 409 }
      )
    }
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    const status = mensagem.includes("não encontrada") ? 404 : 500
    return NextResponse.json({ erro: mensagem }, { status })
  }
}
