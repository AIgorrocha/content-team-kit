import { NextRequest, NextResponse } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { clienteAtivoSlug } from "@/lib/sala/cliente"
import { CAMPOS_COFRE, campoCofre } from "@/lib/sala/cofre-campos"
import { listarCamposCofre, salvarSegredoSala } from "@/lib/sala/cofre"
import { lerCorpoLimitado } from "@/lib/sala/corpo-limitado"
import { resolverOrigin } from "@/lib/sala/oauth"

function mesmaOrigem(req: NextRequest): boolean {
  const origem = req.headers.get("origin")
  if (!origem) return false
  try {
    return new URL(origem).origin === req.nextUrl.origin
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })
  if (process.env.SALA_DATA === "mock") return NextResponse.json({ campos: CAMPOS_COFRE.map((campo) => ({ ...campo, presente: false })) })
  try {
    let oauthOrigin: string | null = null
    try { oauthOrigin = resolverOrigin() } catch { /* mostrar pendência na instalação */ }
    return NextResponse.json({ campos: await listarCamposCofre(await clienteAtivoSlug()), oauthOrigin }, { headers: { "Cache-Control": "no-store", Vary: "Cookie" } })
  } catch {
    return NextResponse.json({ erro: "não foi possível carregar o cofre" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })
  if (!mesmaOrigem(req)) return NextResponse.json({ erro: "origem não permitida" }, { status: 403 })
  if (process.env.SALA_DATA === "mock") return NextResponse.json({ erro: "cofre indisponível em modo mock" }, { status: 503 })

  let corpo: { cliente?: unknown; nome?: unknown; valor?: unknown }
  try {
    corpo = JSON.parse(new TextDecoder().decode(await lerCorpoLimitado(req, 12000)))
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  if (typeof corpo?.cliente !== "string" || typeof corpo.nome !== "string" || typeof corpo.valor !== "string" || !campoCofre(corpo.nome)) {
    return NextResponse.json({ erro: "campo, cliente ou valor inválido" }, { status: 400 })
  }
  if (corpo.cliente !== await clienteAtivoSlug()) return NextResponse.json({ erro: "cliente não corresponde à sessão" }, { status: 403 })

  try {
    await salvarSegredoSala(corpo.cliente, corpo.nome, corpo.valor)
    return NextResponse.json({ ok: true, mensagem: "Salvo", campo: { ...campoCofre(corpo.nome), presente: true } })
  } catch {
    return NextResponse.json({ erro: "não foi possível salvar no cofre" }, { status: 500 })
  }
}
