// Peças no provedor live (Tarefa A3): união das pastas em content/{cliente}/** (fontes/pecas-disco)
// com as publicações reais de ct_content_items (client_slug) e as métricas de
// ct_metrics_snapshots (join por skills/_shared/post-key.cjs). ct_piece_stages/ct_piece_revisions
// (Tarefa A1) ainda estão vazias em produção (só a partir da Batelada B, quando a escrita passa a
// gravar lá); até lá, etapa/status vêm de uma heurística sobre as publicações reais: peça com
// publicação "published" mostra etapa 8 (registrado), com "scheduled" mostra etapa 7, senão fica
// no default de fontes/pecas-disco (etapa 1, pendente). Isso é uma aproximação deliberada: peça
// publicada manualmente antes de existir a Sala aparece "concluída" mesmo sem ter passado pelas
// etapas 2 a 6 aqui dentro.
import { existsSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import {
  type Etapa,
  type EstadoEtapa,
  type Peca,
  type Publicacao,
  type Rede,
  type StatusEtapa,
  type TipoPeca,
} from "@/lib/sala/types"
import { ROOT, lerArquivo, lerPecasDoDisco, pecaBase } from "@/lib/sala/fontes"
import { query } from "@/lib/db"

// Caminho LITERAL (não montado com join/variável): com uma expressão o webpack do Next não
// consegue empacotar o require e falha em runtime ("Critical dependency: the request of a
// dependency is an expression" -> webpackEmptyContext). Com string literal ele empacota o
// .cjs normalmente, então o caminho abaixo tem que acompanhar a posição real deste arquivo.
const requireCjs = createRequire(import.meta.url)
const postKeyLib = requireCjs("../../../../../skills/_shared/post-key.cjs") as {
  postKey: (urlOrId: string | null) => string | null
  indexByKey: <T>(rows: T[], urlOf?: (r: T) => string | null) => Map<string, T>
  lookup: <T>(index: Map<string, T>, key: string | null) => T | null
}

interface LinhaConteudo {
  id: string
  title: string
  content_type: string
  platform: string
  publish_url: string | null
  scheduled_at: string | null
  published_at: string | null
  status: string
  metadata: Record<string, unknown> | null
  source_url: string | null
}

interface LinhaMetrica {
  post_url: string | null
  views: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
}

interface RegraComentario { id: string; keyword: string }

// Dono padrão por tipo de peça: só um palpite razoável de quem toca a etapa atual quando não
// há ct_piece_stages ainda (ver comentário do arquivo). Não é fonte de verdade de atribuição.
const TIPO_DONO: Record<TipoPeca, string> = {
  reel: "ct-video",
  reel_faceless: "ct-video-mpt",
  carrossel: "ct-carrossel",
  story: "ct-story",
  post_linkedin: "ct-redator",
  youtube_longo: "ct-video",
  recorte: "ct-video",
  capa: "ct-designer",
  email: "ct-email",
}

const TIPO_REDE_PADRAO: Partial<Record<TipoPeca, Rede>> = {
  reel: "instagram",
  reel_faceless: "instagram",
  carrossel: "instagram",
  story: "instagram",
  post_linkedin: "linkedin",
  youtube_longo: "youtube",
}

const STATUS_PUBLICACAO: Record<string, Publicacao["status"]> = {
  draft: "rascunho",
  scheduled: "agendado",
  published: "publicado",
  rejected: "falhou",
}

function normalizarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
}

// Bugfix B9 (causa raiz 2): tipo aproximado de uma linha de ct_content_items sem pasta em
// disco, só pra rotular a peça sintética (ver slugSintetico/lerPecasLive). Não é taxonomia
// fina, é o palpite mais próximo dentro do TipoPeca existente.
function tipoDaLinha(item: LinhaConteudo): TipoPeca {
  const ct = item.content_type
  const plataforma = item.platform
  if (ct === "reel") return "reel"
  if (ct === "carousel" || ct === "image" || ct === "image_post") return "carrossel"
  if (ct === "story") return "story"
  if (ct === "short") return "recorte"
  if (plataforma === "youtube" && ct === "video") return "youtube_longo"
  if (plataforma === "linkedin") return "post_linkedin"
  return "reel"
}

