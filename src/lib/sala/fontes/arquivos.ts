// Leitura de arquivo do repo compartilhada pelo mock e pelo provedor live (Tarefa A2).
// Tolerante por padrao: nunca lanca se o caminho nao existir, so devolve null/false. A
// escrita (atomica, com baseHash) mora em `src/lib/sala/escrita/*` (Batelada B), nao aqui.
import { readFileSync, existsSync, lstatSync, realpathSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"

export const ROOT = process.cwd()

function caminhoConfinado(caminhoRelativo: string): string | null {
  if (isAbsolute(caminhoRelativo) || caminhoRelativo.split(/[\\/]/).includes("..")) return null
  const caminho = resolve(ROOT, caminhoRelativo)
  if (!caminho.startsWith(ROOT + sep)) return null
  try {
    let componente = ROOT
    for (const parte of relative(ROOT, caminho).split(sep)) {
      componente = resolve(componente, parte)
      if (lstatSync(componente).isSymbolicLink()) return null
    }
    return realpathSync(caminho).startsWith(realpathSync(ROOT) + sep) ? caminho : null
  } catch { return null }
}

export function existe(caminhoRelativo: string): boolean {
  const caminho = caminhoConfinado(caminhoRelativo)
  return caminho !== null && existsSync(caminho)
}

export function lerArquivo(caminhoRelativo: string): string | null {
  const caminho = caminhoConfinado(caminhoRelativo)
  if (!caminho || !existsSync(caminho)) return null
  return readFileSync(caminho, "utf-8")
}
