// Escrita editorial do provedor live. O arquivo continua sendo a fonte da peça;
// o banco guarda o estado de aprovação, índice e a tarefa para o cron local.
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import {
  type Aprovacao,
  type Artefato,
  type ItemCalendario,
  type Peca,
  type Rede,
  type TipoPeca,
  FUSO,
} from "@/lib/sala/types"
import { ROOT } from "@/lib/sala/fontes"
import { query, transaction } from "@/lib/db"
import { lerPecasLive, normalizarSlug } from "./pecas"
import { mapearTipoPeca } from "./calendario"
import { lerConfiguracaoLive } from "./configuracao"

const REDES: readonly Rede[] = ["instagram", "linkedin", "youtube", "tiktok", "x", "meta_ads", "email"]
const TIPOS: readonly TipoPeca[] = ["reel", "reel_faceless", "carrossel", "story", "post_linkedin", "youtube_longo", "recorte", "capa", "email"]
// Permite um único separador "--" (peça filha "recorte" de clip, ver pecas-disco.ts
// `clipSlug`), sem abrir para hifens triplos nem segmentos vazios.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/
const PASTA_POR_TIPO: Partial<Record<TipoPeca, string>> = {
  recorte: "reels", reel: "reels", reel_faceless: "reels", carrossel: "carousels",
  story: "stories", post_linkedin: "posts", youtube_longo: "youtube",
}

class ErroEditorial extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) { super(message) }
}

export function mensagemEditorialSegura(error: unknown): { mensagem: string; status: number } {
  if (error instanceof ErroEditorial) return { mensagem: error.message, status: error.status }
  // O provedor mock conserva os erros de domínio da Fase 1. Traduz apenas os
  // casos conhecidos para mensagens fixas, sem devolver detalhes internos.
  if (error instanceof Error) {
    if (error.message.includes("não pode ser reprogramado")) return { mensagem: "item não pode ser reprogramado", status: 400 }
    if (/não encontrad[ao]/.test(error.message)) return { mensagem: "registro não encontrado", status: 404 }
    if (error.message.includes("não tem a etapa")) return { mensagem: "peça não tem a etapa solicitada", status: 400 }
  }
  return { mensagem: "não foi possível concluir a operação", status: 500 }
}

function validarSlug(slug: string, campo = "slug"): void {
  if (!SLUG.test(slug)) throw new ErroEditorial(`${campo} inválido`)
}

export function validarAprovacao(aprovacao: Aprovacao): void {
  if (!Number.isInteger(aprovacao.etapa) || aprovacao.etapa < 1 || aprovacao.etapa > 8) throw new ErroEditorial("etapa inválida")
  if (typeof aprovacao.revisaoId !== "string" || !aprovacao.revisaoId || aprovacao.revisaoId.length > 200) throw new ErroEditorial("revisão inválida")
  if (aprovacao.acao !== "aprovar" && aprovacao.acao !== "ajuste") throw new ErroEditorial("ação inválida")
  if (aprovacao.rede !== null && aprovacao.rede !== undefined && !REDES.includes(aprovacao.rede)) throw new ErroEditorial("rede inválida")
  if ([3, 4, 7].includes(aprovacao.etapa) && !aprovacao.rede) throw new ErroEditorial("campo obrigatório: rede")
  if (aprovacao.acao === "ajuste" && !aprovacao.motivo?.trim()) throw new ErroEditorial("motivo obrigatório para pedir ajuste")
}

export function validarFilho(tipo: TipoPeca, rede: Rede | null): void {
  if (!TIPOS.includes(tipo) || !PASTA_POR_TIPO[tipo]) throw new ErroEditorial("tipo de peça inválido")
  if (rede !== null && !REDES.includes(rede)) throw new ErroEditorial("rede inválida")
}

function validarNovaData(novaData: string): void {
  const data = /^(\d{4})-(\d{2})-(\d{2})/.exec(novaData)
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(novaData)
  const instante = somenteData ? Date.parse(`${novaData}T12:00:00Z`) : Date.parse(novaData)
  const calendarioValido = !!data && (() => {
    const valor = new Date(Date.UTC(Number(data[1]), Number(data[2]) - 1, Number(data[3])))
    return valor.getUTCFullYear() === Number(data[1]) && valor.getUTCMonth() === Number(data[2]) - 1 && valor.getUTCDate() === Number(data[3])
  })()
  if (!calendarioValido || Number.isNaN(instante)) {
    throw new ErroEditorial("data inválida")
  }
}

