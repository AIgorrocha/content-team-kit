#!/usr/bin/env node
// Traz a atualização do kit (merge do master do repositório oficial do kit).
// Uso: node scripts/kit/atualizar.mjs [--verificar]
// Roda na pasta atual (process.cwd()). Nunca apaga nada de clients/ ou content/.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const URL_KIT = process.env.KIT_UPSTREAM_URL || "https://github.com/AIgorrocha/content-team-kit.git"
const BRANCH = "master"
const soVerificar = process.argv.includes("--verificar")

function git(...args) {
  const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { encoding: "utf8" })
  return { ok: r.status === 0, out: (r.stdout || "").trimEnd(), err: (r.stderr || "").trim() }
}

function parar(msg) {
  console.log(`\n${msg}\n`)
  process.exit(1)
}

const norm = (u) => u.trim().replace(/\\/g, "/").replace(/\/+$/, "").replace(/\.git$/, "").toLowerCase()
const gitPath = (p) => resolve(git("rev-parse", "--git-path", p).out)
const marca = (f) => f.startsWith("clients/") || f.startsWith("content/")

// 1. Precisa ser um repositório git
if (!git("rev-parse", "--is-inside-work-tree").ok) {
  parar('Esta pasta não foi baixada com o Git (não é um repositório). Peça ao Claude: "baixar o kit".')
}

// 2. Merge ou rebase em andamento
if (["MERGE_HEAD", "rebase-merge", "rebase-apply"].some((p) => existsSync(gitPath(p)))) {
  parar("Há uma atualização ou junção de arquivos pela metade nesta pasta. Peça ajuda ao Claude antes de continuar. Nada foi alterado.")
}

// 3. Alteração não salva em arquivo do kit (marca em clients/ e content/ não conta)
const sujos = git("status", "--porcelain", "--untracked-files=no").out
  .split("\n").filter(Boolean).map((l) => l.slice(3).split(" -> ").pop()).filter((f) => !marca(f))
if (sujos.length) {
  parar(
    "Não dá pra atualizar agora: existem arquivos do kit com alterações não salvas (commit):\n" +
      sujos.map((f) => `  - ${f}`).join("\n") +
      "\nArquivos do kit não devem ser editados por você (a marca fica em clients/). Peça ao Claude para desfazer ou salvar essas alterações, e tente de novo. Nada foi alterado.",
  )
}

// 4. Remoto que aponta pro kit: usa origin/upstream se já apontar, senão cria upstream
const nomes = git("remote").out.split("\n").filter(Boolean)
let remoto = nomes.find((n) => norm(git("remote", "get-url", n).out) === norm(URL_KIT))
if (!remoto) {
  remoto = nomes.includes("upstream") ? "kit-upstream" : "upstream"
  if (!git("remote", "add", remoto, URL_KIT).ok) parar("Não consegui registrar o endereço do kit. Peça ajuda ao Claude.")
  console.log(`Registrei o endereço do kit como "${remoto}".`)
}

// 5. Buscar
const f = git("fetch", remoto, BRANCH)
if (!f.ok) parar(`Não consegui buscar a atualização (internet fora do ar?).\nDetalhe: ${f.err}`)
const ref = `${remoto}/${BRANCH}`

const novos = git("log", "--oneline", `HEAD..${ref}`).out
if (!novos) {
  console.log("\nO kit já está atualizado. Nada a fazer.\n")
  process.exit(0)
}
const linhas = novos.split("\n")
const arquivos = git("diff", "--name-only", `HEAD...${ref}`).out.split("\n").filter(Boolean)
console.log(`\nChegaram ${linhas.length} novidade(s) do kit:\n${linhas.map((l) => `  - ${l.slice(l.indexOf(" ") + 1)}`).join("\n")}`)
console.log(`(${arquivos.length} arquivo(s) do kit mudam. Sua marca em clients/ e content/ não é tocada.)`)

if (soVerificar) {
  console.log("\nModo verificar: nada foi aplicado. Rode sem --verificar para atualizar.\n")
  process.exit(0)
}

// 6. Merge (sem abrir editor). Sem nome configurado no git, usa um provisório só nesta chamada.
const id = git("config", "user.name").out ? [] : ["-c", "user.name=Kit", "-c", "user.email=kit@local"]
const m = git(...id, "merge", "--no-edit", ref)
if (!m.ok) {
  const conflitos = git("diff", "--name-only", "--diff-filter=U").out.split("\n").filter(Boolean)
  if (existsSync(gitPath("MERGE_HEAD"))) git("merge", "--abort")
  parar(
    conflitos.length
      ? "A atualização não coube: você e o kit mudaram o mesmo trecho destes arquivos:\n" +
          conflitos.map((x) => `  - ${x}`).join("\n") +
          "\nDesfiz tudo, sua pasta está como estava (marca intacta). Peça ajuda ao Claude para resolver."
      : `A atualização não pôde ser aplicada. Sua pasta está como estava.\nDetalhe: ${m.err || m.out}`,
  )
}

console.log("\nKit atualizado com sucesso.")
if (arquivos.some((x) => x === "package.json" || x === "package-lock.json")) {
  console.log("Atenção: as dependências mudaram. Rode `npm install` para instalar as novidades.")
}
console.log()
