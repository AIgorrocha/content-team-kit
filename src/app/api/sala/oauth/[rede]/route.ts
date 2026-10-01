import { NextRequest, NextResponse } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { clienteAtivoSlug } from "@/lib/sala/cliente"
import { credenciaisOAuthDaSala, redeValida, criarEstadoOAuth, montarSetCookie, montarUrlAutorizacao, validarConfiguracaoOAuth } from "@/lib/sala/oauth"

export async function GET(req: NextRequest, context: { params: { rede: string } }) {
  const { rede: redeParam } = context.params

  const auth = await authCheck(req)
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ erro: auth.error ?? "Não autorizado" }, { status: 401, headers: cabecalhos() })
  }

  if (process.env.SALA_DATA === "mock") {
    return NextResponse.json(
      { erro: "Conexão OAuth indisponível em modo mock" },
      { status: 503, headers: cabecalhos() }
    )
  }

  if (!redeValida(redeParam)) {
    return NextResponse.json({ erro: "Rede inválida" }, { status: 400, headers: cabecalhos() })
  }

  const cliente = await clienteAtivoSlug()

  try {
    const credenciais = await credenciaisOAuthDaSala(cliente, redeParam)
    validarConfiguracaoOAuth(redeParam, credenciais)
    const { state, cookie, verifier } = await criarEstadoOAuth({
      userId: auth.userId,
      cliente,
      rede: redeParam,
    })
    const url = montarUrlAutorizacao(redeParam, state, verifier, credenciais)

    const resposta = NextResponse.redirect(url, { status: 302 })
    resposta.headers.append("Set-Cookie", montarSetCookie(redeParam, cookie, 600))
    resposta.headers.set("Cache-Control", "no-store")
    resposta.headers.set("Referrer-Policy", "no-referrer")
    return resposta
  } catch {
    return NextResponse.json(
      { erro: "Não foi possível iniciar a conexão" },
      { status: 503, headers: cabecalhos() }
    )
  }
}

function cabecalhos(): HeadersInit {
  return { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
}
