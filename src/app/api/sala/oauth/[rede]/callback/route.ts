import { NextRequest, NextResponse } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { clienteAtivoSlug } from "@/lib/sala/cliente"
import { salvarCredencialOAuth } from "@/lib/sala/oauth-credentials"
import {
  redeValida,
  lerEstadoCookie,
  consumirNonceOAuth,
  trocarCodigoPorTokens,
  limparSetCookie,
  resolverOrigin,
  credenciaisOAuthDaSala,
  type RedeOAuth,
} from "@/lib/sala/oauth"

export async function GET(req: NextRequest, context: { params: { rede: string } }) {
  const { rede: redeParam } = context.params

  const auth = await authCheck(req)
  if (!auth.ok || !auth.userId) {
    return erro(redeValida(redeParam) ? redeParam : null, "Não autorizado", 401)
  }

  if (process.env.SALA_DATA === "mock") {
    return erro(redeValida(redeParam) ? redeParam : null, "Conexão OAuth indisponível em modo mock", 503)
  }

  if (!redeValida(redeParam)) {
    return erro(null, "Rede inválida", 400)
  }

  try {
   const cliente = await clienteAtivoSlug()
  const cookieBruto = req.cookies.get(`sala_oauth_state_${redeParam}`)?.value
  const estado = lerEstadoCookie(cookieBruto)

  if (!estado || estado.rede !== redeParam || estado.cliente !== cliente || estado.userId !== auth.userId) {
    return erro(redeParam, "Sessão de autorização inválida ou expirada", 400)
  }

  const erroProvider = req.nextUrl.searchParams.get("error")
  if (erroProvider) {
    return erro(redeParam, "Autorização negada pelo provedor", 400)
  }

  const stateQuery = req.nextUrl.searchParams.get("state")
  const code = req.nextUrl.searchParams.get("code")
  if (!stateQuery || !code || stateQuery !== estado.nonce) {
    return erro(redeParam, "Requisição de autorização inválida", 400)
  }

  const nonceValido = await consumirNonceOAuth({
    nonce: estado.nonce,
    cliente,
    userId: auth.userId,
    rede: redeParam,
  })
  if (!nonceValido) {
    return erro(redeParam, "Sessão de autorização inválida ou expirada", 400)
  }

  try {
     const credenciais = await credenciaisOAuthDaSala(cliente, redeParam)
     const tokens = await trocarCodigoPorTokens(redeParam, code, estado.verifier, credenciais)
    await salvarCredencialOAuth({
      cliente,
      rede: redeParam,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt ?? null,
    })
  } catch {
    return erro(redeParam, "Não foi possível concluir a conexão", 503)
  }

  const destino = new URL(`/sala/conexoes?ok=${redeParam}`, resolverOrigin())
  const resposta = NextResponse.redirect(destino, { status: 302 })
  resposta.headers.append("Set-Cookie", limparSetCookie(redeParam))
  resposta.headers.set("Cache-Control", "no-store")
  resposta.headers.set("Referrer-Policy", "no-referrer")
  return resposta
  } catch {
    return erro(redeParam, "Não foi possível concluir a conexão", 503)
  }
}

function erro(rede: RedeOAuth | null, mensagem: string, status: number) {
  const resposta = NextResponse.json({ erro: mensagem }, { status })
  if (rede) {
    resposta.headers.append("Set-Cookie", limparSetCookie(rede))
  }
  resposta.headers.set("Cache-Control", "no-store")
  resposta.headers.set("Referrer-Policy", "no-referrer")
  return resposta
}