async function pecaOuFalha(cliente: string, slug: string): Promise<Peca> {
  validarSlug(slug)
  const { pecas } = await lerPecasLive(cliente, new Date().toISOString())
  const peca = pecas.find((item) => item.slug === slug)
  if (!peca) throw new ErroEditorial("peça não encontrada", 404)
  return peca
}

interface LinhaRevisaoId { id: string; numero: number }
interface Executor { query: typeof query }

async function garantirRevisoesNoBanco(executor: Executor, cliente: string, peca: Peca, dono: string): Promise<LinhaRevisaoId[]> {
  const existentes = await executor.query<LinhaRevisaoId>(
    "select id, numero from ct_piece_revisions where client_slug = $1 and piece_slug = $2 order by numero", [cliente, peca.slug]
  )
  const numerosExistentes = new Set(existentes.map((linha) => linha.numero))
  const faltantes = peca.revisoes.filter((revisao) => !numerosExistentes.has(revisao.numero))
  if (faltantes.length === 0) return existentes
  const inseridas: LinhaRevisaoId[] = []
  for (const revisao of faltantes) {
    const arquivos = revisao.artefatoIds.map((id) => peca.artefatos.find((artefato) => artefato.id === id))
      .filter((artefato): artefato is Artefato => !!artefato)
      .map((artefato) => ({ id: artefato.id, nome: artefato.nome, url: artefato.url }))
    const linha = await executor.query<LinhaRevisaoId>(
      `insert into ct_piece_revisions (client_slug, piece_slug, numero, artefatos, criada_em, criada_por)
       values ($1, $2, $3, $4::jsonb, $5, $6) returning id, numero`,
      [cliente, peca.slug, revisao.numero, JSON.stringify({ ids: revisao.artefatoIds, arquivos }), revisao.criadaEm, dono]
    )
    if (linha[0]) inseridas.push(linha[0])
  }
  return [...existentes, ...inseridas]
}

