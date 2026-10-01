// Varredura de content/{cliente}/{formato}/{peca}/ em Peca[], compartilhada pelo mock (so
// pra prova, o mock continua usando as pecas do seed.json pra ficar estavel) e pelo provedor
// live (Tarefa A3, que junta isto com ct_piece_stages/ct_piece_revisions/ct_content_items).
// Artefato por NOME FIXO (ver mapa em classificarArtefato); texto de .txt/.md carregado em
// `texto`; `url` e `/api/sala/asset/<id>` (Tarefa B3), id = sha1 do caminho relativo (ver
// `caminhoParaAssetId`/`resolverAsset` abaixo, usados pela rota `src/app/api/sala/asset/[id]`).
// criadoEm/atualizadoEm vem do mtime/birthtime do sistema de arquivos.
import { createHash } from "node:crypto"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { type Artefato, type Peca, type Revisao, type TipoPeca } from "@/lib/sala/types"
import { ROOT, lerArquivo } from "./arquivos"

// sha1 do caminho relativo (a partir de ROOT, barras normais): identidade estável do
// arquivo pra rota de assets. Não precisa ser criptograficamente forte, só evitar colisão.
export function caminhoParaAssetId(caminhoRelativo: string): string {
  return createHash("sha1").update(caminhoRelativo).digest("hex")
}

export function urlAsset(caminhoRelativo: string): string {
  return `/api/sala/asset/${caminhoParaAssetId(caminhoRelativo)}`
}

// Mapa id -> caminho absoluto, refeito por varredura completa de content/{cliente} a cada
// 30s (cache). ponytail: varre tudo de novo a cada expiração em vez de invalidar por evento
// (o vigia da Tarefa B1 já observa outras pastas); upgrade se o volume de arquivos crescer
// muito e a varredura ficar cara.
let cacheAssets: { cliente: string; expiraEm: number; porId: Map<string, string> } | null = null

function varrerArvore(raiz: string, porId: Map<string, string>): void {
  if (!existsSync(raiz)) return
  const pilha = [raiz]
  while (pilha.length > 0) {
    const dir = pilha.pop()!
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      // Não seguir symlink ou junction: a rota só serve arquivos que pertencem à raiz.
      if (entrada.isSymbolicLink()) continue
      const absoluto = join(dir, entrada.name)
      if (entrada.isDirectory()) {
        pilha.push(absoluto)
        continue
      }
      if (entrada.isFile()) {
        const relativo = relative(ROOT, absoluto).split(sep).join("/")
        porId.set(caminhoParaAssetId(relativo), absoluto)
      }
    }
  }
}

function varrerAssetsDoCliente(cliente: string): Map<string, string> {
  const porId = new Map<string, string>()
  varrerArvore(join(ROOT, "content", cliente), porId)
  varrerArvore(join(ROOT, "public", "sala-mock"), porId)
  return porId
}

// Resolve um id de asset pro caminho absoluto do arquivo, confinado a content/{cliente}.
// Devolve null se o id não existe (a rota responde 404 sem revelar caminho nenhum).
export function resolverAsset(cliente: string, id: string): string | null {
  const agora = Date.now()
  if (!cacheAssets || cacheAssets.cliente !== cliente || cacheAssets.expiraEm < agora) {
    cacheAssets = { cliente, expiraEm: agora + 30_000, porId: varrerAssetsDoCliente(cliente) }
  }
  return cacheAssets.porId.get(id) ?? null
}

const FORMATO_TIPO: Record<string, TipoPeca> = {
  reels: "reel",
  carousels: "carrossel",
  stories: "story",
  posts: "post_linkedin",
  youtube: "youtube_longo",
}

type ArtefatoSemId = Omit<Artefato, "id">

// Identidade estável por nome de arquivo, não por posição na varredura do diretório:
// readdirSync não garante ordem alfabética, então um contador incremental reatribuiria os
// ids existentes sempre que um arquivo novo entrasse "antes" de outro na varredura.
function idArtefato(slug: string, nomeArquivo: string): string {
  const identidade = createHash("sha1").update(nomeArquivo).digest("hex")
  return `${slug}-art-${identidade}`
}

// Texto (.txt/.md) sempre carregado em `texto`; nome do arquivo comparado em minusculas pra
// cobrir as variantes com MAIUSCULA que existem em pecas antigas (LEGENDA-INSTAGRAM.txt,
// ROTEIRO.md).
const TEXTO_ARQUIVOS: Record<string, Artefato["tipo"]> = {
  "legenda-instagram.txt": "legenda_ig",
  "legenda-tiktok.txt": "legenda_tiktok",
  "youtube-shorts.txt": "shorts",
  "post-linkedin.txt": "post_linkedin",
  "roteiro.md": "roteiro",
  "titulo.txt": "titulo",
  "descricao.txt": "descricao",
  "tags.txt": "tags",
}

