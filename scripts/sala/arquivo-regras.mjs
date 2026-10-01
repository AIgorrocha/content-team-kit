import { existsSync } from "node:fs"
import { isAbsolute, resolve } from "node:path"

export function arquivoRegrasCliente(cliente, root = process.cwd(), env = process.env) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cliente)) return null
  const padrao = `clients/${cliente}/regras-cliente.md`
  if (existsSync(resolve(root, padrao))) return padrao
  const legado = env.SALA_REGRAS_CLIENT === cliente ? env.SALA_REGRAS_FILE : undefined
  if (!legado || isAbsolute(legado) || legado.includes(":") || legado.split(/[\\/]/).includes("..") || !legado.endsWith(".md")) return null
  return existsSync(resolve(root, legado)) ? legado.replaceAll("\\", "/") : null
}