export async function aprovarLive(cliente: string, slug: string, aprovacao: Aprovacao): Promise<Peca> {
  validarSlug(cliente, "cliente")
  validarSlug(slug)
  validarAprovacao(aprovacao)
  const peca = await pecaOuFalha(cliente, slug)
  const revisaoAlvo = peca.revisoes.find((revisao) => revisao.id === aprovacao.revisaoId)
  if (!revisaoAlvo) throw new ErroEditorial("revisão não encontrada na peça", 404)
  const dono = (await lerConfiguracaoLive(cliente)).kit.dono.toLowerCase()
  const redeEtapa = [3, 4, 7].includes(aprovacao.etapa) ? aprovacao.rede ?? null : null

  await transaction(async (executor) => {
    // O índice único legado não inclui cliente. Esta trava e guarda mantêm o registro de
    // outro cliente intocado até que uma migration aditiva possa corrigir o índice.
    await executor.query("select pg_advisory_xact_lock(hashtext($1))", [`${cliente}:${slug}:revisoes`])
    await executor.query("select pg_advisory_xact_lock(hashtext($1))", [`${slug}:${aprovacao.etapa}:${redeEtapa ?? ""}`])
    const estagio = await executor.query<{ id: string; client_slug: string }>(
      "select id, client_slug from ct_piece_stages where piece_slug = $1 and stage = $2 and coalesce(rede, '') = $3 for update",
      [slug, aprovacao.etapa, redeEtapa ?? ""]
    )
    if (estagio[0] && estagio[0].client_slug !== cliente) throw new ErroEditorial("etapa indisponível", 409)
    const revisoes = await garantirRevisoesNoBanco(executor, cliente, peca, dono)
    const alvo = revisoes.find((revisao) => revisao.numero === revisaoAlvo.numero)
    if (!alvo) throw new ErroEditorial("revisão não encontrada no banco", 404)
    const status = aprovacao.acao === "aprovar" ? "aprovado" : "ajuste"
    const aprovadoEm = aprovacao.acao === "aprovar" ? new Date().toISOString() : null
    const aprovadoPor = aprovacao.acao === "aprovar" ? dono : null
    const motivoAjuste = aprovacao.acao === "ajuste" ? aprovacao.motivo?.trim() ?? null : null
    if (estagio[0]) {
      await executor.query(
        "update ct_piece_stages set status=$1, revisao_id=$2, aprovado_em=$3, aprovado_por=$4, motivo_ajuste=$5, updated_at=now() where id=$6",
        [status, alvo.id, aprovadoEm, aprovadoPor, motivoAjuste, estagio[0].id]
      )
    } else {
      await executor.query(
        `insert into ct_piece_stages (client_slug,piece_slug,parent_slug,piece_type,stage,status,rede,revisao_id,aprovado_em,aprovado_por,motivo_ajuste,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
        [cliente, slug, peca.pecaMae ?? null, peca.tipo, aprovacao.etapa, status, redeEtapa, alvo.id, aprovadoEm, aprovadoPor, motivoAjuste]
      )
    }
    if (aprovacao.acao === "ajuste") {
      const maior = revisoes.reduce((maximo, revisao) => Math.max(maximo, revisao.numero), 0)
      await executor.query("insert into ct_piece_revisions (client_slug,piece_slug,numero,artefatos,criada_por) values ($1,$2,$3,$4::jsonb,$5)",
        [cliente, slug, maior + 1, JSON.stringify({ motivo: aprovacao.motivo?.trim() }), dono])
    }
    await executor.query("insert into ct_audit_log (agent,action,target_type,details) values ('sala',$1,'piece_stage',$2::jsonb)",
      [aprovacao.acao, JSON.stringify({ piece_slug: slug, etapa: aprovacao.etapa, rede: aprovacao.rede ?? null, revisaoId: aprovacao.revisaoId })])
  })
  return pecaOuFalha(cliente, slug)
}

function caminhoFilhoConfinado(cliente: string, pasta: string, slug: string): string {
  const content = resolve(ROOT, "content")
  if (lstatSync(content).isSymbolicLink()) throw new ErroEditorial("destino inválido")
  const contentReal = realpathSync(content)
  const raiz = resolve(content, cliente)
  const formato = resolve(raiz, pasta)
  const destino = resolve(formato, slug)
  if (!destino.startsWith(`${raiz}${sep}`) || relative(raiz, destino).startsWith("..")) throw new ErroEditorial("destino inválido")

  // Examina cada ancestral que já existe antes de criar qualquer pasta. `realpath`
  // bloqueia junction/symlink que aponta para fora de content, inclusive em `cliente`.
  for (const ancestral of [raiz, formato]) {
    if (!existsSync(ancestral)) break
    const estado = lstatSync(ancestral)
    const real = realpathSync(ancestral)
    if (estado.isSymbolicLink() || !(real === contentReal || real.startsWith(`${contentReal}${sep}`))) {
      throw new ErroEditorial("destino inválido")
    }
  }
  if (!existsSync(raiz)) mkdirSync(raiz, { recursive: true })
  const raizReal = realpathSync(raiz)
  if (!(raizReal === contentReal || raizReal.startsWith(`${contentReal}${sep}`))) throw new ErroEditorial("destino inválido")
  if (!existsSync(formato)) mkdirSync(formato, { recursive: false })
  const formatoReal = realpathSync(formato)
  if (!formatoReal.startsWith(`${raizReal}${sep}`)) throw new ErroEditorial("destino inválido")
  return destino
}

export async function criarFilhoLive(cliente: string, slugMae: string, tipo: TipoPeca, rede: Rede | null): Promise<Peca> {
  validarSlug(cliente, "cliente")
  validarSlug(slugMae, "slug da peça mãe")
  validarFilho(tipo, rede)
  const mae = await pecaOuFalha(cliente, slugMae)
  // Só o segmento de tipo vira hífen: "post_linkedin"/"youtube_longo"/"reel_faceless" têm
  // underscore no enum TipoPeca, mas o slug de pasta não aceita esse caractere.
  const segmentoTipo = tipo.replace(/_/g, "-")
  const slug = `${slugMae}-${segmentoTipo}${rede ? `-${rede}` : ""}`
  validarSlug(slug)
  const destino = caminhoFilhoConfinado(cliente, PASTA_POR_TIPO[tipo]!, slug)
  if (existsSync(destino)) throw new ErroEditorial("peça já existe", 409)
  let criada = false
  try {
    mkdirSync(destino, { recursive: false })
    criada = true
    writeFileSync(join(destino, "README.md"), [`# ${slug}`, "", `Mãe: ${slugMae}`, `Tipo: ${tipo}`, `Rede: ${rede ?? "(nenhuma)"}`, `Criado em: ${new Date().toISOString()}`, ""].join("\n"), "utf8")
    await transaction(async (executor) => {
      await executor.query("select pg_advisory_xact_lock(hashtext($1))", [`${slug}:1:`])
      const existente = await executor.query<{ client_slug: string }>("select client_slug from ct_piece_stages where piece_slug=$1 and stage=1 and coalesce(rede,'')=$2 for update", [slug, ""])
      if (existente[0] && existente[0].client_slug !== cliente) throw new ErroEditorial("etapa indisponível", 409)
      if (existente[0]) throw new ErroEditorial("peça já existe", 409)
      await executor.query("insert into ct_piece_stages (client_slug,piece_slug,parent_slug,piece_type,stage,status,rede) values ($1,$2,$3,$4,1,'pendente',null)", [cliente, slug, slugMae, tipo])
      await executor.query("insert into ct_audit_log (agent,action,target_type,details) values ('sala','criar_filho','piece',$1::jsonb)", [JSON.stringify({ piece_slug: slug, parent_slug: slugMae, tipo, rede, mae_titulo: mae.titulo })])
    })
  } catch (error) {
    if (criada && existsSync(destino)) rmSync(destino, { recursive: true, force: true })
    throw error
  }
  return pecaOuFalha(cliente, slug)
}

function preservarHoraSaoPaulo(novaData: string, dataAtualIso: string): string {
  if (novaData.length > 10) return new Date(novaData).toISOString()
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(dataAtualIso))
  const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? "00"
  return `${novaData}T${parte("hour")}:${parte("minute")}:${parte("second")}-03:00`
}

interface LinhaContentItem { id: string; title: string; content_type: string; platform: string; publish_url: string | null; scheduled_at: string | null; published_at: string | null; status: string; metadata: Record<string, unknown> | null }

export async function reprogramarLive(cliente: string, id: string, novaData: string): Promise<ItemCalendario> {
  validarSlug(cliente, "cliente")
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroEditorial("item inválido")
  validarNovaData(novaData)
  const atualizado = await transaction(async (executor) => {
    const item = await executor.query<LinhaContentItem>("select id,title,content_type,platform,publish_url,scheduled_at,published_at,status,metadata from ct_content_items where id=$1 and client_slug=$2 for update", [id, cliente])
    if (!item[0]) throw new ErroEditorial("item de calendário não encontrado", 404)
    if (item[0].status !== "scheduled") throw new ErroEditorial("item não pode ser reprogramado")
    const scheduledAt = preservarHoraSaoPaulo(novaData, item[0].scheduled_at ?? new Date().toISOString())
    const rows = await executor.query<LinhaContentItem>("update ct_content_items set scheduled_at=$3::timestamptz,updated_at=now() where id=$1 and client_slug=$2 returning id,title,content_type,platform,publish_url,scheduled_at,published_at,status,metadata", [id, cliente, scheduledAt])
    await executor.query("insert into ct_audit_log (agent,action,target_type,target_id,details) values ('sala','reprogramar','content_item',$1,$2::jsonb)", [id, JSON.stringify({ de: item[0].scheduled_at, para: scheduledAt })])
    const data = new Date(scheduledAt).toLocaleDateString("pt-BR", { timeZone: FUSO })
    await executor.query("insert into ct_tasks (title,assigned_agent,status,created_by,metadata) values ($1,'ct-agenda','pending','sala',$2::jsonb)", [`Reagendar ${rows[0].title} para ${data}`, JSON.stringify({ content_item_id: id, scheduled_at: scheduledAt })])
    return rows[0]
  })
  const meta = atualizado.metadata ?? {}
  return { id: atualizado.id, peca: normalizarSlug((meta.piece_slug ?? meta.slug ?? atualizado.title) as string), titulo: atualizado.title,
    tipo: mapearTipoPeca(atualizado.content_type, atualizado.platform), rede: atualizado.platform as Rede, estado: atualizado.published_at ? "publicado" : "agendado", data: atualizado.published_at ?? atualizado.scheduled_at ?? novaData, url: atualizado.publish_url }
}
