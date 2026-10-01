import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { resolveClient, assertClient, bootstrapActiveClient } from "./workspace-client.mjs"

const dir = mkdtempSync(join(tmpdir(), "ct-ws-"))
mkdirSync(join(dir, "clients"))
for (const cliente of ["cliente-a", "cliente-b"]) {
  mkdirSync(join(dir, "clients", cliente))
  writeFileSync(join(dir, "clients", cliente, "brand-profile.md"), "# Cliente de prova\n")
}
writeFileSync(join(dir, ".workspace"), "client: cliente-a\n")
delete process.env.CT_CLIENT
if (resolveClient(dir) !== "cliente-a") throw new Error("resolve .workspace")
bootstrapActiveClient(dir)
const md = readFileSync(join(dir, "clients", "active-client.md"), "utf8")
if (!/client: cliente-a/.test(md)) throw new Error("bootstrap")
let threw = false
try {
  assertClient("cliente-b", dir)
} catch {
  threw = true
}
if (!threw) throw new Error("assert deveria recusar")
process.env.CT_CLIENT = "cliente-b"
if (resolveClient(dir) !== "cliente-b") throw new Error("env vence .workspace")
delete process.env.CT_CLIENT
console.log("ok")
