import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { ROOT, lerArquivo } from "./fontes/arquivos"

export function tipoImagemMarca(dados: Buffer): { extensao: string; mime: string } {
  if (dados.length > 2 * 1024 * 1024 || dados.length < 12) throw new Error("Imagem inválida ou maior que 2 MB")
  if (dados.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extensao: "png", mime: "image/png" }
  if (dados[0] === 255 && dados[1] === 216 && dados[2] === 255) return { extensao: "jpg", mime: "image/jpeg" }
  if (dados.toString("ascii", 0, 4) === "RIFF" && dados.toString("ascii", 8, 12) === "WEBP") return { extensao: "webp", mime: "image/webp" }
  throw new Error("Use PNG, JPG ou WebP")
}

function conferirCaminho(cliente: string, caminho: string): string {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(cliente) || isAbsolute(caminho) || caminho.split(/[\\/]/).includes("..")) throw new Error("Caminho inválido")
  const absoluto = resolve(ROOT, caminho)
  const raizCliente = resolve(ROOT, "clients", cliente)
  if (absoluto !== raizCliente && !absoluto.startsWith(raizCliente + sep)) throw new Error("Arquivo de outro cliente")
  let atual = ROOT
  for (const parte of relative(ROOT, absoluto).split(sep)) {
    atual = resolve(atual, parte)
    if (lstatSync(atual).isSymbolicLink()) throw new Error("Links não são permitidos")
  }
  if (!realpathSync(absoluto).startsWith(realpathSync(ROOT) + sep)) throw new Error("Arquivo fora da instalação")
  return absoluto
}

export function lerImagemMarca(cliente: string, referencia?: string | null) {
  const design = lerArquivo(`clients/${cliente}/design-system.md`) ?? ""
  const candidatos = [referencia, ...Array.from(design.matchAll(/`([^`\r\n]+\.(?:png|jpe?g|webp))`/gi)).map(m => m[1]).filter(p => /logo|avatar/i.test(p))]
  for (const caminho of candidatos) {
    if (!caminho) continue
    try {
      const absoluto = conferirCaminho(cliente, caminho)
      if (!lstatSync(absoluto).isFile() || lstatSync(absoluto).size > 2 * 1024 * 1024) continue
      const dados = readFileSync(absoluto)
      return { dados, ...tipoImagemMarca(dados) }
    } catch { /* referência ausente ou não autorizada */ }
  }
  return null
}

export function salvarImagemMarca(cliente: string, dados: Buffer): string {
  const { extensao } = tipoImagemMarca(dados)
  conferirCaminho(cliente, `clients/${cliente}`)
  const pasta = `clients/${cliente}/assets`
  if (!existsSync(resolve(ROOT, pasta))) mkdirSync(resolve(ROOT, pasta))
  conferirCaminho(cliente, pasta)
  const hash = createHash("sha256").update(dados).digest("hex")
  const arquivo = `${pasta}/logo-sala-${hash}.${extensao}`
  // Nome por conteúdo: nunca sobrescreve a marca anterior. O .md só passa a apontar
  // para este arquivo depois que a gravação completa e o hash editorial confere.
  try { writeFileSync(resolve(ROOT, arquivo), dados, { flag: "wx", mode: 0o644 }) }
  catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro
    const existente = conferirCaminho(cliente, arquivo)
    if (!readFileSync(existente).equals(dados)) throw new Error("Arquivo de marca divergente")
  }
  return arquivo
}
