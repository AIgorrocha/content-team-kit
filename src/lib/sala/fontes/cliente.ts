// Resolucao do cliente ativo desta pasta, compartilhada pelo mock e pelo provedor live
// (Tarefa A2). Mesma fonte da regra dura do projeto: .workspace > clients/active-client.md
// (ver scripts/_lib/workspace-client.mjs). Cai pra "generico" so se a resolucao falhar (ex.
// rodando fora do repo, sem clients/ nenhum).
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { ROOT, lerArquivo } from "./arquivos"

// Correcao de raiz (Batelada B3): o cookie sala_cliente (mesmo nome de COOKIE_CLIENTE em
// ../cliente.ts) e a escolha feita no Inicio; ele tem que valer aqui tambem, porque
// asset/[id], oauth/** e tema.ts chamam resolverClienteAtivo direto (ou uma copia dela),
// sem passar por src/lib/sala/cliente.ts. Import dinamico de next/headers porque este
// arquivo tambem roda de script Node fora do Next (ex.: scripts/sala/check-live.ts); fora
// de um pedido em curso, cookies() lanca e o catch devolve null.
async function clienteDoCookie(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers")
    const store = await cookies()
    return store.get("sala_cliente")?.value ?? null
  } catch {
    return null
  }
}

export async function resolverClienteAtivo(): Promise<string> {
  const doCookie = await clienteDoCookie()
  if (doCookie && listarClientesDisponiveis().some((c) => c.slug === doCookie)) return doCookie
  try {
    const mod = (await import("../../../../scripts/_lib/workspace-client.mjs")) as {
      resolveClient: (root?: string) => string
    }
    return mod.resolveClient(ROOT)
  } catch {
    return "generico"
  }
}

export function caminhoCliente(slug: string, ...partes: string[]): string {
  return join("clients", slug, ...partes).replace(/\\/g, "/")
}

export interface ClienteDisponivel { slug: string; nome: string }

// Nome de exibicao do cliente (Batelada B1): primeira linha "#" do brand-profile.md, sem o
// prefixo "Brand Profile"; sem heading utilizavel, cai no primeiro campo em negrito do
// arquivo; sem nenhum dos dois, usa o proprio slug.
export function nomeCliente(slug: string): string {
  const raw = lerArquivo(caminhoCliente(slug, "brand-profile.md"))
  if (!raw) return slug
  const titulo = raw.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const semPrefixo = titulo?.replace(/^brand\s*profile\s*[-:]?\s*/i, "").trim()
  if (semPrefixo) return semPrefixo
  const campoNome = raw.match(/^\*\*(.+?)\*\*/m)?.[1]?.trim()
  return campoNome || slug
}

// Pastas de clients/ com brand-profile.md, exceto _template (mesma regra de scanClients em
// scripts/_lib/workspace-client.mjs, reescrita aqui sem depender do import .mjs).
export function listarClientesDisponiveis(): ClienteDisponivel[] {
  const dir = join(ROOT, "clients")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template")
    .filter((d) => existsSync(join(dir, d.name, "brand-profile.md")))
    .map((d) => ({ slug: d.name, nome: nomeCliente(d.name) }))
    .sort((a, b) => a.slug.localeCompare(b.slug))
}
