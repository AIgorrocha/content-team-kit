// Carrega .env.local e depois .env da raiz do kit (o que ja estiver no ambiente vence).
// Uso: import "./_env.mjs"  (efeito colateral, sem exportar nada)
import { readFileSync, existsSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
for (const file of [".env.local", ".env"]) {
  const path = join(ROOT, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}
