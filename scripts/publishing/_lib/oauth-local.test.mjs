// node --test scripts/publishing/_lib/oauth-local.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { captureAuthCode, saveEnvVar } from "./oauth-local.mjs"

const porta = () => 20000 + Math.floor(Math.random() * 20000)

test("saveEnvVar troca a linha existente, acrescenta a nova e respeita CRLF", () => {
  const f = join(mkdtempSync(join(tmpdir(), "env-")), ".env.local")
  writeFileSync(f, "A=1\r\nTOKEN=velho\r\nB=2")
  saveEnvVar(f, "TOKEN", "novo")
  saveEnvVar(f, "OUTRO", "x")
  assert.equal(readFileSync(f, "utf8"), "A=1\r\nTOKEN=novo\r\nB=2\r\nOUTRO=x\r\n")
  assert.throws(() => saveEnvVar(f, "TOKEN", "a\nb"), /quebra de linha/)
  assert.throws(() => saveEnvVar(f, "minusculo", "x"), /invalido/)
})

test("captureAuthCode devolve o code quando o state confere", async () => {
  const p = porta()
  const pronto = captureAuthCode({
    authUrl: "http://x", state: "s1", port: p,
    open: () => setTimeout(() => fetch(`http://127.0.0.1:${p}/callback?code=abc&state=s1`), 50),
  })
  assert.equal(await pronto, "abc")
})

test("captureAuthCode recusa state diferente e retorno com erro", async () => {
  const p = porta()
  await assert.rejects(captureAuthCode({
    authUrl: "http://x", state: "s1", port: p,
    open: () => setTimeout(() => fetch(`http://127.0.0.1:${p}/callback?code=abc&state=outro`), 50),
  }), /state diferente/)
  const q = porta()
  await assert.rejects(captureAuthCode({
    authUrl: "http://x", state: "s1", port: q,
    open: () => setTimeout(() => fetch(`http://127.0.0.1:${q}/callback?error=access_denied&state=s1`), 50),
  }), /nao concluida/)
})
