// Cofre de tokens OAuth da Sala (Tarefa D2): guarda access/refresh token por cliente e rede
// em ct_credentials (encriptado) com o vínculo de conta em ct_connections (Tarefa D1). Chave
// de segredo é service=sala_oauth_{rede} + credential_key=sha256(cliente), pra nunca colidir
// com outro cliente nem com o legado de env var. Tokens nunca saem em texto puro daqui: quem
// chama decide o que fazer com eles (ex.: sobrescrever env só em memória pra testar a rede).
import { createHash } from "node:crypto"
import { encrypt, decrypt } from "@/lib/crypto"
import { query, transaction } from "@/lib/db"

export type RedeOAuth = "linkedin" | "youtube" | "instagram" | "meta_ads"

// Mesma convenção de docs/superpowers/specs/2026-09-11-sala-de-comando-design.md e dos scripts
// de autorização já existentes (youtube-auth.mjs usa "never", linkedin-auth-local.mjs "manual").
const RENEW_KIND: Record<RedeOAuth, string> = {
  linkedin: "manual",
  youtube: "never",
  instagram: "auto",
  meta_ads: "manual",
}

interface DadosCredencialOAuth {
  cliente: string
  rede: RedeOAuth
  accessToken: string
  refreshToken?: string
  expiresAt?: Date | null
  accountLabel?: string
  accountId?: string
}

interface CredencialOAuth {
  accessToken: string
  refreshToken?: string
}

function servicoDe(rede: RedeOAuth): string {
  return `sala_oauth_${rede}`
}

function chaveDe(cliente: string): string {
  return createHash("sha256").update(cliente, "utf-8").digest("hex")
}

function validarToken(nome: string, valor: string): void {
  if (typeof valor !== "string" || valor.length < 8 || valor.length > 4096) {
    throw new Error(`${nome} inválido`)
  }
}

function payloadValido(payload: unknown): payload is CredencialOAuth {
  if (typeof payload !== "object" || payload === null) return false
  const p = payload as Record<string, unknown>
  if (typeof p.accessToken !== "string") return false
  if (p.refreshToken !== undefined && typeof p.refreshToken !== "string") return false
  return true
}

export async function salvarCredencialOAuth(dados: DadosCredencialOAuth): Promise<void> {
  const { cliente, rede, accessToken, refreshToken, expiresAt = null, accountLabel, accountId } = dados
  if (!cliente) throw new Error("cliente obrigatório")
  if (!RENEW_KIND[rede]) throw new Error("rede inválida")
  validarToken("accessToken", accessToken)
  if (refreshToken !== undefined) validarToken("refreshToken", refreshToken)

  const service = servicoDe(rede)
  const credentialKey = chaveDe(cliente)

  await transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`${cliente}:${rede}`])

    let refreshFinal = refreshToken
    if (!refreshFinal) {
      const existente = await client.query<{ encrypted_value: string; iv: string; auth_tag: string }>(
        `select encrypted_value, iv, auth_tag from ct_credentials where service = $1 and credential_key = $2`,
        [service, credentialKey]
      )
      const linha = existente[0]
      if (linha) {
        try {
          const payload: unknown = JSON.parse(decrypt(linha.encrypted_value, linha.iv, linha.auth_tag))
          if (payloadValido(payload) && payload.refreshToken) refreshFinal = payload.refreshToken
        } catch {
          // credencial antiga ilegível: não propaga refresh nenhum, só segue sem ele.
        }
      }
    }

    const { encrypted, iv, authTag } = encrypt(JSON.stringify({ accessToken, refreshToken: refreshFinal }))

    await client.query(
      `insert into ct_credentials (service, credential_key, encrypted_value, iv, auth_tag, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (service, credential_key)
       do update set encrypted_value = excluded.encrypted_value, iv = excluded.iv, auth_tag = excluded.auth_tag, updated_at = now()`,
      [service, credentialKey, encrypted, iv, authTag]
    )

    const credencial = await client.query<{ id: string }>(
      `select id from ct_credentials where service = $1 and credential_key = $2`,
      [service, credentialKey]
    )
    const credentialRef = credencial[0]?.id ?? null

    const obtidoEm = new Date().toISOString()
    // No YouTube a conexao usa o refresh token. A validade de uma hora do access
    // token nao representa o vencimento da autorizacao armazenada.
    const expiraEm = rede === "youtube" && refreshFinal ? null : expiresAt ? expiresAt.toISOString() : null

    const conexaoExistente = await client.query<{ id: string }>(
      `select id from ct_connections where client_slug = $1 and service = $2
       order by last_checked_at desc nulls last, obtained_at desc nulls last, id limit 1`,
      [cliente, rede]
    )

    if (conexaoExistente[0]) {
      await client.query(
        `update ct_connections
         set account_label = $2, account_id_externo = $3, obtained_at = $4, expires_at = $5,
             status = 'unknown', renew_kind = $6, last_checked_at = null, credential_ref = $7
         where id = $1`,
        [conexaoExistente[0].id, accountLabel ?? null, accountId ?? null, obtidoEm, expiraEm, RENEW_KIND[rede], credentialRef]
      )
    } else {
      await client.query(
        `insert into ct_connections
           (client_slug, service, account_label, account_id_externo, obtained_at, expires_at, status, renew_kind, last_checked_at, credential_ref)
         values ($1, $2, $3, $4, $5, $6, 'unknown', $7, null, $8)`,
        [cliente, rede, accountLabel ?? null, accountId ?? null, obtidoEm, expiraEm, RENEW_KIND[rede], credentialRef]
      )
    }
  })
}

export async function lerCredencialOAuth(cliente: string, rede: RedeOAuth): Promise<CredencialOAuth | null> {
  if (!cliente || !RENEW_KIND[rede]) return null
  const service = servicoDe(rede)
  const credentialKey = chaveDe(cliente)

  const linhas = await query<{ encrypted_value: string; iv: string; auth_tag: string }>(
    `select cred.encrypted_value, cred.iv, cred.auth_tag
     from ct_connections conn
     join ct_credentials cred on cred.id = conn.credential_ref
     where conn.client_slug = $1 and conn.service = $2
       and cred.service = $3 and cred.credential_key = $4`,
    [cliente, rede, service, credentialKey]
  )
  const linha = linhas[0]
  if (!linha) return null

  // Credencial existe mas não decripta em formato válido: erro explícito (nunca null), pra
  // quem chama nunca confundir "sem credencial nova" (cai no legado) com "credencial
  // corrompida" (não deve cair no legado silenciosamente).
  const payload: unknown = JSON.parse(decrypt(linha.encrypted_value, linha.iv, linha.auth_tag))
  if (!payloadValido(payload)) throw new Error("credencial salva em formato inválido")
  return payload.refreshToken !== undefined
    ? { accessToken: payload.accessToken, refreshToken: payload.refreshToken }
    : { accessToken: payload.accessToken }
}
