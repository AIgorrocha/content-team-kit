import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { mensagemEditorialSegura } from "@/lib/sala/data/live/escrita-editorial"

// Lista os itens de calendário (planejado, agendado e publicado) entre duas datas ISO.
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const inicio = searchParams.get("inicio")
  const fim = searchParams.get("fim")
  if (!inicio || !fim) {
    return NextResponse.json({ erro: "parâmetros obrigatórios: inicio e fim" }, { status: 400 })
  }

  try {
    const itens = await getSala().calendario(inicio, fim)
    return NextResponse.json({ itens })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}

interface CorpoReprogramar {
  id?: string
  novaData?: string
}

// Reprograma um item pra outra data, preservando a hora quando só a data muda.
// Só item "agendado" pode ser reprogramado aqui (planejado e publicado não arrastam).
export async function PATCH(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoReprogramar
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  const { id, novaData } = corpo
  if (!id || !novaData) {
    return NextResponse.json({ erro: "campos obrigatórios: id e novaData" }, { status: 400 })
  }

  try {
    const item = await getSala().reprogramar(id, novaData)
    return NextResponse.json({ item })
  } catch (err) {
    const seguro = mensagemEditorialSegura(err)
    return NextResponse.json({ erro: seguro.mensagem }, { status: seguro.status })
  }
}
