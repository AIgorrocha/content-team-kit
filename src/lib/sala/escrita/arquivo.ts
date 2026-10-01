// Escrita atômica em arquivo do repo com checagem de hash (Tarefa B1). Único ponto que
// grava em `.md` de verdade na Sala: `escrita/prompt.ts` e `escrita/regra.ts` montam o
// conteúdo novo e delegam pra cá a checagem de conflito + gravação atômica + EOL.
// A leitura tolerante (nunca lança se o caminho não existir) mora em `fontes/arquivos.ts`;
// aqui a ausência do arquivo É erro, porque escrever "do nada" não é o caso de uso da Sala
// (toda escrita edita um arquivo que a tela carregou primeiro).
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { randomUUID } from "node:crypto"
import { ConflitoEdicao } from "@/lib/sala/types"
import { sha256 } from "@/lib/sala/fontes/hash"

const ROOT = process.cwd()

// Confina o caminho à raiz do repo: recusa ".." e qualquer resolução que escape de ROOT.
function caminhoSeguro(caminhoRelativo: string): string {
  if (isAbsolute(caminhoRelativo) || caminhoRelativo.split(/[\\/]/).includes("..")) {
    throw new Error(`caminho inválido: "${caminhoRelativo}"`)
  }
  const absoluto = resolve(ROOT, caminhoRelativo)
  if (absoluto !== ROOT && !absoluto.startsWith(ROOT + sep)) {
    throw new Error(`caminho fora do repositório: "${caminhoRelativo}"`)
  }
  // Recusa links em todos os componentes, inclusive uma raiz autorizada ligada para fora.
  let atual = ROOT
  for (const parte of relative(ROOT, absoluto).split(sep)) {
    atual = resolve(atual, parte)
    if (lstatSync(atual).isSymbolicLink()) throw new Error("Links não são permitidos na escrita")
  }
  const raizReal = realpathSync(ROOT)
  if (!realpathSync(absoluto).startsWith(raizReal + sep)) throw new Error("Arquivo fora do repositório")
  return absoluto
}

function detectarEol(texto: string): "\r\n" | "\n" {
  return texto.includes("\r\n") ? "\r\n" : "\n"
}

// Normaliza o conteúdo novo (tipicamente \n vindo de textarea/editor) pro EOL original do
// arquivo, preservando CRLF nos arquivos que já são CRLF (a maioria de agents/*.md).
function normalizarEol(texto: string, eol: "\r\n" | "\n"): string {
  const semCrlf = texto.replace(/\r\n/g, "\n")
  return eol === "\r\n" ? semCrlf.replace(/\n/g, "\r\n") : semCrlf
}

// Lê o arquivo, compara sha256 com baseHash (ConflitoEdicao em divergência), grava atômico
// (arquivo temporário + rename) preservando o EOL original, devolve o hash novo.
export function escreverComHash(caminhoRelativo: string, conteudoNovo: string, baseHash: string): string {
  const caminho = caminhoSeguro(caminhoRelativo)
  if (!existsSync(caminho)) throw new Error(`arquivo "${caminhoRelativo}" não encontrado`)
  const lock = `${caminho}.sala-lock`
  let trava: number
  try { trava = openSync(lock, "wx", 0o600) } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro
    const atual = readFileSync(caminho, "utf-8")
    throw new ConflitoEdicao(atual, sha256(atual))
  }
  const tmp = `${caminho}.tmp-${randomUUID()}`
  try {
    const atual = readFileSync(caminho, "utf-8")
    if (sha256(atual) !== baseHash) throw new ConflitoEdicao(atual, sha256(atual))
    const conteudoFinal = normalizarEol(conteudoNovo, detectarEol(atual))
    const fd = openSync(tmp, "wx", lstatSync(caminho).mode & 0o777)
    try { writeFileSync(fd, conteudoFinal, "utf-8"); fsyncSync(fd) } finally { closeSync(fd) }
    // Reconfere depois da preparação do temporário, inclusive edições de outros programas.
    caminhoSeguro(caminhoRelativo)
    const antesDeTrocar = readFileSync(caminho, "utf-8")
    if (sha256(antesDeTrocar) !== baseHash) throw new ConflitoEdicao(antesDeTrocar, sha256(antesDeTrocar))
    renameSync(tmp, caminho)
    return sha256(conteudoFinal)
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp)
    closeSync(trava)
    unlinkSync(lock)
  }
}
