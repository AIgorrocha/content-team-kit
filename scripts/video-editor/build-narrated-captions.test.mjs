import test from "node:test"
import assert from "node:assert/strict"
import { buildNarrated } from "./build-narrated-captions.mjs"

const raw = {
  segments: [
    { words: [{ word: "Ola", start: 0.3, end: 0.6 }, { word: "mundo.", start: 0.7, end: 1.2 }] },
    { words: [{ word: "Segunda", start: 2.0, end: 2.4 }, { word: "frase", start: 2.5, end: 2.9 }, { word: "aqui", end: 3.2 }] },
  ],
}

test("uma cena por frase, contiguas, comecando na primeira palavra real", () => {
  const p = buildNarrated(raw, { media: ["a.mp4", "b.png"], clipSec: 5 })
  assert.equal(p.segments.length, 2)
  assert.equal(p.segments[0].startMs, 300)
  assert.equal(p.segments[0].endMs, p.segments[1].startMs) // sem buraco
  assert.equal(p.segments[1].startMs, 2000)
  assert.equal(p.segments[1].endMs, 3200)
  assert.equal(p.segments[0].kind, "video")
  assert.equal(p.segments[0].clipSec, 5)
  assert.equal(p.segments[1].kind, "image")
  assert.equal(p.segments[1].clipSec, null)
  assert.equal(p.segments[0].words[1].startMs, 400) // relativo ao inicio da cena
})

test("palavra sem tempo herda do vizinho e correcao troca o texto", () => {
  const p = buildNarrated(raw, { fix: { 4: "aqui!" } })
  assert.equal(p.segments[1].words[2].text, "aqui!")
  assert.equal(p.segments[1].words[2].startMs, 900) // herdou o fim da palavra anterior (2.9s)
})

test("fix vazio remove a palavra; per-scene junta frases; max-words quebra a linha", () => {
  const p = buildNarrated(raw, { fix: { 0: "" }, perScene: 2, maxWords: 2 })
  assert.equal(p.segments.length, 1)
  assert.equal(p.segments[0].words.length, 4)
  assert.equal(p.segments[0].words[1].br, true) // depois de "mundo." (ponto) quebra
  assert.equal(p.segments[0].words[2].br, false)
  assert.equal(p.segments[0].words[3].br, true) // 2 palavras na linha: quebra por max-words
})
