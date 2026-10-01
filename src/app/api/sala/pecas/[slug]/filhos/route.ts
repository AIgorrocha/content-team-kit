import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { mensagemEditorialSegura, validarFilho } from "@/lib/sala/data/live/escrita-editorial"
import type { Rede, TipoPeca } from "@/lib/sala/types"

interface CorpoFilho {
  tipo?: TipoPeca
  rede?: Rede | null
}

// Cria uma peça filha (recorte, carrossel etc.) a partir de uma peça mãe.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoFilho
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  if (!corpo || typeof corpo !== "object" || !corpo.tipo) {
    return NextResponse.json({ erro: "campo obrigatório: tipo" }, { status: 400 })
  }

  try {
    validarFilho(corpo.tipo, corpo.rede ?? null)
    const filho = await getSala().criarFilho(params.slug, corpo.tipo, corpo.rede ?? null)
    return NextResponse.json({ peca: filho })
  } catch (err) {
    const seguro = mensagemEditorialSegura(err)
    return NextResponse.json({ erro: seguro.mensagem }, { status: seguro.status })
  }
}
