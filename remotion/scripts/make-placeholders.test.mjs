import test from "node:test"
import assert from "node:assert/strict"
import { makePng } from "./make-placeholders.mjs"

test("gera um PNG valido (assinatura, IHDR com o tamanho pedido e IEND)", () => {
  const png = makePng(8, 4, () => [1, 2, 3])
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.readUInt32BE(16), 8) // largura
  assert.equal(png.readUInt32BE(20), 4) // altura
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString(), "IEND")
})
