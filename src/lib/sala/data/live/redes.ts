// Resumo por rede no provedor live (Tarefa A3): ct_content_items (últimos posts) + métricas
// de ct_metrics_snapshots (via post-key.cjs) + melhor horário de ct_social_insights (kind
// best_time) + automação de comentário de scripts/ig-webhook/rules.json.
import { createRequire } from "node:module"
import { type Publicacao, type Rede, type ResumoRede } from "@/lib/sala/types"
import { existe, lerArquivo } from "@/lib/sala/fontes"
import { urlAsset } from "@/lib/sala/fontes/pecas-disco"
import { query, queryOne } from "@/lib/db"
import { normalizarSlug } from "./pecas"
import { contaLocalDaRede, lerConexoesLive } from "./conexoes"

// Caminho literal: ver comentário equivalente em live/pecas.ts (webpack precisa de string
// literal pra empacotar o require, não uma expressão como join(ROOT, ...)).
const requireCjs = createRequire(import.meta.url)
const postKeyLib = requireCjs("../../../../../skills/_shared/post-key.cjs") as {
  postKey: (urlOrId: string | null) => string | null
  indexByKey: <T>(rows: T[], urlOf?: (r: T) => string | null) => Map<string, T>
  lookup: <T>(index: Map<string, T>, key: string | null) => T | null
}

const REDES_SUPORTADAS: Rede[] = ["instagram", "linkedin", "youtube", "tiktok", "x", "meta_ads", "email"]
// ct_content_items.platform não tem "meta_ads" (é investimento, não conteúdo publicado).
const PLATAFORMAS_CONTEUDO: Rede[] = ["instagram", "linkedin", "youtube", "tiktok", "x"]

