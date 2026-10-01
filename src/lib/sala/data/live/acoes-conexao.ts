// Ações reais sobre conexões (Tarefa D2): "conectar"/"renovar" das 4 redes com OAuth mandam
// pro fluxo /api/sala/oauth/{rede} (rotas de outro worker; aqui só devolvemos o redirect).
// "testar" chama a mesma checagem em rede da Tarefa D1 (scripts/sala/connections-lib.mjs),
// só que com o token guardado em ct_credentials sobrescrevendo o env legado em memória (nunca
// no process.env de verdade), e grava o resultado de volta em ct_connections.
import type { Conexao } from "@/lib/sala/types"
import { lerConexoesLive } from "./conexoes"
import { lerCredencialOAuth, type RedeOAuth } from "@/lib/sala/oauth-credentials"
import { checarConexao, registrarConexao, buscarConexao } from "../../../../../scripts/sala/connections-lib.mjs"
import { lerSegredoSala } from "@/lib/sala/cofre"

const REDES_OAUTH: RedeOAuth[] = ["linkedin", "youtube", "instagram", "meta_ads"]

function isRedeOAuth(id: string): id is RedeOAuth {
  return (REDES_OAUTH as string[]).includes(id)
}

function envComToken(cliente: string, rede: RedeOAuth, credencial: { accessToken: string; refreshToken?: string } | null): NodeJS.ProcessEnv {
  const env = { ...process.env }
  if (env.SALA_LEGACY_TOKEN_CLIENT !== cliente) {
    for (const chave of ["LINKEDIN_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN", "META_ACCESS_TOKEN", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_ACCESS_TOKEN"]) delete env[chave]
  }
  if (!credencial) return env
  switch (rede) {
    case "linkedin":
      env.LINKEDIN_ACCESS_TOKEN = credencial.accessToken
      break
    case "meta_ads":
      env.META_ACCESS_TOKEN = credencial.accessToken
      break
    case "instagram":
      env.INSTAGRAM_ACCESS_TOKEN = credencial.accessToken
      break
    case "youtube":
      // A lib só refaz o access token a partir do refresh; client id/secret continuam vindo
      // do env legado (não são guardados na credencial).
      env.YOUTUBE_REFRESH_TOKEN = credencial.refreshToken ?? ""
      env.YOUTUBE_ACCESS_TOKEN = credencial.accessToken
      break
  }
  return env
}

async function testarConexaoOAuth(cliente: string, rede: RedeOAuth, conexaoAtual: Conexao): Promise<Conexao> {
  let credencial: { accessToken: string; refreshToken?: string } | null = null
  let falhaCredencial = false
  try {
    credencial = await lerCredencialOAuth(cliente, rede)
    if (!credencial && (await buscarConexao(cliente, rede))?.credential_ref) falhaCredencial = true
  } catch {
    // credencial salva mas corrompida: nunca cai pro env legado.
    falhaCredencial = true
  }

  const ambiente = envComToken(cliente, rede, credencial)
  if (rede === "youtube") {
    ambiente.YOUTUBE_CLIENT_ID = await lerSegredoSala(cliente, "YOUTUBE_CLIENT_ID") ?? ""
    ambiente.YOUTUBE_CLIENT_SECRET = await lerSegredoSala(cliente, "YOUTUBE_CLIENT_SECRET") ?? ""
  }
  const resultado: { status: string; motivo?: string | null; expiraEmDias?: number | null; expires_at?: string } = falhaCredencial
    ? { status: "unknown", motivo: "falha ao ler credencial salva", expiraEmDias: null }
    : await checarConexao(rede, { env: ambiente, expiresAt: conexaoAtual.expiraEm })

  await registrarConexao(
    {
      client_slug: cliente,
      service: rede,
      status: resultado.status,
      last_checked_at: new Date().toISOString(),
      ...(resultado.expires_at ? { expires_at: resultado.expires_at } : {}),
    },
    { env: process.env }
  )

  const conexoesAtualizadas = await lerConexoesLive(cliente)
  const conexaoFinal = conexoesAtualizadas.find((c) => c.id === rede)
  if (!conexaoFinal) throw new Error(`conexão "${rede}" não encontrada`)
  return { ...conexaoFinal, detalhe: resultado.motivo ? `${conexaoFinal.detalhe} Motivo: ${resultado.motivo}.` : conexaoFinal.detalhe }
}

export async function acaoConexaoLive(
  cliente: string,
  id: string,
  acao: NonNullable<Conexao["acao"]>
): Promise<Conexao | { redirect: string }> {
  const conexoes = await lerConexoesLive(cliente)
  const conexao = conexoes.find((c) => c.id === id)
  if (!conexao) throw new Error(`conexão "${id}" não encontrada`)

  if (acao === "conectar" || acao === "renovar") {
    if (!isRedeOAuth(id)) throw new Error("Ação não disponível para esta conexão")
    return { redirect: `/api/sala/oauth/${id}` }
  }

  if (acao === "testar" && isRedeOAuth(id)) {
    return testarConexaoOAuth(cliente, id, conexao)
  }
  if (acao === "testar" && ["supabase", "ai_memory"].includes(id)) return conexao
  if (acao === "copiar_trecho" && conexao.categoria === "mcp") return conexao
  throw new Error("Ação não disponível para esta conexão")
}
