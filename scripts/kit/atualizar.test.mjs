import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "atualizar.mjs")

const git = (cwd, ...a) => {
  const r = spawnSync("git", ["-c", "user.name=T", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" })
  assert.equal(r.status, 0, `git ${a.join(" ")}: ${r.stderr}`)
  return r.stdout.trim()
}
const ler = (p) => readFileSync(p, "utf8").split(String.fromCharCode(13)).join("")
const salvar = (cwd, arq, txt, msg) => {
  mkdirSync(dirname(join(cwd, arq)), { recursive: true })
  writeFileSync(join(cwd, arq), txt)
  git(cwd, "add", "-A")
  git(cwd, "commit", "-m", msg)
}

// "kit oficial" + uma cópia clonada (origin aponta pro kit)
function cenario() {
  const base = mkdtempSync(join(tmpdir(), "kit-test-"))
  const kit = join(base, "kit")
  mkdirSync(kit)
  git(kit, "init", "-b", "master")
  salvar(kit, "README.md", "linha 1\n", "inicio")
  const copia = join(base, "copia")
  git(base, "clone", kit, copia)
  const roda = (...args) =>
    spawnSync("node", [SCRIPT, ...args], { cwd: copia, encoding: "utf8", env: { ...process.env, KIT_UPSTREAM_URL: kit } })
  return { kit, copia, roda }
}

test("atualização limpa aplica", () => {
  const { kit, copia, roda } = cenario()
  salvar(kit, "novo.txt", "oi\n", "traz novo")
  const r = roda()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /atualizado com sucesso/)
  assert.ok(existsSync(join(copia, "novo.txt")))
  assert.match(roda().stdout, /já está atualizado/)
})

test("--verificar não aplica", () => {
  const { kit, copia, roda } = cenario()
  salvar(kit, "novo.txt", "oi\n", "traz novo")
  const r = roda("--verificar")
  assert.equal(r.status, 0)
  assert.match(r.stdout, /traz novo/)
  assert.ok(!existsSync(join(copia, "novo.txt")))
})

test("alteração não salva em arquivo do kit bloqueia", () => {
  const { kit, copia, roda } = cenario()
  salvar(kit, "novo.txt", "oi\n", "traz novo")
  writeFileSync(join(copia, "README.md"), "mexi\n")
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(r.stdout, /README\.md/)
  assert.ok(!existsSync(join(copia, "novo.txt")))
  assert.equal(ler(join(copia, "README.md")), "mexi\n")
})

test("arquivo novo não rastreado em clients/ não bloqueia e permanece", () => {
  const { kit, copia, roda } = cenario()
  salvar(kit, "novo.txt", "oi\n", "traz novo")
  mkdirSync(join(copia, "clients", "x"), { recursive: true })
  writeFileSync(join(copia, "clients", "x", "brand-profile.md"), "minha marca\n")
  const r = roda()
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.ok(existsSync(join(copia, "novo.txt")))
  assert.equal(ler(join(copia, "clients", "x", "brand-profile.md")), "minha marca\n")
})

test("conflito aborta sem deixar merge pela metade", () => {
  const { kit, copia, roda } = cenario()
  salvar(kit, "README.md", "versão do kit\n", "kit muda")
  salvar(copia, "README.md", "versão local\n", "local muda")
  const r = roda()
  assert.equal(r.status, 1)
  assert.match(r.stdout, /README\.md/)
  assert.ok(!existsSync(join(copia, ".git", "MERGE_HEAD")))
  assert.equal(git(copia, "status", "--porcelain"), "")
  assert.equal(ler(join(copia, "README.md")), "versão local\n")
})
