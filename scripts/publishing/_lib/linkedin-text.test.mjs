// node --test scripts/publishing/_lib/linkedin-text.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { assertHashtagPolicy, assertHashtagsPreserved, escapeLittleText, extractHashtags } from "./linkedin-text.mjs"

test("padrao do kit: hashtag no LinkedIn derruba a publicacao", () => {
  assert.throws(() => assertHashtagPolicy("Post com #ia no fim"), /hashtag-fora-do-padrao/)
  assert.deepEqual(assertHashtagPolicy("Post limpo, Rank #4 e C# nao contam"), [])
  assert.deepEqual(assertHashtagPolicy("Link https://site.com/p#secao no texto"), [])
})

test("marca que libera hashtag passa com allow e a hashtag tem que sobreviver no payload", () => {
  assert.deepEqual(assertHashtagPolicy("Post #ia #dados", { allow: true }), ["#ia", "#dados"])
  assert.doesNotThrow(() => assertHashtagsPreserved("Post #ia", "Post #ia"))
  assert.throws(() => assertHashtagsPreserved("Post #ia", "Post"), /hashtags-caem/)
})

test("escape Little Text nao mexe em # nem @", () => {
  assert.equal(escapeLittleText("a (b) #c @d"), "a \\(b\\) #c @d")
  assert.deepEqual(extractHashtags("x #um #dois"), ["#um", "#dois"])
})
