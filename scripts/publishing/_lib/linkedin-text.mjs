// scripts/publishing/_lib/linkedin-text.mjs
// Fonte UNICA de montagem/validacao do texto de post LinkedIn.
// Reusar em TODO publisher LinkedIn (reusavel e oneoff), nao reimplementar a mao.
//
// Motivo: bug recorrente: "so o LinkedIn fica sem as hashtags do fim".
// Duas causas historicas ja vistas:
//   1. Corte por separador: `raw.split(/\n-{3,}\n/)[0]` descarta tudo depois de `---`.
//      Se as hashtags estiverem apos um `---`, somem SILENCIOSAMENTE. (send-side)
//   2. Drop do LinkedIn no ugcPosts quando as hashtags vao como paragrafo final isolado.
//      Nao da pra impedir 100% do lado da API, mas da pra DETECTAR na verificacao pos-publish.
//
// Regra dura: `#` (hashtag) e `@` (mention) NUNCA sao escapados no Little Text.

import { readFileSync } from "node:fs"

// /rest/posts usa "Little Text": estes chars precisam de `\` antes senao o post CORTA.
// NAO inclui `#` nem `@` de proposito.
const LITTLE_TEXT_RE = /([\\(){}\[\]<>*_~|])/g

export function escapeLittleText(s) {
  return s.replace(LITTLE_TEXT_RE, "\\$1")
}

// Extrai os tokens de hashtag (#palavra) do texto, na ordem.
// Exige letra/underscore como 1o char apos `#` -> ignora "Rank #4", "GPT-5.6" etc.
export function extractHashtags(text) {
  return (text.match(/#[\p{L}_][\p{L}\p{N}_]*/gu) || [])
}

// Le o post-linkedin.txt.
// stripAfterSeparator=true remove um bloco "link magnet" apos `---`, MAS aborta
// se isso apagaria hashtags (o bug 1). Default false: manda o arquivo inteiro.
export function readCaption(filePath, { stripAfterSeparator = false } = {}) {
  const raw = readFileSync(filePath, "utf8").trim()
  if (!stripAfterSeparator) return raw
  const parts = raw.split(/\n-{3,}\n/)
  if (parts.length === 1) return raw
  const head = parts[0].trim()
  const tail = parts.slice(1).join("\n")
  if (extractHashtags(tail).length > 0) {
    throw new Error(
      "readCaption: ha hashtags DEPOIS do separador `---`; recorte apagaria elas. " +
      "Mova as hashtags pro fim do bloco principal ou use stripAfterSeparator=false."
    )
  }
  return head
}

// Padrao do kit: post de LinkedIn sai SEM hashtag. A marca pode liberar no brand-profile
// (clients/{slug}/brand-profile.md); nesse caso quem publica passa --allow-hashtags.
// Sem a liberacao, hashtag no texto derruba a publicacao antes de ir pra API.
export function assertHashtagPolicy(text, { allow = false } = {}) {
  const found = extractHashtags(text)
  if (found.length > 0 && !allow) {
    throw new Error(
      `ABORT hashtag-fora-do-padrao: o texto tem ${found.length} hashtag(s) (${found.join(" ")}). ` +
      "Padrao do kit: LinkedIn sem hashtag. Tire as hashtags, ou, se o brand-profile da marca libera, rode com --allow-hashtags."
    )
  }
  return found
}

// PORTA BLOQUEANTE (send-side): toda hashtag do arquivo-fonte TEM que estar no texto
// que vai no payload. Chamar ANTES de qualquer POST. Lanca com mensagem clara se sumiu.
// Vale pros dois caminhos: ugcPosts (shareCommentary.text) e /rest/posts (commentary escapado,
// onde `#` fica intacto porque nao escapamos hashtag).
export function assertHashtagsPreserved(sourceText, payloadText) {
  const src = extractHashtags(sourceText)
  if (src.length === 0) return { ok: true, hashtags: [] }
  const missing = src.filter((h) => !payloadText.includes(h))
  if (missing.length > 0) {
    throw new Error(
      `ABORT hashtags-caem: o arquivo-fonte tem ${src.length} hashtag(s) mas o payload perdeu ` +
      `${missing.length}: ${missing.join(" ")}. Nunca escapar/cortar hashtag. Corrija a montagem antes de publicar.`
    )
  }
  return { ok: true, hashtags: src }
}

// Verificacao pos-publish (read-back): confirma que as hashtags SOBREVIVERAM no post ao vivo.
// Precisa de token com scope de leitura de /rest/posts. Se der 403 (token so-escrita), retorna
// { checked:false } em vez de falhar - send-side ja garantiu o envio.
export async function verifyHashtagsLive({ urn, token, sourceText, version = "202606" }) {
  const src = extractHashtags(sourceText)
  if (src.length === 0) return { checked: true, ok: true, missing: [] }
  const r = await fetch(`https://api.linkedin.com/rest/posts/${encodeURIComponent(urn)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": version,
    },
  })
  if (r.status !== 200) return { checked: false, status: r.status }
  const j = await r.json().catch(() => ({}))
  const live = j.commentary || ""
  const missing = src.filter((h) => !live.includes(h))
  return { checked: true, ok: missing.length === 0, missing, liveLen: live.length }
}
