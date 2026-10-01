import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Trilha de um vídeo longo: a peça mãe (youtube_longo) e todos os filhos, reais e planejados.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const trilha = await getSala().trilha(params.slug)
    return NextResponse.json(trilha)
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    const status = mensagem.includes("não encontrada") ? 404 : 500
    return NextResponse.json({ erro: mensagem }, { status })
  }
}
