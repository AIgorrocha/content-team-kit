import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import { COOKIE_CLIENTE } from "@/lib/sala/cliente"

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365

// GET devolve o cliente ativo (cookie sala_cliente > .workspace/CT_CLIENT no live; sempre o
// cliente do seed no mock) e a lista de disponíveis. POST troca o cliente ativo: valida o
// slug contra disponíveis e grava o cookie, que passa a valer pra toda a Sala (filtros por
// client_slug no banco e leitura de clients/{slug}/).
export async function GET() {
  const resposta = NextResponse.json(await getSala().clienteAtivo())
  resposta.headers.set("Cache-Control", "private, no-store")
  return resposta
}

export async function POST(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return NextResponse.json({ erro: "corpo da requisição inválido" }, { status: 400 })
  }
  const slug = corpo !== null && typeof corpo === "object" ? (corpo as { slug?: unknown }).slug : undefined
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ erro: "campo obrigatório: slug" }, { status: 400 })
  }

  const sala = getSala()
  let disponiveis: { slug: string; nome: string }[]
  try {
    await sala.escolherCliente(slug)
    disponiveis = (await sala.clienteAtivo()).disponiveis
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "cliente inválido"
    return NextResponse.json({ erro: mensagem }, { status: 400 })
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_CLIENTE, slug, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: UM_ANO_EM_SEGUNDOS,
    path: "/",
  })
  revalidatePath("/sala", "layout")

  const nome = disponiveis.find((c) => c.slug === slug)?.nome ?? slug
  const resposta = NextResponse.json({ slug, nome, disponiveis })
  resposta.headers.set("Cache-Control", "private, no-store")
  return resposta
}
