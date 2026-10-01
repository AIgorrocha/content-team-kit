// node --test scripts/publishing/_lib/x-thread.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseQueueItem, toTweets } from "./x-thread.mjs"

const item = `slug: minha-peca
platforms: x, threads
status: pending
scheduled_at: now
thread: content/acme/reels/minha-peca/thread-twitter.txt

---

Primeiro tweet 1/2

Segundo tweet 2/2
`

test("item da fila: separa metadados e thread", () => {
  const { meta, body } = parseQueueItem(item)
  assert.equal(meta.slug, "minha-peca")
  assert.equal(meta.status, "pending")
  assert.deepEqual(toTweets(body), ["Primeiro tweet 1/2", "Segundo tweet 2/2"])
})

test("thread-twitter.txt solto (sem metadados) tambem funciona, inclusive com CRLF", () => {
  const { meta, body } = parseQueueItem("Um\r\n\r\nDois\r\n")
  assert.deepEqual(meta, {})
  assert.deepEqual(toTweets(body), ["Um", "Dois"])
})

test("tweet acima de 280 caracteres e thread vazia dao erro claro", () => {
  assert.throws(() => toTweets("a".repeat(281)), /acima de 280.*#1 \(281\)/)
  assert.equal(toTweets("a".repeat(280)).length, 1)
  assert.throws(() => toTweets("  \n\n "), /vazia/)
})