function classificarArtefato(nomeArquivo: string, caminhoRelativo: string): ArtefatoSemId | null {
  const nome = nomeArquivo.toLowerCase()
  const tipoTexto = TEXTO_ARQUIVOS[nome]
  if (tipoTexto) {
    return { tipo: tipoTexto, nome: nomeArquivo, url: urlAsset(caminhoRelativo), texto: lerArquivo(caminhoRelativo) }
  }
  if (/^capa(-final)?\.(jpe?g|png)$/.test(nome)) return { tipo: "capa", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/^slide-\d+\.(png|jpe?g|gif)$/.test(nome)) return { tipo: "slide", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/^story-\d+\.(png|jpe?g)$/.test(nome)) return { tipo: "story", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/^thumbnail\.(png|jpe?g)$/.test(nome)) return { tipo: "thumbnail", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/^fluxograma\.(png|jpe?g)$/.test(nome)) return { tipo: "fluxograma", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/^clip-.*\.mp4$/.test(nome)) return { tipo: "clip", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  if (/\.mp4$/.test(nome)) return { tipo: "video", nome: nomeArquivo, url: urlAsset(caminhoRelativo) }
  return null
}

// generate-capa.js registra ajuste em comentario "// vN (data): o que mudou" (ver
// content/{cliente}/reels/{peca}/generate-capa.js). Sem esse comentario
// (a maioria das pecas nao tem generate-capa.js, ou tem sem historico de versao comentado),
// uma unica revisao r1 na data de criacao da pasta.
const MESES_BR: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 }

function dataRevisaoIso(data: string, fallback: string): string {
  const match = /^(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})$/i.exec(data.trim())
  if (!match) return fallback
  return new Date(Date.UTC(Number(match[3]), MESES_BR[match[2].toLowerCase()], Number(match[1]), 12)).toISOString()
}

function extrairRevisoes(generateCapaJs: string | null, criadaPor: string, criadoEm: string, artefatoIds: string[]): Revisao[] {
  const revisaoInicial: Revisao = { id: "r1", numero: 1, criadaEm: criadoEm, criadaPor, artefatoIds, oQueMudou: "criação inicial", aprovadaEm: null }
  if (!generateCapaJs) return [revisaoInicial]

  const matches = Array.from(generateCapaJs.matchAll(/\/\/\s*v(\d+)\s*\(([^)]+)\):\s*([^\n]*)/g))
  if (matches.length === 0) return [revisaoInicial]

  const revisoes: Revisao[] = matches.some((m) => m[1] === "1") ? [] : [revisaoInicial]
  for (const m of matches) {
    revisoes.push({
      id: `r${m[1]}`,
      numero: Number(m[1]),
        criadaEm: dataRevisaoIso(m[2], criadoEm),
      criadaPor,
      artefatoIds,
      oQueMudou: m[3].trim(),
      aprovadaEm: null,
    })
  }
  return revisoes.sort((a, b) => a.numero - b.numero)
}

// Exportada (Batelada B9): reaproveitada por src/lib/sala/data/live/pecas.ts pra montar a
// peça sintética de linha do banco sem pasta em disco (ver comentário em lerPecasLive).
export function pecaBase(slug: string, tipo: TipoPeca, cliente: string, artefatos: Artefato[], revisoes: Revisao[], pecaMae: string | null, criadoEm: string, atualizadoEm: string): Peca {
  return {
    slug,
    titulo: slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    tipo,
    cliente,
    redes: [],
    etapaAtual: 1,
    statusEtapa: "pendente",
    etapas: [],
    donoEtapa: "",
    diasParado: 0,
    capaUrl: artefatos.find((a) => a.tipo === "capa")?.url ?? null,
    artefatos,
    revisoes,
    pecaMae,
    publicacoes: [],
    pendenciasHumanas: [],
    criadoEm,
    atualizadoEm,
  }
}

