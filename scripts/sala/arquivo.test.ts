import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"
import { escreverComHash } from "../../src/lib/sala/escrita/arquivo"
import { ConflitoEdicao } from "../../src/lib/sala/types"
import { sha256 } from "../../src/lib/sala/fontes/hash"
import { lerArquivo } from "../../src/lib/sala/fontes/arquivos"
import { spawn } from "node:child_process"

test("escrita preserva EOL, rejeita hash antigo e trava existente, limpa temporários", () => {
  const pasta = mkdtempSync(join(process.cwd(), "output", "sala-arquivo-"))
  const arquivo = join(pasta, "fonte.md")
  const rel = relative(process.cwd(), arquivo)
  try {
    writeFileSync(arquivo, "linha 1\r\nlinha 2\r\n")
    const antes = readFileSync(arquivo, "utf8")
    const novoHash = escreverComHash(rel, "novo\ntexto\n", sha256(antes))
    assert.equal(readFileSync(arquivo, "utf8"), "novo\r\ntexto\r\n")
    assert.throws(() => escreverComHash(rel, "perdido", sha256(antes)), ConflitoEdicao)
    writeFileSync(arquivo + ".sala-lock", "")
    assert.throws(() => escreverComHash(rel, "outro processo", novoHash), ConflitoEdicao)
    assert.equal(readFileSync(arquivo, "utf8"), "novo\r\ntexto\r\n")
    assert.deepEqual(readdirSync(pasta).sort(), ["fonte.md", "fonte.md.sala-lock"])
    assert.throws(() => escreverComHash("../fora.md", "x", novoHash))
    assert.throws(() => escreverComHash(arquivo, "x", novoHash))
  } finally { rmSync(pasta, { recursive: true, force: true }) }
})

test("leitura e escrita recusam diretório ligado por junction, mesmo dentro do repo", () => {
  const pasta = mkdtempSync(join(process.cwd(), "output", "sala-link-"))
  const destino = join(pasta, "destino")
  const link = join(pasta, "link")
  mkdirSync(destino)
  writeFileSync(join(destino, "fonte.md"), "preservado")
  try {
    symlinkSync(destino, link, process.platform === "win32" ? "junction" : "dir")
    const rel = relative(process.cwd(), join(link, "fonte.md"))
    assert.equal(lerArquivo(rel), null)
    assert.throws(() => escreverComHash(rel, "nao gravar", sha256("preservado")))
    assert.equal(readFileSync(join(destino, "fonte.md"), "utf8"), "preservado")
  } finally { rmSync(link, { force: true, recursive: true }); rmSync(pasta, { recursive: true, force: true }) }
})

test("duas instâncias com o mesmo hash permitem uma única gravação", async () => {
  const pasta = mkdtempSync(join(process.cwd(), "output", "sala-processos-"))
  const arquivo = join(pasta, "fonte.md")
  writeFileSync(arquivo, "original")
  const programa = `const {escreverComHash}=require('./src/lib/sala/escrita/arquivo.ts');
    const {ConflitoEdicao}=require('./src/lib/sala/types.ts');
    try { escreverComHash(process.argv[1], process.argv[2], process.argv[3]); }
    catch(e) { if (!(e instanceof ConflitoEdicao)) console.error(e.constructor.name, e.code); process.exit(e instanceof ConflitoEdicao ? 9 : 10); }`
  const gravar = (texto: string) => new Promise<number | null>((resolve, reject) => {
    const filho = spawn(process.execPath, ["--import", "tsx", "-e", programa, relative(process.cwd(), arquivo), texto, sha256("original")], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] })
    let erro = ""
    filho.stderr.on("data", (trecho) => { erro += trecho })
    filho.once("error", reject)
    filho.once("exit", (codigo) => codigo === 10 ? reject(new Error(erro)) : resolve(codigo))
  })
  try {
    const resultados = await Promise.all([gravar("primeiro"), gravar("segundo")])
    assert.deepEqual(resultados.sort(), [0, 9])
    assert.ok(["primeiro", "segundo"].includes(readFileSync(arquivo, "utf8")))
    assert.deepEqual(readdirSync(pasta), ["fonte.md"])
  } finally { rmSync(pasta, { recursive: true, force: true }) }
})
