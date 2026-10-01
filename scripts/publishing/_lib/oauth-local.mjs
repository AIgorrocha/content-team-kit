// scripts/publishing/_lib/oauth-local.mjs
// Base dos scripts de autorizacao local (LinkedIn, Instagram): abre o navegador, recebe o
// "code" num servidor so seu (localhost) e grava o token no .env.local SEM imprimir.
// O painel (Conectar/Testar) so CONFERE a conexao; quem gera o token de PUBLICAR sao estes scripts.

import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { exec } from "node:child_process"

export const OAUTH_PORT = 8765
export const OAUTH_CALLBACK_PATH = "/callback"
export const OAUTH_REDIRECT = `http://localhost:${OAUTH_PORT}${OAUTH_CALLBACK_PATH}`

export const newState = () => randomBytes(16).toString("hex")

/** Grava NOME=valor no arquivo (cria ou troca a linha), preservando o resto e o fim de linha. */
export function saveEnvVar(file, name, value) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("nome de variavel invalido")
  if (/[\r\n]/.test(String(value))) throw new Error("valor com quebra de linha")
  const raw = existsSync(file) ? readFileSync(file, "utf8") : ""
  const eol = raw.includes("\r\n") ? "\r\n" : "\n"
  const line = `${name}=${value}`
  const re = new RegExp(`^${name}=.*$`, "m")
  let out
  if (re.test(raw)) out = raw.replace(re, () => line)
  else out = raw + (raw && !raw.endsWith("\n") ? eol : "") + line + eol
  writeFileSync(file, out)
}

export function openBrowser(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`
  exec(cmd, { shell: process.platform === "win32" ? "cmd.exe" : undefined }, () => {})
}

/**
 * Sobe o servidor local, abre authUrl e devolve o "code" quando a rede volta pra localhost.
 * Recusa retorno com `state` diferente (protege contra autorizacao forjada).
 */
export function captureAuthCode({ authUrl, state, port = OAUTH_PORT, timeoutMs = 300000, open = openBrowser }) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${port}`)
      if (u.pathname !== OAUTH_CALLBACK_PATH) { res.writeHead(404); res.end(); return }
      const fim = (status, msg, erro) => {
        res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" })
        res.end(`<h2>${msg}</h2>`)
        clearTimeout(timer)
        server.close()
        erro ? reject(erro) : resolve(u.searchParams.get("code"))
      }
      if (u.searchParams.get("state") !== state) return fim(400, "Retorno recusado (state diferente).", new Error("state diferente: autorizacao recusada"))
      if (u.searchParams.get("error")) return fim(400, "Autorizacao nao concluida.", new Error("autorizacao nao concluida: " + u.searchParams.get("error")))
      if (!u.searchParams.get("code")) return fim(400, "Sem codigo.", new Error("retorno sem code"))
      fim(200, "Conectado. Pode fechar esta aba e voltar ao terminal.")
    })
    const timer = setTimeout(() => { server.close(); reject(new Error("tempo esgotado esperando a autorizacao")) }, timeoutMs)
    server.on("error", (e) => { clearTimeout(timer); reject(new Error(e.code === "EADDRINUSE" ? `porta ${port} ocupada; feche o que a usa e tente de novo` : e.message)) })
    server.listen(port, () => {
      console.log(`Servidor local em http://localhost:${port}. Abrindo o navegador para autorizar...`)
      console.log("Se a janela nao abrir, copie e cole este endereco no navegador:\n" + authUrl)
      open(authUrl)
    })
  })
}

/** Registra a conexao no painel (ct_connections) sem nunca derrubar o script. */
export async function registrarSemFalhar(dados) {
  try {
    const { resolveClient } = await import("../../_lib/workspace-client.mjs")
    const { registrarConexao, encerrarPool } = await import("../../sala/connections-lib.mjs")
    try { await registrarConexao({ client_slug: resolveClient(), ...dados }) } finally { await encerrarPool() }
  } catch {
    console.log("(Aviso: nao registrei a conexao no painel. O token ja esta salvo no .env.local e funciona.)")
  }
}