// slug sintético pra agrupar linhas do banco sem pasta em disco: usa metadata.piece_slug/slug
// quando existe (mesma convenção de casaComPeca), senão o título normalizado, senão o id.
function slugSintetico(item: LinhaConteudo): string {
  const meta = item.metadata ?? {}
  const metaSlug = (meta.piece_slug ?? meta.slug) as string | undefined
  if (metaSlug) return normalizarSlug(metaSlug)
  const tituloNorm = normalizarSlug(item.title ?? "")
  return tituloNorm || normalizarSlug(item.id)
}

function lerRegrasComentario(): RegraComentario[] {
  const raw = lerArquivo("scripts/ig-webhook/rules.json")
  if (!raw) return []
  try {
    const dados = JSON.parse(raw) as Array<{ id: string; keyword: string }>
    return dados.map((r) => ({ id: r.id, keyword: r.keyword }))
  } catch {
    return []
  }
}

function primeirasLinhasCandidatas(peca: Peca): string[] {
  return peca.artefatos
    .filter((a) => a.tipo === "legenda_ig" || a.tipo === "titulo")
    .map((a) => (a.texto ?? "").split(/\r?\n/).find((l) => l.trim().length > 0)?.trim())
    .filter((l): l is string => !!l)
}

// Heurística de casamento peça <-> publicação, documentada na Tarefa A3:
// (a) metadata.piece_slug ou metadata.slug bate com o slug da pasta
// (b) senão, título normalizado bate com o slug da pasta OU com a 1a linha de
//     legenda-instagram.txt/titulo.txt (também normalizada)
// (c) senão, source_url contém o slug
// Publicação sem casamento continua existindo (aparece em Redes/Calendário via ct_content_items
// direto), só não entra na peça. Peça sem casamento nenhum vira peça sem publicações.
function casaComPeca(item: LinhaConteudo, peca: Peca): boolean {
  const meta = item.metadata ?? {}
  const metaSlug = (meta.piece_slug ?? meta.slug) as string | undefined
  if (metaSlug && normalizarSlug(metaSlug) === peca.slug) return true

  const tituloNorm = normalizarSlug(item.title ?? "")
  if (tituloNorm && tituloNorm === peca.slug) return true
  for (const linha of primeirasLinhasCandidatas(peca)) {
    if (tituloNorm && normalizarSlug(linha) === tituloNorm) return true
  }

  if (item.source_url && item.source_url.includes(peca.slug)) return true
  return false
}

function paraPublicacao(item: LinhaConteudo, indiceMetricas: Map<string, LinhaMetrica>, regras: RegraComentario[]): Publicacao {
  const rede = item.platform as Rede
  const status = STATUS_PUBLICACAO[item.status] ?? "rascunho"
  const chave = postKeyLib.postKey(item.publish_url)
  const snap = chave ? postKeyLib.lookup(indiceMetricas, chave) : null
  const metricas = snap
    ? {
        views: snap.views ?? undefined,
        likes: snap.likes ?? undefined,
        comentarios: snap.comments ?? undefined,
        salvos: snap.saves ?? undefined,
        compartilhamentos: snap.shares ?? undefined,
      }
    : undefined

  const ctaKeyword = (item.metadata as { cta_keyword?: string } | null)?.cta_keyword
  const regra = rede === "instagram" && ctaKeyword ? regras.find((r) => r.id === ctaKeyword) : undefined

  return {
    rede,
    url: item.publish_url,
    publicadoEm: item.published_at ? new Date(item.published_at).toISOString() : null,
    agendadoPara: item.scheduled_at ? new Date(item.scheduled_at).toISOString() : null,
    status,
    metricas,
    automacaoComentario: regra ? { ativa: true, palavra: regra.keyword, cadastrada: true } : undefined,
  }
}

function etapaSintetica(etapa: Etapa, status: StatusEtapa, aprovadoEm: string | null): EstadoEtapa {
  return { etapa, status, rede: null, revisaoId: null, dono: null, aprovadoEm, aprovadoPor: null, motivoAjuste: null }
}