export function lerPecasDoDisco(cliente: string): Peca[] {
  const pecas: Peca[] = []

  for (const [pasta, tipo] of Object.entries(FORMATO_TIPO)) {
    const dirFormato = join(ROOT, "content", cliente, pasta)
    if (!existsSync(dirFormato)) continue

    const slugs = readdirSync(dirFormato, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()

    for (const slug of slugs) {
      const dirPeca = join(dirFormato, slug)
      const nomesArquivos = readdirSync(dirPeca, { withFileTypes: true })
        .filter((f) => f.isFile())
        .map((f) => f.name)

      const artefatos: Artefato[] = []
      for (const nomeArquivo of nomesArquivos) {
        const relativo = `content/${cliente}/${pasta}/${slug}/${nomeArquivo}`
        const artefato = classificarArtefato(nomeArquivo, relativo)
        if (!artefato) continue
        artefatos.push({ id: idArtefato(slug, relativo), ...artefato })
      }

      // Poster de vídeo/clip: usa a capa da mesma pasta, quando existir.
      const capa = artefatos.find((a) => a.tipo === "capa")
      if (capa) {
        for (const a of artefatos) {
          if (a.tipo === "video" || a.tipo === "clip") a.poster = capa.url
        }
      }

      const stats = statSync(dirPeca)
      const criadoEm = stats.birthtime.toISOString()
      const atualizadoEm = stats.mtime.toISOString()
      const generateCapaJs = lerArquivo(`content/${cliente}/${pasta}/${slug}/generate-capa.js`)
      const revisoes = extrairRevisoes(generateCapaJs, cliente, criadoEm, artefatos.map((a) => a.id))
      // Filhos criados pela Sala carregam a identidade no README. Assim uma pasta de
      // recorte em youtube não perde o tipo nem a rede quando o provedor é recarregado.
      const readme = lerArquivo(`content/${cliente}/${pasta}/${slug}/README.md`) ?? ""
      const tipoCriado = readme.match(/^Tipo:\s*([^\r\n]+)$/mi)?.[1]?.trim() as TipoPeca | undefined
      const redeCriada = readme.match(/^Rede:\s*([^\r\n]+)$/mi)?.[1]?.trim()
      const maeCriada = readme.match(/^Mãe:\s*([^\r\n]+)$/mi)?.[1]?.trim() ?? null
      const tipoDaPeca = tipoCriado && Object.values(FORMATO_TIPO).includes(tipoCriado) || tipoCriado === "recorte" || tipoCriado === "reel_faceless" || tipoCriado === "capa" || tipoCriado === "email" ? tipoCriado : tipo
      const peca = pecaBase(slug, tipoDaPeca as TipoPeca, cliente, artefatos, revisoes, maeCriada, criadoEm, atualizadoEm)
      if (redeCriada && redeCriada !== "(nenhuma)") peca.redes = [redeCriada as Peca["redes"][number]]

      pecas.push(peca)

      // clip-NN-*.mp4 dentro de um reel: peca filha tipo "recorte" apontando pra mae (trilha).
      if (tipo === "reel") {
        const clips = nomesArquivos.filter((n) => /^clip-\d+.*\.mp4$/i.test(n)).sort()
        for (const clip of clips) {
          const relativo = `content/${cliente}/${pasta}/${slug}/${clip}`
          const clipStats = statSync(join(dirPeca, clip))
          const clipSlug = `${slug}--${clip.replace(/\.mp4$/i, "")}`
          const artefatoClip: Artefato = { id: `${clipSlug}-art-01`, tipo: "clip", nome: clip, url: urlAsset(relativo), poster: capa?.url ?? null }
          pecas.push(pecaBase(
            clipSlug, "recorte", cliente, [artefatoClip],
            [{ id: "r1", numero: 1, criadaEm: clipStats.birthtime.toISOString(), criadaPor: cliente, artefatoIds: [artefatoClip.id], oQueMudou: "criação inicial", aprovadaEm: null }],
            slug, clipStats.birthtime.toISOString(), clipStats.mtime.toISOString(),
          ))
        }
      }
    }
  }

  return agruparPecasPorSlug(pecas)
}

export function agruparPecasPorSlug(pecas: Peca[]): Peca[] {
  // O contrato e as rotas identificam a peça por slug, mesmo quando os formatos
  // ficam em pastas diferentes. Reúne os artefatos sem duplicar o cartão.
  const unicas = new Map<string, Peca>()
  for (const peca of pecas) {
    const anterior = unicas.get(peca.slug)
    if (!anterior) {
      unicas.set(peca.slug, peca)
      continue
    }
    const artefatos = [...anterior.artefatos, ...peca.artefatos]
    const revisoes = new Map(anterior.revisoes.map((revisao) => [revisao.numero, revisao]))
    for (const revisao of peca.revisoes) {
      const existente = revisoes.get(revisao.numero)
      revisoes.set(revisao.numero, existente ? {
        ...existente,
        artefatoIds: Array.from(new Set([...existente.artefatoIds, ...revisao.artefatoIds])),
      } : revisao)
    }
    unicas.set(peca.slug, {
      ...anterior,
      tipo: peca.tipo === "youtube_longo" ? peca.tipo : anterior.tipo,
      artefatos,
      revisoes: Array.from(revisoes.values()).sort((a, b) => a.numero - b.numero),
      redes: Array.from(new Set([...anterior.redes, ...peca.redes])),
      capaUrl: anterior.capaUrl ?? peca.capaUrl,
      criadoEm: anterior.criadoEm < peca.criadoEm ? anterior.criadoEm : peca.criadoEm,
      atualizadoEm: anterior.atualizadoEm > peca.atualizadoEm ? anterior.atualizadoEm : peca.atualizadoEm,
    })
  }
  return Array.from(unicas.values())
}
