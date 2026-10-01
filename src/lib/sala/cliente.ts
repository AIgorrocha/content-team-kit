// Cliente ativo da Sala (Batelada B1): o cookie `sala_cliente` manda quando presente e
// aponta pra um cliente disponivel; sem cookie, ou chamado fora de um pedido (script,
// build), cai no cliente da pasta do kit (.workspace/CT_CLIENT, ver
// scripts/_lib/workspace-client.mjs). Usado pelo provedor live e pela rota
// /api/sala/cliente; o mock ignora o cookie de proposito (ver src/lib/sala/data/mock/index.ts).
import { cookies } from "next/headers"
import { listarClientesDisponiveis, nomeCliente, resolverClienteAtivo, type ClienteDisponivel } from "@/lib/sala/fontes"

export const COOKIE_CLIENTE = "sala_cliente"

export interface ClienteAtivo {
  slug: string
  nome: string
  disponiveis: ClienteDisponivel[]
}

// cookies() lanca fora de um pedido em curso (ex.: chamado de um script Node); o catch
// devolve null e quem chama cai no fallback da pasta do kit.
async function clienteDoCookie(): Promise<string | null> {
  try {
    const store = await cookies()
    return store.get(COOKIE_CLIENTE)?.value ?? null
  } catch {
    return null
  }
}

export async function clienteAtivoSlug(): Promise<string> {
  const doCookie = await clienteDoCookie()
  if (doCookie && listarClientesDisponiveis().some((c) => c.slug === doCookie)) return doCookie
  return resolverClienteAtivo()
}

export async function clienteAtivoCompleto(): Promise<ClienteAtivo> {
  const disponiveis = listarClientesDisponiveis()
  const slug = await clienteAtivoSlug()
  const nome = disponiveis.find((c) => c.slug === slug)?.nome ?? nomeCliente(slug)
  return { slug, nome, disponiveis }
}

export function validarClienteDisponivel(slug: string): void {
  if (!listarClientesDisponiveis().some((c) => c.slug === slug)) {
    throw new Error(`cliente "${slug}" não está disponível`)
  }
}