// Estado gravado pela Sala (Tarefa B3: aprovar/pedir ajuste, criarFilho). ct_piece_stages e
// ct_piece_revisions começam vazias por peça (comentário do topo do arquivo) e passam a ter
// linha assim que alguém aprova/ajusta pela tela ou cria uma peça filha.
export interface LinhaEstagio {
  piece_slug: string
  parent_slug: string | null
  stage: number
  status: string
  rede: string | null
  revisao_id: string | null
  aprovado_em: string | null
  aprovado_por: string | null
  motivo_ajuste: string | null
}

export interface LinhaRevisaoBanco {
  id: string
  piece_slug: string
  numero: number
  artefatos: { ids?: string[]; arquivos?: { id: string; nome: string; url: string | null }[]; motivo?: string } | null
  criada_em: string
  criada_por: string | null
}

// Espelha o mesmo conjunto PRONTOS do mock (src/lib/sala/data/mock/index.ts), mas sem forçar
// etapa 8 quando não sobra nenhuma etapa pendente entre as que TÊM registro no banco: uma
// peça com só a etapa 3 aprovada não deveria "pular" pra registrada só por faltar dado nas
// etapas 1, 2, 5, 6 e 8, que aqui ainda não são gravadas uma a uma. Nesse caso cai pro valor
// que a heurística de publicação (ct_content_items) já tinha calculado.
function recalcularEtapaAtualComBanco(
  etapas: EstadoEtapa[],
  etapaAtualPadrao: Etapa,
  statusPadrao: StatusEtapa
): { etapaAtual: Etapa; statusEtapa: StatusEtapa } {
  const PRONTOS = new Set<EstadoEtapa["status"]>(["concluido", "aprovado", "nao_se_aplica"])
  const etapa8 = etapas.filter((e) => e.etapa === 8)
  if (etapa8.length > 0 && etapa8.every((e) => PRONTOS.has(e.status))) {
    return { etapaAtual: 8, statusEtapa: "concluido" }
  }
  let maiorEtapaRegistrada = 0
  for (let n = 1; n <= 8; n++) {
    const doEtapa = etapas.filter((e) => e.etapa === (n as Etapa))
    if (doEtapa.length === 0) continue
    maiorEtapaRegistrada = n
    const pendente = doEtapa.find((e) => !PRONTOS.has(e.status))
    if (pendente) return { etapaAtual: n as Etapa, statusEtapa: pendente.status as StatusEtapa }
  }
  // Toda etapa registrada já está pronta (e não há etapa 8): a peça avança pro próximo
  // estágio real ainda sem registro, em vez de recuar pro default (entrada/pendente).
  if (maiorEtapaRegistrada > 0) {
    const proxima = Math.min(maiorEtapaRegistrada + 1, 8) as Etapa
    return { etapaAtual: proxima, statusEtapa: "pendente" }
  }
  return { etapaAtual: etapaAtualPadrao, statusEtapa: statusPadrao }
}

