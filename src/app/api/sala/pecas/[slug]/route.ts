import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Detalhe completo de uma peça (inclui filhas quando o slug pedido é uma peça mãe:
// peca() devolve so a própria peça, o detalhe de filhas fica na Trilha, outra tela).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const peca = await getSala().peca(params.slug)
    if (!peca) return NextResponse.json({ erro: `peça "${params.slug}" não encontrada` }, { status: 404 })
    return NextResponse.json({ peca })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
