// Escrita do prompt de um agente (Tarefa B1): grava direto em `agents/{slug}.md`, a fonte
// única (ADR 3.1). O vigia (`scripts/sala/watch-sync.mjs`) é quem sobe pro Supabase depois.
import { existe } from "@/lib/sala/fontes/arquivos"
import { escreverComHash } from "./arquivo"

const SLUG_VALIDO = /^[a-z0-9-]+$/

export function salvarPromptNoArquivo(slug: string, promptMd: string, baseHash: string): string {
  if (!SLUG_VALIDO.test(slug)) throw new Error(`slug de agente inválido: "${slug}"`)
  const caminho = `agents/${slug}.md`
  if (!existe(caminho)) throw new Error(`agente "${slug}" não encontrado`)
  return escreverComHash(caminho, promptMd, baseHash)
}
