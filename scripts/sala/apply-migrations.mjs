#!/usr/bin/env node
// Aplicador de migrations da Sala de Comando.
//
// Le supabase/migrations/*.sql em ordem de nome de arquivo e aplica, dentro de uma
// transacao cada, todo arquivo que ainda nao esta registrado em ct_sala_migrations.
//
// Flags:
//   --only-sala (padrao) restringe aos arquivos cujo nome contem "sala"
//   --all       aplica TODOS os arquivos de supabase/migrations (pensado pra banco
//               local vazio, Tarefa C1; as migrations numeradas antigas (001..007)
//               nao foram todas escritas pra serem idempotentes contra um banco que
//               ja tem dado, entao --all so e seguro num Postgres recem-criado)
//   --dry       so imprime o plano, nao aplica nada
//
// Nunca imprime valor de env (DATABASE_URL etc).

import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Pool } from "pg"

dotenv.config({ path: ".env.local" })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(__dirname, "..", "..", "supabase", "migrations")

const args = process.argv.slice(2)
const dry = args.includes("--dry")
const all = args.includes("--all")
// --only-sala e o padrao; so muda de comportamento se --all foi passado.
const onlySala = !all

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL nao definida (.env.local).")
  process.exit(1)
}

if (all && !isLocalUrl(databaseUrl)) {
  console.error("--all so pode ser usado com DATABASE_URL local e banco vazio.")
  process.exit(1)
}

function isLocalUrl(url) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

const useSsl = !isLocalUrl(databaseUrl) && process.env.DATABASE_SSL !== "false"

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

function listMigrationFiles() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  return onlySala ? files.filter((f) => f.includes("sala")) : files
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.ct_sala_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `)
}

async function getApplied(client) {
  const { rows } = await client.query("select name from public.ct_sala_migrations")
  return new Set(rows.map((r) => r.name))
}

async function main() {
  const files = listMigrationFiles()
  const client = await pool.connect()
  const results = []
  try {
    await ensureMigrationsTable(client)
    const applied = await getApplied(client)

    for (const file of files) {
      if (applied.has(file)) {
        results.push({ name: file, status: "skipped" })
        continue
      }
      if (dry) {
        results.push({ name: file, status: "pendente (dry)" })
        continue
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
      try {
        await client.query("BEGIN")
        await client.query(sql)
        await client.query(
          "insert into public.ct_sala_migrations (name) values ($1) on conflict (name) do nothing",
          [file]
        )
        await client.query("COMMIT")
        results.push({ name: file, status: "applied" })
      } catch (err) {
        await client.query("ROLLBACK")
        results.push({ name: file, status: "error", error: err.message })
        break
      }
    }
  } finally {
    client.release()
    await pool.end()
  }

  const nameWidth = Math.max(4, ...results.map((r) => r.name.length))
  console.log(`${"name".padEnd(nameWidth)} | status`)
  console.log(`${"-".repeat(nameWidth)} | ------`)
  for (const r of results) {
    const line = `${r.name.padEnd(nameWidth)} | ${r.status}`
    console.log(r.error ? `${line} (${r.error})` : line)
  }

  if (results.some((r) => r.status === "error")) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error("Falha ao aplicar migrations:", err.message)
  process.exitCode = 1
})
