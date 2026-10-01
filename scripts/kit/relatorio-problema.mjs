#!/usr/bin/env node
// Monta o texto de um relatório de problema (ou sugestão) para o dono do kit, já saneado.
// Uso: node scripts/kit/relatorio-problema.mjs --titulo "..." --descricao "..." [--erro "..."] (--texto | --url)
// Nunca lê .env.local, clients/ nem content/. Só lê .env.local.example (nomes de variáveis, sem valor).
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { platform, release } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
const URL_ISSUES = "https://github.com/AIgorrocha/content-team-kit/issues/new"
const MAX_URL = 6000 // GitHub recusa URLs acima de ~8000 caracteres

function nomesDeVariaveis() {
  const arq = resolve(RAIZ, ".env.local.example")
  if (!existsSync(arq)) return []
  return [...readFileSync(arq, "utf8").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1])
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function sanear(texto, raiz = RAIZ, nomes = nomesDeVariaveis()) {
  let t = String(texto ?? "")
  // caminho do kit vira relativo (as duas grafias de barra)
  for (const r of new Set([raiz, raiz.replace(/\\/g, "/")])) {
    t = t.replace(new RegExp(`${esc(r)}[\\\\/]?`, "gi"), "./")
  }
  // CHAVE=valor de variável conhecida
  if (nomes.length) {
    t = t.replace(
      new RegExp(`\\b(${nomes.map(esc).join("|")})[ \\t]*[=:][ \\t]*(?:"[^"]*"|'[^']*'|\\S+)`, "g"),
      "$1=[removido]",
    )
  }
  // tokens com cara de segredo
  t = t
    .replace(/\bEAA[A-Za-z0-9]{10,}/g, "[token removido]")
    .replace(/\bIGAA[A-Za-z0-9_-]{10,}/g, "[token removido]")
    .replace(/\bsk-[A-Za-z0-9_-]{10,}/g, "[token removido]")
    .replace(/\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{10,}/g, "[token removido]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{10,}/g, "[token removido]")
    .replace(/\beyJ[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+)*/g, "[token removido]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi, "Bearer [token removido]")
  // e-mails
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail removido]")
  // caminhos absolutos que sobraram (pasta do usuário primeiro, depois qualquer unidade)
  t = t
    .replace(/[A-Za-z]:[\\/]Users[\\/][^\\/\s"'<>|]+/gi, "~")
    .replace(/\/(?:Users|home)\/[^/\s"'<>|]+/g, "~")
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>|]*/g, "<caminho-local>")
  return t
}

function git(...args) {
  const r = spawnSync("git", args, { cwd: RAIZ, encoding: "utf8" })
  return r.status === 0 ? r.stdout.trim() : ""
}

export function montar({ titulo, descricao, erro }) {
  const versao = git("rev-parse", "--short", "HEAD") || "desconhecida"
  const data = git("log", "-1", "--format=%cs") || "sem data"
  const partes = [`## O que aconteceu\n${descricao || "(sem descrição)"}`]
  if (erro) partes.push("## Mensagem de erro\n```\n" + erro + "\n```")
  partes.push(
    `## Informações do kit\n- Versão do kit: ${versao} (${data})\n- Sistema: ${platform()} ${release()}\n- Node: ${process.version}`,
  )
  return {
    titulo: sanear(titulo || "Problema no kit").slice(0, 200),
    corpo: sanear(partes.join("\n\n")),
  }
}

export function montarUrl({ titulo, corpo }) {
  const aviso = "\n\n[texto cortado por tamanho]"
  const fazer = (b) => `${URL_ISSUES}?title=${encodeURIComponent(titulo)}&body=${encodeURIComponent(b)}`
  let letras = Array.from(corpo)
  let url = fazer(corpo)
  while (url.length > MAX_URL && letras.length > 0) {
    letras = letras.slice(0, Math.floor(letras.length * 0.9))
    url = fazer(letras.join("") + aviso)
  }
  return url
}

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rel = montar({ titulo: arg("titulo"), descricao: arg("descricao"), erro: arg("erro") })
  if (process.argv.includes("--url")) console.log(montarUrl(rel))
  else console.log(`${rel.titulo}\n\n${rel.corpo}`) // --texto (padrão)
}
