// scripts/publishing/_lib/register.mjs
// Fonte UNICA do registro de peca publicada em ct_content_items.
// Todo publisher (reusavel ou oneoff) chama isto DEPOIS de publicar. Nao montar INSERT a mao.
//
// Motivo: em ago/2026 so uma fracao pequena dos posts medidos de cada cliente tinham
// peca registrada. A publicacao era feita por dezenas de scripts oneoff, cada um decidindo
// sozinho se gravava, com que URL e com que campos. O que nao entra aqui fica fora do join
// de desempenho, logo fora do aprendizado dos agentes: o cockpit nunca ve aquela peca.
//
// Porta bloqueante: URL que nao vira chave canonica (ex: instagram.com/p/<id de midia>)
// e recusada na hora, nao depois. Regra de normalizacao mora em skills/_shared/post-key.cjs.

import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { resolveClient } from "../../_lib/workspace-client.mjs"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const { postKey, isJoinable } = require(path.join(here, "../../../skills/_shared/post-key.cjs"))
const { loadEnv } = require(path.join(here, "../../../skills/_shared/metrics-writer.cjs"))

const TABLE = "ct_content_items"

/** Recusa URL que nunca casaria com metrica. Chamar antes de gravar qualquer lugar. */
export function assertJoinableUrl(url, platform) {
  if (!url) throw new Error(`register: publish_url vazia (${platform}). Sem URL a peca fica fora do join de desempenho.`)
  if (isJoinable(url)) return postKey(url)
  const k = postKey(url)
  if (k && k.startsWith("igmedia:")) {
    throw new Error(
      `register: ABORT url-de-media-id: "${url}". Isso e o id da Graph API, nao o permalink. ` +
      `Pegue o campo \`permalink\` da midia (GET /{media-id}?fields=permalink) e grave ele.`
    )
  }
  // Blog, site proprio e afins nao tem metrica social: registra sem join, mas avisa alto.
  console.warn(`[register] AVISO: "${url}" nao vira chave de join (${platform}). A peca fica registrada e SEM desempenho medido.`)
  return null
}

/**
 * Upsert da peca publicada. Idempotente por publish_url: republicar o mesmo link atualiza.
 * Campos minimos: client_slug, platform, content_type, title, url.
 *
 * `media_urls`: array de URL publica, NA ORDEM em que a midia saiu no post. Passe sempre que
 * a peca tiver imagem ou video. Antes de passar, confira por md5 que a URL serve o arquivo
 * que voce publicou de fato: deduzir a URL pelo nome ja apontou para a versao velha de um
 * card (ago/2026) e teria colado a metrica na peca errada.
 * Existe desde 29/ago/2026; antes disso cada publisher fazia um PATCH manual depois.
 */
export async function registerPublication({
  client_slug, platform, content_type, title, url,
  source_agent = null, caption = null, hashtags = null, media_urls = null,
  published_at = new Date().toISOString(), source_url = null, metadata = {},
}) {
  if (!client_slug || !platform || !content_type || !title) {
    throw new Error("register: client_slug, platform, content_type e title sao obrigatorios")
  }
  if (media_urls != null && !Array.isArray(media_urls)) {
    throw new Error("register: media_urls deve ser array de URL, na ORDEM em que a midia foi publicada")
  }
  assertJoinableUrl(url, platform)
  loadEnv()
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error("register: SUPABASE_URL/SERVICE_ROLE_KEY ausentes")
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  const row = {
    client_slug, platform, content_type, title, publish_url: url,
    status: "published", approval_status: "approved",
    published_at, source_agent, caption, hashtags, source_url, metadata,
  }
  // Ordem importa: e a ordem em que a midia saiu no post. Nao reordenar.
  if (media_urls != null) row.media_urls = media_urls

  const found = await fetch(
    `${base}/rest/v1/${TABLE}?select=id&publish_url=eq.${encodeURIComponent(url)}&limit=1`, { headers: H }
  ).then((r) => r.json())

  const [method, q] = found?.[0]
    ? ["PATCH", `${TABLE}?id=eq.${found[0].id}`]
    : ["POST", TABLE]
  const res = await fetch(`${base}/rest/v1/${q}`, {
    method, headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`register: ${res.status} ${(await res.text()).slice(0, 300)}`)
  const [saved] = await res.json()
  console.log(`[register] ${method === "POST" ? "criada" : "atualizada"} peca ${saved.id} (${platform}) -> ${url}`)
  return saved
}

/** Marca ativa (CT_CLIENT ou .workspace) ou null. Publicador usa quando nao vem --client. */
export function activeClientOrNull() {
  try { return resolveClient() } catch { return null }
}

/**
 * Igual a registerPublication, mas NUNCA derruba o publicador: a peca ja esta no ar quando
 * isto roda. Sem banco configurado (ou qualquer erro), avisa alto e diz como registrar depois.
 * Devolve a linha gravada ou null.
 */
export async function registerPublicationSafe(args) {
  try {
    return await registerPublication({ ...args, client_slug: args.client_slug || activeClientOrNull() })
  } catch (e) {
    console.warn(`[register] AVISO: a peca foi publicada, mas NAO foi registrada: ${e.message}`)
    console.warn("[register] Sem registro a peca fica fora do painel e das metricas. Depois, rode:")
    console.warn(`  node scripts/publishing/register-publication.mjs --platform ${args.platform} --type ${args.content_type} --title "${args.title}" --url "${args.url}"`)
    return null
  }
}
