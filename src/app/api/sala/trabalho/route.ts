import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"

// Snapshot do kanban de Trabalho. O cliente (KanbanTrabalho) busca aqui de novo a cada
// evento novo recebido pelo SSE de Ao vivo, porque a coluna de cada agente depende de
// juntar agentes + eventos no servidor, não só do evento isolado que chegou.
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const { colunas } = await getSala().trabalho()
    return NextResponse.json({ colunas })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