function enriquecerPeca(
  base: Peca,
  candidatos: LinhaConteudo[],
  indiceMetricas: Map<string, LinhaMetrica>,
  regras: RegraComentario[],
  agora: string,
  stagesBanco: LinhaEstagio[],
  revisoesBanco: LinhaRevisaoBanco[]
): Peca {
  const publicacoes = candidatos.map((item) => paraPublicacao(item, indiceMetricas, regras))
  const redesReais = Array.from(new Set(publicacoes.map((p) => p.rede)))
  const redes = redesReais.length > 0 ? redesReais : base.redes.length > 0 ? base.redes : TIPO_REDE_PADRAO[base.tipo] ? [TIPO_REDE_PADRAO[base.tipo]!] : []

  let etapaAtual = base.etapaAtual
  let statusEtapa = base.statusEtapa
  let etapas = base.etapas
  if (publicacoes.some((p) => p.status === "publicado")) {
    etapaAtual = 8
    statusEtapa = "concluido"
    etapas = [etapaSintetica(8, "concluido", base.atualizadoEm)]
  } else if (publicacoes.some((p) => p.status === "agendado")) {
    etapaAtual = 7
    statusEtapa = "aprovado"
    etapas = [etapaSintetica(7, "aprovado", null)]
  }

  const pendenciasHumanas: string[] = []
  for (const item of candidatos) {
    const pendente = (item.metadata as { pending_manual?: { reason?: string } } | null)?.pending_manual
    if (pendente) pendenciasHumanas.push(`Aguardando publicação manual: ${pendente.reason ?? item.title}`)
    if (item.status === "rejected") pendenciasHumanas.push(`${item.platform}: publicação rejeitada`)
  }

  const diasParado = Math.max(0, Math.floor((new Date(agora).getTime() - new Date(base.atualizadoEm).getTime()) / 86_400_000))

  let revisoes = base.revisoes
  let pecaMae = base.pecaMae

  if (revisoesBanco.length > 0) {
    const doBanco = revisoesBanco.map((row) => {
      const artefatosInfo = row.artefatos ?? {}
      const original = base.revisoes.find((r) => r.numero === row.numero)
      const aprovadaEm =
        stagesBanco
          .filter((s) => s.revisao_id === row.id && s.status === "aprovado" && s.aprovado_em)
          .map((s) => s.aprovado_em as string)
          .sort()
          .at(-1) ?? null
      return {
        id: `r${row.numero}`,
        numero: row.numero,
        criadaEm: new Date(row.criada_em).toISOString(),
        criadaPor: row.criada_por ?? original?.criadaPor ?? "",
        artefatoIds: (artefatosInfo.ids ?? original?.artefatoIds ?? []).map((id) => {
          if (base.artefatos.some((a) => a.id === id)) return id
          // IDs antigos por posição só são convertidos se o snapshot guardar o URL exato.
          const guardado = artefatosInfo.arquivos?.find((a) => a.id === id)
          return guardado?.url ? base.artefatos.find((a) => a.url === guardado.url)?.id : undefined
        }).filter((id): id is string => !!id),
        oQueMudou: artefatosInfo.motivo ? `Ajuste pedido: ${artefatosInfo.motivo}` : original?.oQueMudou ?? "revisão registrada",
        aprovadaEm,
      }
    })
    // Revisão nova no disco (arquivo editado, generate-capa.js com "// vN" inédito) ainda
    // sem linha no banco: o escritor sincroniza no próximo aprovar/ajuste (garantirRevisoesNoBanco),
    // mas até lá ela precisa continuar visível em vez de sumir da lista.
    const numerosNoBanco = new Set(revisoesBanco.map((row) => row.numero))
    const somenteDisco = base.revisoes.filter((r) => !numerosNoBanco.has(r.numero))
    revisoes = [...doBanco, ...somenteDisco].sort((a, b) => a.numero - b.numero)
  }

  if (stagesBanco.length > 0) {
    const revisaoIdParaLabel = new Map(revisoesBanco.map((row) => [row.id, `r${row.numero}`]))
    const novasEtapas = etapas.slice()
    for (const s of stagesBanco) {
      const rede = (s.rede ?? null) as Rede | null
      const estado: EstadoEtapa = {
        etapa: s.stage as Etapa,
        status: s.status as EstadoEtapa["status"],
        rede,
        revisaoId: s.revisao_id ? revisaoIdParaLabel.get(s.revisao_id) ?? null : null,
        dono: null,
        aprovadoEm: s.aprovado_em ? new Date(s.aprovado_em).toISOString() : null,
        aprovadoPor: s.aprovado_por,
        motivoAjuste: s.motivo_ajuste,
      }
      const idx = novasEtapas.findIndex((e) => e.etapa === estado.etapa && e.rede === estado.rede)
      if (idx >= 0) novasEtapas[idx] = estado
      else novasEtapas.push(estado)
    }
    etapas = novasEtapas
    const recalculado = recalcularEtapaAtualComBanco(etapas, etapaAtual, statusEtapa)
    etapaAtual = recalculado.etapaAtual
    statusEtapa = recalculado.statusEtapa

    const parentSlug = stagesBanco.find((s) => s.parent_slug)?.parent_slug ?? null
    if (parentSlug) pecaMae = parentSlug
  }

  return {
    ...base,
    redes,
    publicacoes,
    etapaAtual,
    statusEtapa,
    etapas,
    revisoes,
    pecaMae,
    pendenciasHumanas,
    diasParado,
    donoEtapa: TIPO_DONO[base.tipo] ?? base.donoEtapa,
  }
}

