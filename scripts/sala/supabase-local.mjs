#!/usr/bin/env node
// Controla o Supabase local sem exibir chaves geradas pela CLI.
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const [action, ...flags] = process.argv.slice(2)
const configure = flags.includes("--configure")
const root = resolve(import.meta.dirname, "../..")
const envPath = resolve(root, ".env.local")
const require = createRequire(import.meta.url)

if (!['start', 'stop'].includes(action) || flags.some((flag) => flag !== "--configure") || (configure && action !== "start")) {
  console.error("Uso: node scripts/sala/supabase-local.mjs <start|stop> [--configure]")
  process.exit(1)
}

if (configure && existsSync(envPath)) {
  console.error(".env.local ja existe. A configuracao local nao sobrescreve arquivos existentes.")
  process.exit(1)
}

function resolveSupabaseBin() {
  const pkgPath = require.resolve("supabase/package.json", { paths: [root] })
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.supabase
  if (!binRel) throw new Error("bin ausente")
  return resolve(dirname(pkgPath), binRel)
}

let supabaseBin
try {
  supabaseBin = resolveSupabaseBin()
} catch {
  console.error("CLI do Supabase nao encontrada. Rode npm install antes.")
  process.exit(1)
}

function run(args) {
  // A CLI instalada fornece um launcher JavaScript. Node evita shell e arquivos .cmd.
  return spawnSync(process.execPath, [supabaseBin, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
}

function exitForFailure(result, label) {
  if (!result.error && result.status === 0) return
  const code = result.status ?? "erro"
  console.error(`Falha ao ${label} o Supabase local (codigo ${code}).`)
  process.exit(result.status || 1)
}

function localStatus() {
  const result = run(["status", "--output", "json"])
  exitForFailure(result, "consultar")
  try {
    return JSON.parse(result.stdout)
  } catch {
    console.error("Falha ao ler o estado seguro do Supabase local.")
    process.exit(1)
  }
}

function normalizeKey(key) {
  return String(key).replace(/[_\s]+/g, "").toLowerCase()
}

function value(status, aliases) {
  const targets = aliases.map(normalizeKey)
  const entry = Object.entries(status).find(([key]) => targets.includes(normalizeKey(key)))
  return entry?.[1]
}

function endpoint(value) {
  const url = new URL(String(value))
  return `${url.protocol}//${url.host}`
}

if (action === "stop") {
  exitForFailure(run(["stop"]), "interromper")
  console.log("Supabase local interrompido.")
  process.exit(0)
}

exitForFailure(run(["start"]), "iniciar")
const status = localStatus()
const apiUrl = value(status, ["api_url"])
const dbUrl = value(status, ["db_url"])
const studioUrl = value(status, ["studio_url"])
console.log("Supabase local ativo.")
if (apiUrl) console.log(`API: ${endpoint(apiUrl)}`)
if (dbUrl) console.log(`Banco: ${new URL(String(dbUrl)).hostname}:${new URL(String(dbUrl)).port}`)
if (studioUrl) console.log(`Studio: ${endpoint(studioUrl)}`)

if (configure) {
  const anonKey = value(status, ["anon_key", "publishable_key"])
  const serviceRoleKey = value(status, ["service_role_key", "secret_key"])
  if (!apiUrl || !dbUrl || !anonKey || !serviceRoleKey) {
    console.error("O Supabase local iniciou, mas faltam dados para criar .env.local.")
    process.exit(1)
  }
  const env = [
    `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `SUPABASE_URL=${apiUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `DATABASE_URL=${dbUrl}`,
    "DATABASE_SSL=false",
    "SALA_DATA=live",
    `CREDENTIALS_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
    "",
  ].join("\n")
  writeFileSync(envPath, env, { encoding: "utf8", flag: "wx", mode: 0o600 })
  console.log(".env.local local criado sem exibir valores.")
}
