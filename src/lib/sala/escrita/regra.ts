// Escrita de uma regra no arquivo de correções do cliente (Tarefa B1): substitui só o selo
// e o corpo daquela regra, preservando todo o resto do arquivo. `Regra.hash` (fontes/regras.ts)
// é o sha256 do ARQUIVO inteiro, não por regra: o baseHash recebido aqui é comparado contra
// o arquivo inteiro (mesma semântica de `escreverComHash`); em conflito, devolve como "atual"
// o texto da própria regra (reparseada da versão em disco), não o arquivo inteiro, porque é
// isso que o EditorRegra usa pra "Recarregar" (ver src/components/sala/padroes/EditorRegra.tsx).
import { ConflitoEdicao, type Regra, type Selo } from "@/lib/sala/types"
import { lerArquivo } from "@/lib/sala/fontes/arquivos"
import { extrairSelo, lerRegrasDoArquivo } from "@/lib/sala/fontes/regras"
import { escreverComHash } from "./arquivo"
import { arquivoRegrasCliente } from "../../../../scripts/sala/arquivo-regras.mjs"

interface BlocoRegra {
  nivel: number
  titulo: string
  inicioHeading: number
  inicioCorpo: number
  fimCorpo: number // exclusivo
}

// Reproduz a mesma varredura de `lerRegrasDoArquivo`, na mesma ordem, pra que o índice
// (contador do `Regra.id`, "<cliente>.<n>") aponte pro mesmo bloco em leitura e escrita.
function localizarBlocos(linhas: string[]): BlocoRegra[] {
  const blocos: BlocoRegra[] = []
  for (let i = 0; i < linhas.length; i++) {
    const info = extrairSelo(linhas[i])
    if (!info) continue
    let fim = linhas.length
    for (let j = i + 1; j < linhas.length; j++) {
      const proxHeading = linhas[j].match(/^(#{1,6})\s+/)
      if (proxHeading && proxHeading[1].length <= info.nivel) {
        fim = j
        break
      }
    }
    blocos.push({ nivel: info.nivel, titulo: info.titulo, inicioHeading: i, inicioCorpo: i + 1, fimCorpo: fim })
  }
  return blocos
}

export function salvarRegraNoArquivo(cliente: string, id: string, texto: string, selo: Selo, baseHash: string): Regra {
  const caminho = arquivoRegrasCliente(cliente)
  if (!caminho) throw new Error(`arquivo de regras do cliente "${cliente}" não encontrado`)

  const contador = id.match(/\.(\d+)$/)?.[1]
  if (!contador) throw new Error(`identificador de regra inválido: "${id}"`)
  const indice = Number(contador) // 1-based, mesma numeração de fontes/regras.ts

  const raw = lerArquivo(caminho)
  if (raw == null) throw new Error(`arquivo de regras "${caminho}" não encontrado`)

  const linhas = raw.split(/\r?\n/)
  const bloco = localizarBlocos(linhas)[indice - 1]
  if (!bloco) throw new Error(`regra "${id}" não encontrada em ${caminho}`)

  // ponytail: preserva só a quantidade de linhas em branco que já separava esse bloco do
  // próximo heading (normalmente 1). Arquivo com convenção de espaçamento diferente (0 ou
  // 2+ linhas) mantém a própria convenção; não normaliza o arquivo inteiro.
  let linhasEmBranco = 0
  for (let k = bloco.fimCorpo - 1; k > bloco.inicioCorpo && linhas[k] === ""; k--) linhasEmBranco++

  const marcador = "#".repeat(bloco.nivel)
  const novaHeading = `${marcador} ${bloco.titulo} \`[${selo}]\``
  const novoCorpo = texto.trim().split(/\r?\n/)

  const novasLinhas = [
    ...linhas.slice(0, bloco.inicioHeading),
    novaHeading,
    ...novoCorpo,
    ...Array(linhasEmBranco).fill(""),
    ...linhas.slice(bloco.fimCorpo),
  ]
  const novoConteudo = novasLinhas.join("\n")

  let novoHash: string
  try {
    novoHash = escreverComHash(caminho, novoConteudo, baseHash)
  } catch (err) {
    if (err instanceof ConflitoEdicao) {
      const atuais = lerRegrasDoArquivo(caminho, cliente)
      const atual = atuais.find((r) => r.id === id)
      throw new ConflitoEdicao(atual?.texto ?? err.atual, err.hashAtual)
    }
    throw err
  }

  return {
    id,
    tipoConteudo: "geral",
    selo,
    titulo: bloco.titulo,
    texto: texto.trim(),
    arquivo: caminho,
    atualizadoEm: new Date().toISOString(),
    hash: novoHash,
  }
}
