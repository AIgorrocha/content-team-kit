import { test } from "node:test"
import assert from "node:assert/strict"
import { slugValido, somentePrevia, temPode } from "./guarda.mjs"

test("slug aceita so minusculas, numeros e hifen", () => {
  for (const ok of ["a", "peca-1", "9-dias", "minha-marca"]) assert.ok(slugValido(ok), ok)
  for (const ruim of ["", "-x", "../x", "a/b", "A", "a b", "a_b", "x\ny", "a..", null, undefined, 3])
    assert.ok(!slugValido(ruim), String(ruim))
})

test("sem --pode so previa; com --pode publica; --dry-run vence", () => {
  assert.equal(somentePrevia(["x"]), true)
  assert.equal(somentePrevia(["x", "--pode"]), false)
  assert.equal(somentePrevia(["x", "--pode", "--dry-run"]), true)
  assert.equal(temPode(["--pode"]), true)
})
