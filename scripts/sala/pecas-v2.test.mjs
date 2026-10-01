import test from "node:test"
import assert from "node:assert/strict"
import { agruparPecasPorSlug, pecaBase } from "../../src/lib/sala/fontes/pecas-disco.ts"

test("formatos com mesmo slug formam uma peça com todos os artefatos e revisões", () => {
  const data = "2026-09-13T00:00:00Z"
  const criar = (tipo, id) => pecaBase("exemplo", tipo, "cliente", [{ id, tipo: "video", nome: id, url: `/asset/${id}` }], [{ id: "r1", numero: 1, artefatoIds: [id], criadaEm: data, criadaPor: "cliente", oQueMudou: "inicial", aprovadaEm: null }], null, data, data)
  const primeiro = criar("reel", "reel-video")
  const segundo = criar("youtube_longo", "youtube-video")
  const resultado = agruparPecasPorSlug([primeiro, segundo])
  assert.equal(resultado.length, 1)
  assert.equal(resultado[0].tipo, "youtube_longo")
  assert.equal(resultado[0].artefatos.length, 2)
  assert.deepEqual(resultado[0].revisoes[0].artefatoIds, ["reel-video", "youtube-video"])
  assert.equal(primeiro.artefatos.length, 1)
})
