// Roda programas externos SEM shell: argumentos vão em array, nunca viram texto de comando.
// Por quê: entrada externa (URL, prompt, ângulo) dentro de uma linha de comando executa o que vier junto.
// No Windows, npx e CLIs globais do npm são arquivos .cmd, que o Node não abre sem shell.
// Aqui o .cmd é resolvido para o que ele chama de verdade (script .js via node, ou .exe).
// Se não achar, falha com mensagem clara: defina a variável do binário com o caminho do .exe ou .js.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path"

const NODE = process.execPath

function doShim(arquivo) {
  const dir = dirname(arquivo)
  const m = /"%dp0%[\\/]([^"]+?\.(?:exe|m?js|cjs))"/i.exec(readFileSync(arquivo, "utf8"))
  if (!m) return null
  const alvo = join(dir, m[1])
  if (!existsSync(alvo)) return null
  return extname(alvo).toLowerCase() === ".exe" ? { file: alvo, pre: [] } : { file: NODE, pre: [alvo] }
}

export function resolverComando(cmd) {
  if (process.platform !== "win32") return { file: cmd, pre: [] }
  const ext = extname(cmd).toLowerCase()
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return { file: NODE, pre: [cmd] }
  if (ext === ".exe") return { file: cmd, pre: [] }
  if (cmd === "npx") {
    const cli = join(dirname(NODE), "node_modules", "npm", "bin", "npx-cli.js")
    if (existsSync(cli)) return { file: NODE, pre: [cli] }
  }
  const pastas = isAbsolute(cmd) ? [""] : (process.env.PATH || "").split(delimiter)
  for (const p of pastas) {
    const base = p ? join(p, cmd) : cmd
    if (existsSync(base + ".exe")) return { file: base + ".exe", pre: [] }
    for (const arq of [base + ".cmd", base]) {
      if (/\.cmd$/i.test(arq) && existsSync(arq)) {
        const r = doShim(arq)
        if (r) return r
      }
    }
  }
  throw new Error(
    `nao consegui abrir "${cmd}" sem shell no Windows; informe o caminho do .exe ou do script .js na variavel de ambiente do binario`,
  )
}

// Igual a execFileSync, mas sempre sem shell e com o .cmd do Windows resolvido.
export function execSeguro(cmd, args = [], opts = {}) {
  const { file, pre } = resolverComando(cmd)
  return execFileSync(file, [...pre, ...args], { ...opts, shell: false })
}
