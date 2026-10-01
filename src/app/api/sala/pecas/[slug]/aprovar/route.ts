import { NextRequest, NextResponse } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { mensagemEditorialSegura, validarAprovacao } from "@/lib/sala/data/live/escrita-editorial"
import type { Etapa, Rede } from "@/lib/sala/types"

interface CorpoAprovacao {
  etapa?: Etapa
  rede?: Rede | null
  revisaoId?: string
  acao?: "aprovar" | "ajuste"
  motivo?: string
}

// Aprova ou pede ajuste numa etapa (e rede, quando aplicável) da peça. Devolve a peça
// já atualizada (nova etapaAtual/coluna incluída).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: CorpoAprovacao
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }

  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  const { etapa, rede, revisaoId, acao, motivo } = corpo
  if (!etapa || !revisaoId || (acao !== "aprovar" && acao !== "ajuste")) {
    return NextResponse.json(
      { erro: "campos obrigatórios: etapa, revisaoId e acao ('aprovar' ou 'ajuste')" },
      { status: 400 }
    )
  }
  if ((motivo !== undefined && typeof motivo !== "string") || (acao === "ajuste" && !motivo?.trim())) {
    return NextResponse.json({ erro: "motivo obrigatório para pedir ajuste" }, { status: 400 })
  }

  try {
    validarAprovacao({ etapa, rede: rede ?? null, revisaoId, acao, motivo: motivo?.trim() })
    const peca = await getSala().aprovar(params.slug, {
      etapa,
      rede: rede ?? null,
      revisaoId,
      acao,
      motivo: motivo?.trim(),
    })
    return NextResponse.json({ peca })
  } catch (err) {
    const seguro = mensagemEditorialSegura(err)
    return NextResponse.json({ erro: seguro.mensagem }, { status: seguro.status })
  }
}
