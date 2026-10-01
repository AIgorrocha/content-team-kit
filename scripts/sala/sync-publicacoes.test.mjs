import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizarInstagram,
  normalizarYoutube,
  normalizarLinkedin,
  normalizarTiktokSnapshot,
  ambienteDoCliente,
  coletarInstagram,
  validarCliente,
} from "./sync-publicacoes.mjs"

test("sincronização rejeita cliente inexistente e travessia", () => {
  for (const slug of ["../fora", "cliente-inexistente-fixture", "a/b", "", null]) {
    assert.throws(() => validarCliente(slug), /Cliente inexistente ou inválido/)
  }
})

test("Instagram direto usa me sem user id e confina a paginação", async () => {
  const chamadas = []
  const resultado = await coletarInstagram({
    env: { INSTAGRAM_ACCESS_TOKEN: "IGAA-fixture" }, clientSlug: "cliente-a", desde: new Date(0),
    fetchImpl: async (url, init) => {
      chamadas.push({ url, init })
      return { ok: true, json: async () => ({ data: [{ permalink: "https://instagram.com/p/fixture" }], paging: { next: "https://fora.example/media" } }) }
    },
  })
  assert.equal(chamadas.length, 1)
  assert.ok(chamadas[0].url.startsWith("https://graph.instagram.com/me/media?"))
  assert.ok(!chamadas[0].url.includes("IGAA-fixture"))
  assert.equal(chamadas[0].init.headers.Authorization, "Bearer IGAA-fixture")
  assert.equal(resultado.itens.length, 1)
  assert.match(resultado.aviso, /paginação inválida/)
})

test("credenciais legadas só ficam disponíveis para o cliente vinculado", () => {
  const env = { SALA_LEGACY_TOKEN_CLIENT: "cliente-a", INSTAGRAM_ACCESS_TOKEN: "fixture", LINKEDIN_ACCESS_TOKEN: "fixture", YOUTUBE_REFRESH_TOKEN: "fixture", YOUTUBE_CLIENT_ID: "app" }
  assert.equal(ambienteDoCliente(env, "cliente-a").INSTAGRAM_ACCESS_TOKEN, "fixture")
  const outro = ambienteDoCliente(env, "cliente-b")
  assert.equal(outro.INSTAGRAM_ACCESS_TOKEN, undefined)
  assert.equal(outro.LINKEDIN_ACCESS_TOKEN, undefined)
  assert.equal(outro.YOUTUBE_REFRESH_TOKEN, undefined)
  assert.equal(env.INSTAGRAM_ACCESS_TOKEN, "fixture")
})

// Fixtures inline, formato real das APIs (sem rede). Cobrem a Tarefa da Batelada B6:
// normalizacao por rede a partir de um item cru.

test("normalizarInstagram: reel vira tipo reel, com capa e metricas", () => {
  const item = {
    id: "17900000000000000",
    caption: "Como usar 3 IAs juntas na empresa #ia #produtividade",
    media_type: "VIDEO",
    media_product_type: "REELS",
    timestamp: "2026-09-04T13:00:00+0000",
    permalink: "https://www.instagram.com/reel/Cxxxxx/",
    thumbnail_url: "https://scontent.cdninstagram.com/thumb.jpg",
    media_url: "https://scontent.cdninstagram.com/video.mp4",
    like_count: 120,
    comments_count: 8,
  }
  const linha = normalizarInstagram(item, "acme")
  assert.deepEqual(linha, {
    client_slug: "acme",
    rede: "instagram",
    tipo: "reel",
    url: "https://www.instagram.com/reel/Cxxxxx/",
    publicado_em: "2026-09-04T13:00:00+0000",
    origem: "api",
    titulo: "Como usar 3 IAs juntas na empresa #ia #produtividade",
    capa_url: "https://scontent.cdninstagram.com/thumb.jpg",
    metricas: { like_count: 120, comments_count: 8 },
  })
})

test("normalizarInstagram: post de feed (sem media_product_type conhecido) vira tipo feed", () => {
  const item = {
    id: "1",
    media_type: "CAROUSEL_ALBUM",
    timestamp: "2026-09-01T10:00:00+0000",
    permalink: "https://www.instagram.com/p/Cyyyyy/",
    like_count: 0,
    comments_count: 0,
  }
  const linha = normalizarInstagram(item, "acme")
  assert.equal(linha.tipo, "feed")
  assert.equal(linha.titulo, null)
  assert.equal(linha.capa_url, null)
})

