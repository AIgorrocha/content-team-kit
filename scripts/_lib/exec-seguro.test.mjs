import { test } from "node:test"
import assert from "node:assert/strict"
import { execSeguro, resolverComando } from "./exec-seguro.mjs"

test("argumentos com metacaracteres de shell chegam literais", () => {
  const perigoso = 'a"; echo PWNED & calc | `x` $(y) --"'
  const out = execSeguro(process.execPath, ["-e", "console.log(process.argv[1])", "--", perigoso], { encoding: "utf8" })
  assert.equal(out.trim(), perigoso)
})

test("npx resolve para um arquivo executavel sem shell", () => {
  const r = resolverComando("npx")
  assert.ok(r.file)
})
