import { NextRequest, NextResponse } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { getSala } from "@/lib/sala/data"
import { lerImagemMarca, salvarImagemMarca } from "@/lib/sala/marca"
import { ConflitoEdicao } from "@/lib/sala/types"
import { lerCorpoLimitado } from "@/lib/sala/corpo-limitado"

const headers = { "Cache-Control": "no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" }

export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401, headers })
  const sala = getSala()
  const cliente = await sala.clienteAtivo()
  if (req.nextUrl.searchParams.get("cliente") !== cliente.slug) return NextResponse.json({ erro: "Cliente alterado" }, { status: 409, headers })
  const bloco = (await sala.onboarding()).find(b => b.numero === 5)!
  const referencia = bloco.perguntas.find(p => p.id === "logo")?.resposta
  const imagem = process.env.SALA_DATA === "mock" ? null : lerImagemMarca(cliente.slug, typeof referencia === "string" ? referencia : null)
  if (req.nextUrl.searchParams.has("imagem")) {
    if (!imagem) return new NextResponse(null, { status: 404, headers })
    return new NextResponse(new Uint8Array(imagem.dados), { headers: { ...headers, "Content-Type": imagem.mime } })
  }
  return NextResponse.json({ hash: bloco.baseHash, url: imagem ? `/api/sala/marca?cliente=${encodeURIComponent(cliente.slug)}&imagem=1` : null }, { headers })
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ erro: "Origem não permitida" }, { status: 403, headers })
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401, headers })
  if (process.env.SALA_DATA === "mock") return NextResponse.json({ erro: "Envio de marca disponível no modo real" }, { status: 503, headers })
  try {
    const bytes = await lerCorpoLimitado(req, 3 * 1024 * 1024)
    const corpo = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData()
    const arquivo = corpo.get("arquivo")
    const sala = getSala()
    const cliente = await sala.clienteAtivo()
    if (corpo.get("cliente") !== cliente.slug) return NextResponse.json({ erro: "O cliente mudou. Recarregue a página." }, { status: 409, headers })
    if (!(arquivo instanceof File) || arquivo.size > 2 * 1024 * 1024) return NextResponse.json({ erro: "Use uma imagem PNG, JPG ou WebP de até 2 MB." }, { status: 400, headers })
    const bloco = (await sala.onboarding()).find(b => b.numero === 5)!
    if (corpo.get("hash") !== bloco.baseHash) return NextResponse.json({ erro: "Os dados mudaram. Recarregue antes de trocar a marca." }, { status: 409, headers })
    const caminho = salvarImagemMarca(cliente.slug, Buffer.from(await arquivo.arrayBuffer()))
    const respostas = Object.fromEntries(bloco.perguntas.map(p => [p.id, p.id === "logo" ? caminho : p.resposta ?? null]))
    const salvo = await sala.gravarBloco(5, respostas, bloco.baseHash)
    return NextResponse.json({ hash: salvo.baseHash, url: `/api/sala/marca?cliente=${encodeURIComponent(cliente.slug)}&imagem=1&v=${salvo.baseHash}` }, { headers })
  } catch (erro) {
    return NextResponse.json({ erro: erro instanceof ConflitoEdicao ? "Os dados mudaram. Recarregue a página." : "Não foi possível salvar a imagem. Confira o formato e tente novamente." }, { status: erro instanceof ConflitoEdicao ? 409 : 400, headers })
  }
}
