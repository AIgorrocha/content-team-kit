// Parser de arquivo de regras (docs/REGRAS-CLIENTE.md, clients/{slug}/regras-cliente.md),
// compartilhado pelo mock e pelo provedor live (Tarefa A2). Convencao real dos dois arquivos:
// dentro de um heading "## N Titulo" ou "### N.N Titulo", um selo entre crases no FIM da
// linha do heading ("`[FIXA]`", "`[REINCIDENTE]`" ou "`[HIPOTESE]`") marca uma regra; o corpo
// dela e todo o texto ate o proximo heading de nivel igual ou maior (nunca so uma linha:
// docs/REGRAS-CLIENTE.md tem regra com paragrafos, listas e ate callout dentro do bloco).
import { type Regra, type Selo } from "@/lib/sala/types"
import { lerArquivo } from "./arquivos"
import { sha256 } from "./hash"

const SELOS: Selo[] = ["FIXA", "REINCIDENTE", "HIPOTESE"]

// Exportado (Tarefa B1) pra `escrita/regra.ts` reconstruir os mesmos blocos que a leitura
// enxerga, sem duplicar o regex do heading em dois lugares.
export function extrairSelo(linhaHeading: string): { nivel: number; titulo: string; selo: Selo } | null {
  const m = linhaHeading.match(/^(#{2,4})\s+(.+?)\s*`\[(FIXA|REINCIDENTE|HIPOTESE)\]`/)
  if (!m) return null
  const selo = m[3] as Selo
  if (!SELOS.includes(selo)) return null
  return { nivel: m[1].length, titulo: m[2].trim(), selo }
}

export function lerRegrasDoArquivo(caminhoRelativo: string, cliente: string): Regra[] {
  const raw = lerArquivo(caminhoRelativo)
  if (!raw) return []
  const hash = sha256(raw)
  const linhas = raw.split(/\r?\n/)
  const regras: Regra[] = []
  let contador = 0

  for (let i = 0; i < linhas.length; i++) {
    const info = extrairSelo(linhas[i])
    if (!info) continue
    contador++
    const corpo: string[] = []
    for (let j = i + 1; j < linhas.length; j++) {
      const proxHeading = linhas[j].match(/^(#{1,6})\s+/)
      if (proxHeading && proxHeading[1].length <= info.nivel) break
      corpo.push(linhas[j])
    }
    regras.push({
      id: `${cliente}.${contador}`,
      tipoConteudo: "geral",
      selo: info.selo,
      titulo: info.titulo,
      texto: corpo.join("\n").trim(),
      arquivo: caminhoRelativo,
      atualizadoEm: null,
      hash,
    })
  }
  return regras
}
