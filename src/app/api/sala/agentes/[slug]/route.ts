import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { ConflitoEdicao } from "@/lib/sala/types"

// Detalhe de um agente: prompt completo, contexto, skills, memória e últimas peças.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  try {
    const agente = await getSala().agente(params.slug)
    if (!agente) return NextResponse.json({ erro: `agente "${params.slug}" não encontrado` }, { status: 404 })
    return NextResponse.json({ agente })
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}

interface CorpoSalvarPrompt {
  promptMd?: string
  baseHash?: string
}

// Salva o prompt editado. baseHash é o promptHash carregado pelo editor: se o agente
// mudou nesse meio tempo (outra sessão salvou primeiro), devolve 409 com a versão atual
// pro editor oferecer "Recarregar" em vez de sobrescrever sem avisar.
export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoSalvarPrompt
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  const { promptMd, baseHash } = corpo
  if (typeof promptMd !== "string" || !promptMd.trim()) {
    return NextResponse.json({ erro: "campo obrigatório: promptMd" }, { status: 400 })
  }
  if (typeof baseHash !== "string" || !baseHash) {
    return NextResponse.json({ erro: "campo obrigatório: baseHash" }, { status: 400 })
  }

  try {
    const resultado = await getSala().salvarPrompt(params.slug, promptMd, baseHash)
    return NextResponse.json(resultado)
  } catch (err) {
    if (err instanceof ConflitoEdicao) {
      return NextResponse.json(
        { erro: "o prompt mudou desde que foi carregado", atual: err.atual, hashAtual: err.hashAtual },
        { status: 409 }
      )
    }
    const mensagem = err instanceof Error ? err.message : "erro desconhecido"
    const status = mensagem.includes("não encontrado") ? 404 : 500
    return NextResponse.json({ erro: mensagem }, { status })
  }
}