test("normalizarInstagram: story vira tipo story", () => {
  const item = {
    id: "2",
    media_product_type: "STORY",
    timestamp: "2026-09-10T09:00:00+0000",
    permalink: "https://www.instagram.com/stories/highlights/2/",
  }
  assert.equal(normalizarInstagram(item, "acme").tipo, "story")
})

test("normalizarYoutube: video curto (<=180s) vira short com URL /shorts/", () => {
  const item = {
    id: "x4poY8b9gy4",
    snippet: {
      title: "Como Usar 3 IAs Juntas na Empresa",
      publishedAt: "2026-09-04T10:00:00Z",
      thumbnails: { high: { url: "https://i.ytimg.com/vi/x4poY8b9gy4/hq.jpg" } },
    },
    contentDetails: { duration: "PT45S" },
    statistics: { viewCount: "1500", likeCount: "80", commentCount: "12" },
  }
  const linha = normalizarYoutube(item, "acme")
  assert.equal(linha.tipo, "short")
  assert.equal(linha.url, "https://www.youtube.com/shorts/x4poY8b9gy4")
  assert.equal(linha.titulo, "Como Usar 3 IAs Juntas na Empresa")
  assert.deepEqual(linha.metricas, { views: 1500, likes: 80, comments: 12 })
})

test("normalizarYoutube: video longo (>180s) vira video com URL watch", () => {
  const item = {
    id: "abc123",
    snippet: { title: "Video longo", publishedAt: "2026-09-04T10:00:00Z", thumbnails: {} },
    contentDetails: { duration: "PT12M30S" },
    statistics: {},
  }
  const linha = normalizarYoutube(item, "acme")
  assert.equal(linha.tipo, "video")
  assert.equal(linha.url, "https://www.youtube.com/watch?v=abc123")
  assert.deepEqual(linha.metricas, { views: 0, likes: 0, comments: 0 })
})

test("normalizarLinkedin: post vira tipo post com URL de feed/update", () => {
  const item = {
    id: "urn:li:share:7123456789",
    commentary: "Atualizei o contrato depois da reuniao.",
    createdAt: 1757000000000,
  }
  const linha = normalizarLinkedin(item, "acme")
  assert.equal(linha.tipo, "post")
  assert.equal(linha.url, "https://www.linkedin.com/feed/update/urn:li:share:7123456789")
  assert.equal(linha.titulo, "Atualizei o contrato depois da reuniao.")
  assert.equal(linha.publicado_em, new Date(1757000000000).toISOString())
})

test("normalizarTiktokSnapshot: linha de ct_metrics_snapshots vira publicacao tiktok", () => {
  const row = {
    client_slug: "acme",
    post_url: "https://www.tiktok.com/@marca.exemplo/video/123",
    post_type: "video",
    published_at: "2026-09-02T08:00:00Z",
    views: 3000,
    likes: 200,
    comments: 15,
    shares: 5,
    metrics: { cover_url: "https://p16.tiktokcdn.com/cover.jpg" },
  }
  const linha = normalizarTiktokSnapshot(row)
  assert.equal(linha.rede, "tiktok")
  assert.equal(linha.tipo, "video")
  assert.equal(linha.titulo, "TikTok video")
  assert.equal(linha.capa_url, "https://p16.tiktokcdn.com/cover.jpg")
  assert.deepEqual(linha.metricas, { views: 3000, likes: 200, comments: 15, shares: 5 })
})

test("normalizadores nunca incluem token: nenhuma saida carrega a palavra access_token", () => {
  const linhas = [
    normalizarInstagram({ id: "1", permalink: "https://x", timestamp: "2026-09-01T00:00:00Z" }, "c"),
    normalizarYoutube({ id: "1", snippet: {}, contentDetails: {}, statistics: {} }, "c"),
    normalizarLinkedin({ id: "urn:li:share:1", createdAt: 1 }, "c"),
    normalizarTiktokSnapshot({ client_slug: "c", post_url: "https://x" }),
  ]
  for (const l of linhas) assert.equal(JSON.stringify(l).includes("access_token"), false)
})