interface LinhaConteudo {
  id: string
  title: string
  publish_url: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

interface LinhaMetrica {
  post_url: string | null
  views: number | null
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
}

interface RegraComentario { id: string; keyword: string; link: string }

function lerRegrasComentario(): RegraComentario[] {
  const raw = lerArquivo("scripts/ig-webhook/rules.json")
  if (!raw) return []
  try {
    return JSON.parse(raw) as RegraComentario[]
  } catch {
    return []
  }
}

interface PayloadBestTime {
  best_slots?: Array<{ hour: number; weekday: string; confidence?: string }>
}

async function lerMelhorHorario(cliente: string, rede: Rede): Promise<string | null> {
  const linha = await queryOne<{ payload: PayloadBestTime }>(
    "select payload from ct_social_insights where client_slug = $1 and platform = $2 and kind = 'best_time' order by computed_at desc limit 1",
    [cliente, rede]
  )
  const slot = linha?.payload?.best_slots?.[0]
  if (!slot) return null
  return `${slot.weekday} ${slot.hour}h`
}

async function contarHandleDaConta(cliente: string, rede: Rede): Promise<string | null> {
  // ponytail: sem tabela de "conta conectada" com handle ainda (isso é Fase 3/D1). Só o
  // TikTok expõe o @handle na própria URL publicada; nas demais fica null por enquanto.
  if (rede !== "tiktok") return null
  const linha = await queryOne<{ publish_url: string }>(
    "select publish_url from ct_content_items where client_slug = $1 and platform = $2 and publish_url is not null order by created_at desc limit 1",
    [cliente, rede]
  )
  const m = linha?.publish_url.match(/tiktok\.com\/(@[^/]+)/)
  return m?.[1] ?? null
}

export async function lerRedesLive(cliente: string): Promise<ResumoRede[]> {
  const regras = process.env.SALA_LEGACY_TOKEN_CLIENT === cliente ? lerRegrasComentario() : []
  const rulesInstagram = regras.map((r) => ({ palavra: r.keyword, link: r.link }))
  const conexoes = await lerConexoesLive(cliente)

  return Promise.all(
    REDES_SUPORTADAS.map(async (rede): Promise<ResumoRede> => {
      if (!PLATAFORMAS_CONTEUDO.includes(rede)) {
        return { rede, conta: contaLocalDaRede(cliente, rede), estadoConta: "desligada", ultimosPosts: [], melhorHorario: null, automacao: { tipo: "nenhuma", regras: [] } }
      }

      const [linhas, metricas, melhorHorario, conta] = await Promise.all([
        query<LinhaConteudo>(
          `select * from (
             select id::text, title, publish_url, coalesce(published_at, created_at) as created_at, metadata
             from ct_content_items where client_slug = $1 and platform = $2 and publish_url is not null
             union all
             select id::text, coalesce(titulo, 'Publicação sem título') as title, url as publish_url,
                    publicado_em as created_at, '{}'::jsonb as metadata
             from ct_publications where client_slug = $1 and rede = $2 and url is not null and publicado_em is not null
           ) publicados order by created_at desc limit 24`,
          [cliente, rede]
        ),
        query<LinhaMetrica>(
          "select post_url, views, likes, comments, saves, shares from ct_metrics_snapshots where client_slug = $1 and platform = $2 order by snapshot_date desc",
          [cliente, rede]
        ),
        lerMelhorHorario(cliente, rede),
        contarHandleDaConta(cliente, rede),
      ])

      const indiceMetricas = postKeyLib.indexByKey(metricas)
      const vistos = new Set<string>()
      const ultimosPosts = linhas
        .filter((l) => {
          const chave = postKeyLib.postKey(l.publish_url) ?? l.publish_url
          if (!chave || vistos.has(chave)) return false
          vistos.add(chave)
          return true
        })
        .slice(0, 8)
        .map((l) => {
          const chave = postKeyLib.postKey(l.publish_url)
          const snap = chave ? postKeyLib.lookup(indiceMetricas, chave) : null
          const metricasPost: Publicacao["metricas"] | undefined = snap
            ? { views: snap.views ?? undefined, likes: snap.likes ?? undefined, comentarios: snap.comments ?? undefined, salvos: snap.saves ?? undefined, compartilhamentos: snap.shares ?? undefined }
            : undefined
          const slugBase = ((l.metadata?.piece_slug ?? l.metadata?.slug) as string | undefined) ?? l.title
          return {
            peca: normalizarSlug(slugBase ?? ""),
            titulo: l.title,
            url: l.publish_url,
            publicadoEm: new Date(l.created_at).toISOString(),
            capaUrl: capaLocal(cliente, normalizarSlug(slugBase ?? "")),
            metricas: metricasPost,
          }
        })

      const conexao = conexoes.find((c) => c.id === rede)
      const estadoConta = conexao?.status === "ok" ? "ok" : linhas.length === 0 && !conexao?.conta ? "desligada" : "atencao"
      const automacao: ResumoRede["automacao"] =
        rede === "instagram" && rulesInstagram.length > 0
          ? { tipo: "ig_webhook", regras: rulesInstagram }
          : rede === "youtube" && rulesInstagram.length > 0
            // YouTube reaproveita as mesmas palavras-chave (rules.json tem `ytReply` por regra),
            // mas os vídeos monitorados vivem só no servidor da instalação (nunca no ambiente local).
            ? { tipo: "yt_responder", regras: rulesInstagram, videosMonitorados: [] }
            : { tipo: "nenhuma", regras: [] }

      return {
        rede,
        conta: conexao?.conta ?? contaLocalDaRede(cliente, rede) ?? conta,
        estadoConta,
        ultimosPosts,
        melhorHorario,
        automacao,
      }
    })
  )
}

function capaLocal(cliente: string, slug: string): string | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  for (const pasta of ["reels", "carrosseis", "linkedin", "youtube", "stories"]) {
    for (const nome of ["capa.jpg", "capa.png", "capa-final.jpg", "capa-final.png"]) {
      const caminho = `content/${cliente}/${pasta}/${slug}/${nome}`
      if (existe(caminho)) return urlAsset(caminho)
    }
  }
  return null
}
