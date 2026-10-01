#!/usr/bin/env node
// Sobe a Sala apontando pro banco Docker local, sem tocar em .env.local nem imprimir a URL.
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { spawn } from "node:child_process"
import { Client } from "pg"

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, "../..")

const args = process.argv.slice(2)
const portFlagIndex = args.indexOf("--port")
const port = portFlagIndex !== -1 ? Number(args[portFlagIndex + 1]) : 5056
if (!Number.isInteger(port) || port <= 0) {
  console.error("--port precisa ser um numero inteiro valido.")
  process.exit(1)
}
const comVigia = !args.includes("--sem-vigia")

const databaseUrl =
  process.env.SALA_LOCAL_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
try {
  const local = new URL(databaseUrl)
  if (!["postgres:", "postgresql:"].includes(local.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) || local.search) {
    throw new Error("URL fora do banco local")
  }
} catch {
  console.error("SALA_LOCAL_DATABASE_URL deve apontar para o PostgreSQL local, sem parâmetros na URL.")
  process.exit(1)
}

process.env.NEXT_PUBLIC_SUPABASE_URL = ""
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ""
process.env.SALA_DATA = "live"
process.env.DATABASE_SSL = "false"
process.env.DATABASE_URL = databaseUrl
process.env.SALA_OAUTH_ORIGIN ||= `http://localhost:${port}`

async function checkDatabasePort() {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000, query_timeout: 3000, ssl: false })
  try {
    await client.connect()
    await client.query("select 1")
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

function resolveNextBin() {
  const pkgPath = require.resolve("next/package.json", { paths: [root] })
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.next
  if (!binRel) throw new Error("bin ausente")
  return resolve(dirname(pkgPath), binRel)
}

const ok = await checkDatabasePort()
if (!ok) {
  console.error("O banco local não respondeu à consulta. Confira o Docker e rode npm run supabase:start. Se o contêiner estiver saudável, verifique o encaminhamento da porta local.")
  process.exit(1)
}

let nextBin
try {
  nextBin = resolveNextBin()
} catch {
  console.error("Next.js nao encontrado. Rode npm install antes.")
  process.exit(1)
}

const child = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
})

// Vigia (scripts/sala/watch-sync.mjs) sobe junto pra manter agents/skills/regras
// sincronizados com o banco enquanto a Sala roda local. --sem-vigia desliga.
const vigia = comVigia
  ? spawn(process.execPath, [resolve(root, "scripts", "sala", "watch-sync.mjs")], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    })
  : null

let encerrando = false
function encerrarTudo(codigoNext) {
  if (encerrando) return
  encerrando = true
  if (vigia && !vigia.killed) vigia.kill()
  process.exit(codigoNext)
}

child.on("exit", (code, signal) => {
  encerrarTudo(code ?? (signal ? 1 : 0))
})

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    if (!child.killed) child.kill(sinal)
    if (vigia && !vigia.killed) vigia.kill(sinal)
    encerrarTudo(0)
  })
}
