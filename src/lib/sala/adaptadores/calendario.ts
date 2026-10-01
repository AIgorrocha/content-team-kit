// Adaptador entre `ItemCalendario` (contrato da Sala, `src/lib/sala/types.ts`) e `ContentItem`
// (contrato do calendário reaproveitado, `src/lib/types.ts`). O `ContentCalendar` só desenha
// item que tem `scheduled_at`: por isso todo item vira `scheduled_at = item.data`,
// independente do estado, inclusive publicado sem hora de agendamento original.
import type { ContentItem, ContentType, Platform } from "@/lib/types"
import type { ItemCalendario, Rede, TipoPeca } from "@/lib/sala/types"
import { DEFAULT_CLIENT_SLUG } from "@/lib/clients"

const TIPO_PARA_CONTENT_TYPE: Record<TipoPeca, ContentType> = {
  reel: "reel",
  reel_faceless: "reel",
  carrossel: "carousel",
  story: "story",
  post_linkedin: "post",
  youtube_longo: "video",
  recorte: "video",
  capa: "post",
  email: "email",
}

const REDE_PARA_PLATFORM: Partial<Record<Rede, Platform>> = {
  instagram: "instagram",
  linkedin: "linkedin",
  youtube: "youtube",
  tiktok: "tiktok",
  x: "x",
  email: "email",
  // meta_ads não é rede de publicação de conteúdo: sem platform correspondente.
}

const ESTADO_PARA_STATUS: Record<ItemCalendario["estado"], ContentItem["status"]> = {
  planejado: "draft",
  agendado: "scheduled",
  publicado: "published",
}

// Reversos, usados só por `contentItemParaItem` (nenhum fluxo real da tela precisa hoje: o
// clique no item busca no array original de `ItemCalendario`, e o PATCH manda só `{id,
// novaData}`). O mapeamento de ida é N:1 (ex.: reel/reel_faceless -> "reel"), então a volta
// só recupera o representante canônico de cada `ContentType`; quando o `ContentItem` carrega
// o `metadata` gravado por `itemParaContentItem` (`peca`/`estadoSala`), usamos ele em vez do
// tipo/status pra não perder informação nesse caminho de ida e volta.
const STATUS_PARA_ESTADO: Record<ContentItem["status"], ItemCalendario["estado"]> = {
  draft: "planejado",
  scheduled: "agendado",
  published: "publicado",
  rejected: "planejado", // ponytail: Sala não tem estado "rejeitado" no calendário
}

const CONTENT_TYPE_PARA_TIPO: Partial<Record<ContentType, TipoPeca>> = {
  reel: "reel",
  carousel: "carrossel",
  story: "story",
  post: "post_linkedin",
  video: "youtube_longo",
  email: "email",
}

export function itemParaContentItem(item: ItemCalendario): ContentItem {
  const metadata: Record<string, string> = {
    peca: item.peca,
    estadoSala: item.estado,
  }
  if (item.origem) metadata.origem = item.origem

  return {
    id: item.id,
    title: item.titulo,
    content_type: TIPO_PARA_CONTENT_TYPE[item.tipo] ?? "post",
    status: ESTADO_PARA_STATUS[item.estado],
    platform: item.rede ? (REDE_PARA_PLATFORM[item.rede] ?? null) : null,
    scheduled_at: item.data,
    published_at: item.estado === "publicado" ? item.data : null,
    publish_url: item.url,
    caption: null,
    hashtags: [],
    script: null,
    visual_notes: null,
    media_urls: [],
    source_url: null,
    source_agent: null,
    approval_status: "approved",
    approval_notes: null,
    engagement: null,
    metadata,
    client_slug: DEFAULT_CLIENT_SLUG,
    created_at: item.data,
    updated_at: item.data,
  }
}

export function itensParaContentItems(itens: ItemCalendario[]): ContentItem[] {
  return itens.map(itemParaContentItem)
}

// Direção inversa (ContentItem -> ItemCalendario). Prioriza o `metadata` gravado por
// `itemParaContentItem` (peça e estado exatos) e só recorre ao `status`/`content_type`
// quando o `ContentItem` não veio daqui (ex.: um mock de teste feito à mão).
export function contentItemParaItem(item: ContentItem): ItemCalendario {
  const meta = (item.metadata ?? {}) as {
    peca?: unknown
    estadoSala?: unknown
    origem?: unknown
  }
  const estadoDoMetadata =
    meta.estadoSala === "planejado" || meta.estadoSala === "agendado" || meta.estadoSala === "publicado"
      ? meta.estadoSala
      : null
  const estado = estadoDoMetadata ?? STATUS_PARA_ESTADO[item.status]
  const data = estado === "publicado" ? (item.published_at ?? item.scheduled_at ?? item.created_at) : (item.scheduled_at ?? item.created_at)

  const origem = meta.origem === "sala" || meta.origem === "api" || meta.origem === "manual"
    ? meta.origem
    : undefined

  return {
    id: item.id,
    peca: typeof meta.peca === "string" ? meta.peca : item.id,
    titulo: item.title,
    tipo: CONTENT_TYPE_PARA_TIPO[item.content_type] ?? "post_linkedin",
    rede: (item.platform as Rede | null) ?? null,
    estado,
    data,
    url: item.publish_url,
    ...(origem ? { origem } : {}),
  }
}
