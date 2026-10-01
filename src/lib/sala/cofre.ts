import { createHash } from "node:crypto"
import { decrypt, encrypt } from "@/lib/crypto"
import { query } from "@/lib/db"
import { ROOT } from "@/lib/sala/fontes/arquivos"
import { CAMPOS_COFRE, campoCofre, type NomeCampoCofre } from "./cofre-campos"

const SERVICO_COFRE = "sala_cofre"
const CLIENTE_VALIDO = /^[a-z0-9][a-z0-9-]{0,79}$/

interface LinhaCofre {
  credential_key: string
  encrypted_value: string
  iv: string
  auth_tag: string
}

function chaveCredencial(cliente: string, nome: NomeCampoCofre): string {
  return createHash("sha256").update(`${cliente}:${nome}`, "utf-8").digest("hex")
}

function validarCliente(cliente: string): void {
  if (!CLIENTE_VALIDO.test(cliente)) throw new Error("cliente inválido")
}

async function clienteDaWorkspace(): Promise<string | null> {
  try {
    const modulo = (await import("../../../scripts/_lib/workspace-client.mjs")) as { resolveClient: (root?: string) => string }
    return modulo.resolveClient(ROOT)
  } catch {
    return null
  }
}

export async function listarCamposCofre(cliente: string): Promise<Array<(typeof CAMPOS_COFRE)[number] & { presente: boolean; origem: "cofre" | "instalacao" | null }>> {
  validarCliente(cliente)
  const chaves = CAMPOS_COFRE.map((campo) => chaveCredencial(cliente, campo.nome))
  const linhas = await query<Pick<LinhaCofre, "credential_key">>(
    "select credential_key from ct_credentials where service = $1 and credential_key = any($2::text[])",
    [SERVICO_COFRE, chaves]
  )
  const presentes = new Set(linhas.map((linha) => linha.credential_key))
  const permiteAmbiente = cliente === await clienteDaWorkspace()
  return CAMPOS_COFRE.map((campo) => {
    const salvo = presentes.has(chaveCredencial(cliente, campo.nome))
    const ambiente = permiteAmbiente && !!process.env[campo.nome]
    return { ...campo, presente: salvo || ambiente, origem: salvo ? "cofre" : ambiente ? "instalacao" : null }
  })
}

export async function salvarSegredoSala(cliente: string, nome: string, valor: string): Promise<void> {
  validarCliente(cliente)
  const campo = campoCofre(nome)
  if (!campo) throw new Error("campo inválido")
  if (typeof valor !== "string" || valor.length < 8 || valor.length > 4096) throw new Error("valor inválido")
  const { encrypted, iv, authTag } = encrypt(valor)
  await query(
    `insert into ct_credentials (service, credential_key, encrypted_value, iv, auth_tag, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (service, credential_key)
     do update set encrypted_value = excluded.encrypted_value, iv = excluded.iv, auth_tag = excluded.auth_tag, updated_at = now()`,
    [SERVICO_COFRE, chaveCredencial(cliente, campo.nome), encrypted, iv, authTag]
  )
}

export async function lerSegredoSala(cliente: string, nome: NomeCampoCofre): Promise<string | null> {
  validarCliente(cliente)
  if (!campoCofre(nome)) return null
  const linhas = await query<LinhaCofre>(
    `select credential_key, encrypted_value, iv, auth_tag from ct_credentials
     where service = $1 and credential_key = $2`,
    [SERVICO_COFRE, chaveCredencial(cliente, nome)]
  )
  const linha = linhas[0]
  if (linha) return decrypt(linha.encrypted_value, linha.iv, linha.auth_tag)
  return cliente === await clienteDaWorkspace() ? process.env[nome] ?? null : null
}
