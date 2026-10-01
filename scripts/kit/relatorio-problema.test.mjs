import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { sanear } from "./relatorio-problema.mjs"

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "relatorio-problema.mjs")
const RAIZ = resolve(dirname(SCRIPT), "..", "..")

const segredos = [
  "EAA" + "B".repeat(40),
  "IGAA" + "c".repeat(40),
  "sk-" + "d".repeat(40),
  "ghp_" + "e".repeat(36),
  "eyJ" + "f".repeat(40) + ".payload123.assinatura456",
]

test("sanear remove tokens, e-mail e caminho absoluto", () => {
  const entrada = [
    ...segredos.map((s) => `chave ${s} fim`),
    "JWT_SECRET=minha-senha-123",
    "contato: maria.silva@empresa.com.br",
    `falhou em ${RAIZ}\\scripts\\x.mjs`,
    "abriu C:\\Users\\Maria\\Documentos\\marca.png",
    "abriu /Users/maria/marca.png",
  ].join("\n")
  const saida = sanear(entrada)
  for (const s of segredos) assert.ok(!saida.includes(s), `vazou ${s.slice(0, 6)}`)
  assert.ok(!saida.includes("minha-senha-123"))
  assert.match(saida, /JWT_SECRET=\[removido\]/)
  assert.ok(!saida.includes("maria.silva@empresa.com.br"))
  assert.ok(!saida.includes(RAIZ))
  assert.match(saida, /\.\/scripts\\x\.mjs/)
  assert.ok(!saida.includes("C:\\Users"))
  assert.ok(!saida.includes("/Users/maria"))
})

test("CLI --texto e --url saneiam e --url respeita o limite", () => {
  const run = (...a) => spawnSync("node", [SCRIPT, ...a], { encoding: "utf8" })
  const t = run("--titulo", "Erro", "--descricao", `token ${segredos[3]} email a@b.com`, "--erro", "x".repeat(20000), "--texto")
  assert.equal(t.status, 0, t.stderr)
  assert.ok(!t.stdout.includes(segredos[3]) && !t.stdout.includes("a@b.com"))
  assert.match(t.stdout, /Versão do kit/)
  const u = run("--titulo", "Erro", "--descricao", "d", "--erro", "x".repeat(20000), "--url").stdout.trim()
  assert.ok(u.startsWith("https://github.com/AIgorrocha/content-team-kit/issues/new?title=Erro&body="))
  assert.ok(u.length <= 6100, `url longa: ${u.length}`)
})
