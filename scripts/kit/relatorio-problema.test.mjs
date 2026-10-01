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

test("sanear cobre chaves Google/Supabase/Telegram/OAuth, URL com senha, cabeçalhos e caminhos com espaço", () => {
  const casos = [
    ["AIza" + "x".repeat(35), "AIza"],
    ["sb_secret_" + "a".repeat(30), "sb_secret_"],
    ["sbp_" + "b".repeat(40), "sbp_"],
    ["123456789:" + "Cc".repeat(18), "123456789:"],
    ["ya29." + "d".repeat(40), "ya29."],
    ["1//" + "e".repeat(40), "1//"],
    ["https://x.com/a?token=segredo123&b=1", "segredo123"],
    ["https://x.com/a?apikey=segredo124", "segredo124"],
    ["usei key=segredo125 aqui", "segredo125"],
    ["secret=segredo126", "segredo126"],
    ["x-sala-token: segredo127", "segredo127"],
    ["Authorization: Basic dXNlcjpzZW5oYQ==", "dXNlcjpz"],
    ["postgres://admin:senhaforte128@localhost:5432/db", "senhaforte128"],
    ["postgres://admin:senhaforte129@db.exemplo.co/db", "senhaforte129"],
    ["C:\\Users\\Maria Souza Lima\\Documentos\\a.png", "Maria"],
    ["/mnt/c/Users/joao/Desktop/a.png", "joao"],
  ]
  for (const [entrada, vazou] of casos) {
    const saida = sanear(`antes ${entrada} depois`)
    assert.ok(!saida.includes(vazou), `vazou ${vazou}: ${saida}`)
  }
  assert.match(sanear("C:\\Users\\Maria Souza\\Docs\\a.png ok"), /~\\Docs\\a\.png ok/)
})