export interface EstatisticaMatchPecas { totalPublicacoes: number; casadas: number; taxa: number }
// pipelineReal (Batelada B4): slugs de peça de TOPO que pertencem ao pipeline real da Sala,
// pra tela Peças mostrar só isso (o resto some do quadro sem sumir do provedor: peca(),
// trilha() e pecaOuFalha() continuam enxergando toda peça, senão aprovar/criar filho de uma
// peça nova, que ainda não tem critério nenhum, quebraria). Critério (Tarefa B4, "o resto não
// aparece"): tem linha em ct_piece_stages (cobre peça criada por criarFilho, que sempre grava
// lá), ou algum ct_content_items casado tem metadata.sala = true, ou tem publicação com status
// "publicado" nos últimos 90 dias.
const JANELA_PIPELINE_DIAS = 90

function metadataMarcaSala(itens: LinhaConteudo[]): boolean {
  return itens.some((item) => {
    const valor = (item.metadata as { sala?: unknown } | null)?.sala
    return valor === true || valor === "true"
  })
}

export interface PecasLive { pecas: Peca[]; estatistica: EstatisticaMatchPecas; pipelineReal: Set<string> }

export async function lerPecasLive(cliente: string, agora: string): Promise<PecasLive> {
  const basePecas = lerPecasDoDisco(cliente)
  const pecasTopo = basePecas.filter((p) => p.pecaMae == null)

  const [itens, metricas, stagesDb, revisoesDb] = await Promise.all([
    query<LinhaConteudo>(
      "select id, title, content_type, platform, publish_url, scheduled_at, published_at, status, metadata, source_url from ct_content_items where client_slug = $1",
      [cliente]
    ),
    query<LinhaMetrica>(
      "select post_url, views, likes, comments, saves, shares from ct_metrics_snapshots where client_slug = $1 order by snapshot_date desc",
      [cliente]
    ),
    query<LinhaEstagio>(
      "select piece_slug, parent_slug, stage, status, rede, revisao_id, aprovado_em, aprovado_por, motivo_ajuste from ct_piece_stages where client_slug = $1",
      [cliente]
    ),
    query<LinhaRevisaoBanco>(
      "select id, piece_slug, numero, artefatos, criada_em, criada_por from ct_piece_revisions where client_slug = $1 order by numero",
      [cliente]
    ),
  ])
  const indiceMetricas = postKeyLib.indexByKey(metricas)
  const regras = process.env.SALA_LEGACY_TOKEN_CLIENT === cliente ? lerRegrasComentario() : []

  const atribuicoes = new Map<string, LinhaConteudo[]>()
  let casadas = 0
  for (const item of itens) {
    const alvo = pecasTopo.find((p) => casaComPeca(item, p))
    if (!alvo) continue
    casadas++
    atribuicoes.set(alvo.slug, [...(atribuicoes.get(alvo.slug) ?? []), item])
  }

  const stagesPorPeca = new Map<string, LinhaEstagio[]>()
  for (const s of stagesDb) stagesPorPeca.set(s.piece_slug, [...(stagesPorPeca.get(s.piece_slug) ?? []), s])
  const revisoesPorPeca = new Map<string, LinhaRevisaoBanco[]>()
  for (const r of revisoesDb) revisoesPorPeca.set(r.piece_slug, [...(revisoesPorPeca.get(r.piece_slug) ?? []), r])

  // Bugfix B9 (causa raiz 2): antes disto, uma peça só existia se tivesse pasta em
  // content/{cliente}/**. Publicação real (ct_content_items) sem pasta correspondente nunca
  // virava peça, então nunca entrava em pipelineReal, mesmo publicada há poucos dias. Aqui,
  // toda linha do banco que não casou com nenhuma peça de disco (loop de atribuições acima)
  // vira peça sintética de topo, com artefatos vazios, quando tem ct_piece_stages, ou
  // metadata.sala, ou publicação "publicado" dentro da janela de 90 dias: mesmo critério do
  // pipelineReal abaixo, só que aplicado ANTES de existir a peça, pra ela poder existir.
  const naoCasados = itens.filter((item) => !pecasTopo.some((p) => casaComPeca(item, p)))
  const gruposSemPasta = new Map<string, LinhaConteudo[]>()
  for (const item of naoCasados) {
    const slug = slugSintetico(item)
    if (pecasTopo.some((p) => p.slug === slug)) continue // colisão de slug: fica só com a peça de disco
    gruposSemPasta.set(slug, [...(gruposSemPasta.get(slug) ?? []), item])
  }

  const limitePipelineSintetico = new Date(new Date(agora).getTime() - JANELA_PIPELINE_DIAS * 86_400_000).toISOString()
  for (const [slug, grupo] of Array.from(gruposSemPasta.entries())) {
    const temEstagio = stagesPorPeca.has(slug)
    const temMetadataSala = metadataMarcaSala(grupo)
    const publicadaRecente = grupo.some(
      (item) => item.status === "published" && !!item.published_at && new Date(item.published_at).toISOString() >= limitePipelineSintetico
    )
    if (!temEstagio && !temMetadataSala && !publicadaRecente) continue

    // pg devolve Date pra coluna timestamp, não string (a interface LinhaConteudo tipa como
    // string por conveniência, ver paraPublicacao acima que já faz o mesmo new Date(...)):
    // normaliza pra ISO explicitamente em vez de comparar/armazenar o valor cru.
    const dataOrdenavel = (item: LinhaConteudo) => new Date(item.published_at ?? item.scheduled_at ?? 0).toISOString()
    const maisRecente = grupo.reduce((a, b) => (dataOrdenavel(a) >= dataOrdenavel(b) ? a : b))
    const maisAntigo = grupo.reduce((a, b) => (dataOrdenavel(a) <= dataOrdenavel(b) ? a : b))
    const criadoEm = maisAntigo.published_at || maisAntigo.scheduled_at ? dataOrdenavel(maisAntigo) : agora
    const atualizadoEm = maisRecente.published_at || maisRecente.scheduled_at ? dataOrdenavel(maisRecente) : agora
    const sintetica = pecaBase(slug, tipoDaLinha(maisRecente), cliente, [], [
      { id: "r1", numero: 1, criadaEm: criadoEm, criadaPor: cliente, artefatoIds: [], oQueMudou: "publicado sem pasta na Sala (registrado direto no banco)", aprovadaEm: null },
    ], null, criadoEm, atualizadoEm)
    sintetica.titulo = maisRecente.title || sintetica.titulo
    basePecas.push(sintetica)
    pecasTopo.push(sintetica)
    atribuicoes.set(slug, grupo)
  }

  const pecas = basePecas.map((base) =>
    enriquecerPeca(
      base,
      base.pecaMae == null ? atribuicoes.get(base.slug) ?? [] : [],
      indiceMetricas,
      regras,
      agora,
      stagesPorPeca.get(base.slug) ?? [],
      revisoesPorPeca.get(base.slug) ?? []
    )
  )

  const limitePipeline = new Date(new Date(agora).getTime() - JANELA_PIPELINE_DIAS * 86_400_000).toISOString()
  const pipelineReal = new Set<string>()
  for (const p of pecas) {
    if (p.pecaMae != null) continue
    const temEstagio = stagesPorPeca.has(p.slug)
    const temMetadataSala = metadataMarcaSala(atribuicoes.get(p.slug) ?? [])
    const publicadaRecente = p.publicacoes.some((pub) => pub.status === "publicado" && !!pub.publicadoEm && pub.publicadoEm >= limitePipeline)
    if (temEstagio || temMetadataSala || publicadaRecente) pipelineReal.add(p.slug)
  }

  return {
    pecas,
    estatistica: { totalPublicacoes: itens.length, casadas, taxa: itens.length > 0 ? casadas / itens.length : 0 },
    pipelineReal,
  }
}

export function existePastaPlanejamento(cliente: string): boolean {
  return existsSync(join(ROOT, "content", cliente, "planejamento"))
}

export function listarArquivosPlanejamento(cliente: string): string[] {
  const dir = join(ROOT, "content", cliente, "planejamento")
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith(".md"))
}

export { normalizarSlug }
