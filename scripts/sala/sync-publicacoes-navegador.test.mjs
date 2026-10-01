import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Fixtures inline (sem rede) pras funcoes puras de extracao/normalizacao. lerHandle e
// lerAlvoLinkedin leem clients/{slug}/brand-profile.md do diretorio atual: os testes abaixo
// montam uma pasta temporaria com brand-profiles de exemplo (acme e cliente-exemplo).

const pastaTemp = mkdtempSync(join(tmpdir(), "ct-navegador-"))
for (const [slug, texto] of [
  ["acme", "- **TikTok**: https://www.tiktok.com/@sua-marca\n- **LinkedIn**: https://www.linkedin.com/in/cliente-exemplo\n"],
  ["cliente-exemplo", "- **LinkedIn**: https://www.linkedin.com/company/empresa-exemplo\n"],
]) {
  mkdirSync(join(pastaTemp, "clients", slug), { recursive: true })
  writeFileSync(join(pastaTemp, "clients", slug, "brand-profile.md"), texto)
}
process.chdir(pastaTemp)

// Import dinamico: a lista de clientes validos e lida do cwd quando o modulo carrega.
const {
  normalizarLinkedinNavegador,
  normalizarTiktokNavegador,
  normalizarInstagramNavegador,
  lerHandle,
  lerAlvoLinkedin,
  sessaoExpiradaMsg,
} = await import("./sync-publicacoes-navegador.mjs")

const paraISOFixo = () => "2026-09-01T12:00:00Z"

test("normalizarLinkedinNavegador: post com urn real vira url de feed/update, origem manual", () => {
  const post = { urn: "urn:li:activity:7123", text: "Fechei outro contrato hoje.", reactions: 42, comments: 3, reposts: 1, posted_label: "2 d" }
  const linha = normalizarLinkedinNavegador(post, "acme", paraISOFixo)
  assert.deepEqual(linha, {
    client_slug: "acme",
    rede: "linkedin",
    tipo: "post",
    url: "https://www.linkedin.com/feed/update/urn:li:activity:7123",
    publicado_em: "2026-09-01T12:00:00Z",
    origem: "manual",
    titulo: "Fechei outro contrato hoje.",
    capa_url: null,
    metricas: { likes: 42, comments: 3, shares: 1 },
  })
})

test("normalizarLinkedinNavegador: urn sintetico (sem urn real extraido) nao vira url", () => {
  const post = { urn: "synthetic-ClienteExemplo-Fechei_outro", text: "x", reactions: 0, comments: 0, reposts: 0, posted_label: "" }
  const linha = normalizarLinkedinNavegador(post, "acme", paraISOFixo)
  assert.equal(linha.url, null)
})

test("normalizarLinkedinNavegador: usa a primeira midia como capa quando existe", () => {
  const post = { urn: "urn:li:activity:1", text: "", reactions: 1, comments: 0, reposts: 0, posted_label: "", media: [{ type: "image", url: "https://licdn.com/img.jpg" }] }
  const linha = normalizarLinkedinNavegador(post, "acme", paraISOFixo)
  assert.equal(linha.capa_url, "https://licdn.com/img.jpg")
})

test("normalizarTiktokNavegador: video vira tipo video com metricas completas", () => {
  const video = { href: "https://www.tiktok.com/@sua-marca/video/123", caption: "3 IAs juntas", views: 5000, likes: 300, comments: 20, shares: 10, created_at: "2026-09-05T10:00:00.000Z" }
  const linha = normalizarTiktokNavegador(video, "acme")
  assert.deepEqual(linha, {
    client_slug: "acme",
    rede: "tiktok",
    tipo: "video",
    url: "https://www.tiktok.com/@sua-marca/video/123",
    publicado_em: "2026-09-05T10:00:00.000Z",
    origem: "manual",
    titulo: "3 IAs juntas",
    capa_url: null,
    metricas: { views: 5000, likes: 300, comments: 20, shares: 10 },
  })
})

test("normalizarInstagramNavegador: link /reel/ vira tipo reel, /p/ vira feed", () => {
  const reel = normalizarInstagramNavegador("https://www.instagram.com/reel/Cxxxx/", "acme")
  const feed = normalizarInstagramNavegador("https://www.instagram.com/p/Cyyyy/", "acme")
  assert.equal(reel.tipo, "reel")
  assert.equal(feed.tipo, "feed")
  assert.equal(reel.origem, "manual")
})

test("normalizadores nunca incluem token/cookie/senha na saida", () => {
  const linhas = [
    normalizarLinkedinNavegador({ urn: "urn:li:activity:1", posted_label: "" }, "c", paraISOFixo),
    normalizarTiktokNavegador({ href: "https://x" }, "c"),
    normalizarInstagramNavegador("https://instagram.com/p/x/", "c"),
  ]
  for (const l of linhas) {
    const json = JSON.stringify(l).toLowerCase()
    for (const proibido of ["access_token", "cookie", "senha", "password", "li_at"]) {
      assert.equal(json.includes(proibido), false, `nao deve conter "${proibido}"`)
    }
  }
})

test("lerHandle: TikTok do acme vem do brand-profile.md real", () => {
  assert.equal(lerHandle("acme", "tiktok"), "sua-marca")
})

test("lerHandle: cliente sem link de TikTok no brand-profile.md devolve null (empresa sem TikTok)", () => {
  assert.equal(lerHandle("cliente-exemplo", "tiktok"), null)
})

test("lerHandle: cliente inexistente devolve null", () => {
  assert.equal(lerHandle("cliente-que-nao-existe", "tiktok"), null)
  assert.equal(lerHandle("../fora", "tiktok"), null)
  assert.equal(lerAlvoLinkedin("../fora"), null)
})

test("lerAlvoLinkedin: perfil pessoal do acme", () => {
  assert.deepEqual(lerAlvoLinkedin("acme"), { tipo: "personal", handle: "cliente-exemplo" })
})

test("lerAlvoLinkedin: pagina de empresa do cliente-exemplo", () => {
  assert.deepEqual(lerAlvoLinkedin("cliente-exemplo"), { tipo: "company", handle: "empresa-exemplo" })
})

test("sessaoExpiradaMsg: aponta pro login-auto.js da skill certa", () => {
  assert.equal(sessaoExpiradaMsg("linkedin"), "Sessão do linkedin expirou. Rode: node skills/ct-linkedin-analyzer/login-auto.js")
  assert.equal(sessaoExpiradaMsg("tiktok"), "Sessão do tiktok expirou. Rode: node skills/ct-tiktok-analyzer/login-auto.js")
})
