// scripts/publishing/_lib/x-thread.mjs
// Le um item da fila do X (content/{slug}/fila-x/pending/*.md, criado por enqueue-x.mjs) ou um
// thread-twitter.txt solto e devolve a lista de tweets. Puro, sem rede.

export const TWEET_LIMIT = 280

/** Metadados (linhas "chave: valor" antes do "---") e corpo. Sem "---", tudo e corpo. */
export function parseQueueItem(text) {
  const t = String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n")
  const m = t.match(/^([\s\S]*?)\n-{3,}\n([\s\S]*)$/)
  const looksLikeMeta = m && /^[a-z_]+:\s*.*$/m.test(m[1].split("\n")[0])
  if (!looksLikeMeta) return { meta: {}, body: t.trim() }
  const meta = {}
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  return { meta, body: m[2].trim() }
}

/** Cada bloco separado por linha em branco vira um tweet. Erro claro se passar de 280. */
export function toTweets(body) {
  const tweets = String(body).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (!tweets.length) throw new Error("thread vazia")
  const longos = tweets.map((t, i) => ({ n: i + 1, len: [...t].length })).filter((x) => x.len > TWEET_LIMIT)
  if (longos.length) {
    throw new Error(`tweet(s) acima de ${TWEET_LIMIT} caracteres: ${longos.map((x) => `#${x.n} (${x.len})`).join(", ")}. Encurte e rode de novo.`)
  }
  return tweets
}
