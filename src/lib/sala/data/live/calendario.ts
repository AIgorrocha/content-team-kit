// Calendário no provedor live (Tarefa A3): agendado/publicado vêm de ct_content_items;
// planejado vem de um parser best-effort de content/{cliente}/planejamento/*.md (tabela
// semanal em texto livre, formato "| Dia dd/mes hora | Plataforma | Formato | Tema | Hook |
// Status |"). Sem schema formal pra planejamento: heurística, não fonte de verdade.
import { readdirSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { type ItemCalendario, type Rede, type TipoPeca } from "@/lib/sala/types"
import { ROOT, lerArquivo } from "@/lib/sala/fontes"
import { query } from "@/lib/db"
import { normalizarSlug } from "./pecas"

// Caminho literal (ver pecas.ts, mesmo motivo: webpack não empacota require com caminho
// montado por expressão). post-key.cjs é o dono único da normalização de URL de post.
const requireCjs = createRequire(import.meta.url)
const postKeyLib = requireCjs("../../../../../skills/_shared/post-key.cjs") as {
  postKey: (urlOrId: string | null) => string | null
}

interface LinhaConteudo {
  id: string
  title: string
  content_type: string
  platform: string
  publish_url: string | null
  scheduled_at: string | null
  published_at: string | null
  metadata: Record<string, unknown> | null
}

// Origem de uma publicacao no calendario (Batelada B6): "sala" quando foi a propria Sala
// que publicou (linha em ct_content_items), "api" quando veio do sync com a rede e "manual"
// quando alguem publicou por fora e so registrou a mao. Campo NOVO, ainda fora do contrato
// ItemCalendario em src/lib/sala/types.ts (fora do escopo desta batelada mexer nesse arquivo;
// ver relatorio-B6.md pra pedido de acrescentar ao contrato oficial).
export interface ItemCalendarioComOrigem extends ItemCalendario {
  origem?: "sala" | "api" | "manual"
}

interface LinhaPublicacao {
  id: string
  rede: string
  tipo: string
  url: string | null
  publicado_em: string | null
  origem: string | null
  titulo: string | null
}

const CONTENT_TYPE_TIPO: Partial<Record<string, TipoPeca>> = { reel: "reel", story: "story", short: "youtube_longo" }

// ponytail: mapeamento aproximado (o contrato TipoPeca não tem um tipo genérico de
// "post"/"vídeo"). Serve só pra rotular o card do calendário, não muda nenhuma regra de etapa.
// Exportado (Tarefa B3): `reprogramar` em live/escrita-editorial.ts reusa a mesma função pra
// montar o ItemCalendario devolvido, em vez de duplicar o mapeamento.
export function mapearTipoPeca(contentType: string, platform: string): TipoPeca {
  if (platform === "youtube") return "youtube_longo"
  if (platform === "linkedin") return "post_linkedin"
  return CONTENT_TYPE_TIPO[contentType] ?? "reel"
}

// pg devolve Date pro tipo timestamp/date, não string (LinhaConteudo/LinhaPublicacao tipam
// como string por conveniência). Normaliza pra ISO explicitamente: sem isso, chaveDedupCalendario
// (Batelada B9) quebra ao chamar .slice numa Date, e itens de fontes diferentes (banco vs
// planejamento em disco, que já monta string "AAAA-MM-DD") comparariam formatos diferentes.
function paraIso(valor: unknown, fallback: string): string {
  if (!valor) return fallback
  if (typeof valor === "string") return valor
  const data = new Date(valor as string | number | Date)
  return Number.isNaN(data.getTime()) ? fallback : data.toISOString()
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

function lerPlanejadosDoDisco(cliente: string, inicio: string, fim: string): ItemCalendario[] {
  const dir = join(ROOT, "content", cliente, "planejamento")
  if (!existsSync(dir)) return []
  const itens: ItemCalendario[] = []

  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = lerArquivo(`content/${cliente}/planejamento/${arquivo}`) ?? ""
    const anoMatch = raw.match(/de (\d{4})/)
    const ano = anoMatch ? Number(anoMatch[1]) : new Date(inicio).getFullYear()
    let contador = 0

    for (const linha of raw.split(/\r?\n/)) {
      const m = linha.match(/^\|\s*\S+\s+(\d{1,2})\/([a-zç]{3,4})[^|]*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/i)
      if (!m) continue
      const mesChave = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 3)
      const mes = MESES[mesChave]
      if (!mes) continue
      const dia = m[1].padStart(2, "0")
      const data = `${ano}-${String(mes).padStart(2, "0")}-${dia}`
      if (data < inicio || data > fim) continue

      contador++
      const tema = m[4]?.trim() || m[3]?.trim() || "Planejado"
      itens.push({
        id: `planejado:${arquivo}:${contador}`,
        peca: normalizarSlug(tema),
        titulo: tema,
        tipo: "reel",
        rede: null,
        estado: "planejado",
        data,
        url: null,
      })
    }
  }
  return itens
}

// Publicacoes sincronizadas das redes (Tarefa da Batelada B6): scripts/sala/sync-publicacoes.mjs
// grava em ct_publications, com origem "api" (veio do coletor) ou "manual" (registrada a mao).
// Dedup contra ct_content_items acontece depois, em deduplicarItens (Batelada B9): a mesma
// peça pode chegar com URLs de formato diferente (youtu.be/x4poY8b9gy4 x
// youtube.com/watch?v=x4poY8b9gy4), então comparar string de URL crua não bastava.
async function lerPublicacoesSincronizadas(
  cliente: string, inicio: string, fim: string
): Promise<ItemCalendarioComOrigem[]> {
  const linhas = await query<LinhaPublicacao>(
    `select id, rede, tipo, url, publicado_em, origem, titulo
     from ct_publications
     where client_slug = $1 and url is not null
       and publicado_em is not null
       and publicado_em::date between $2::date and $3::date`,
    [cliente, inicio, fim]
  )

  return linhas.map((row) => ({
      id: `publicacao:${row.id}`,
      peca: normalizarSlug(row.titulo ?? row.url ?? ""),
      titulo: row.titulo ?? row.url ?? "Publicacao sem titulo",
      tipo: mapearTipoPeca(row.tipo, row.rede),
      rede: row.rede as Rede,
      estado: "publicado",
      data: paraIso(row.publicado_em, ""),
      url: row.url,
      origem: (row.origem as "sala" | "api" | "manual" | null) ?? "api",
    }))
}

// Chave de deduplicação (Batelada B9, causa raiz 3): mesmo post pode chegar duas vezes, uma
// de ct_content_items (o que a Sala publicou) e outra de ct_publications (sincronizado da
// rede), com URLs de formato diferente pro mesmo vídeo. Critério 1: postKey normalizado (dono
// único da regra em skills/_shared/post-key.cjs). Critério 2, quando não há URL joinable dos
// dois lados: mesmo título normalizado + mesma rede + mesmo dia.
function chaveDedupCalendario(item: ItemCalendarioComOrigem): string {
  const porUrl = item.url ? postKeyLib.postKey(item.url) : null
  if (porUrl) return `url:${porUrl}`
  const dia = (item.data ?? "").slice(0, 10)
  return `titulo:${normalizarSlug(item.titulo ?? "")}|${item.rede ?? ""}|${dia}`
}

// Mantém a primeira ocorrência de cada chave. A ordem de entrada (ct_content_items antes de
// ct_publications antes do planejamento) já favorece a fonte mais confiável: quem tem etapa
// registrada na Sala.
function deduplicarItens(itens: ItemCalendarioComOrigem[]): ItemCalendarioComOrigem[] {
  const vistos = new Set<string>()
  const resultado: ItemCalendarioComOrigem[] = []
  for (const item of itens) {
    const chave = chaveDedupCalendario(item)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    resultado.push(item)
  }
  return resultado
}

export async function lerCalendarioLive(cliente: string, inicio: string, fim: string): Promise<ItemCalendario[]> {
  const linhas = await query<LinhaConteudo>(
    `select id, title, content_type, platform, publish_url, scheduled_at, published_at, metadata
     from ct_content_items
     where client_slug = $1
       and (
         (scheduled_at is not null and scheduled_at::date between $2::date and $3::date)
         or (published_at is not null and published_at::date between $2::date and $3::date)
       )`,
    [cliente, inicio, fim]
  )

  const doBanco: ItemCalendarioComOrigem[] = linhas.map((row) => {
    const meta = row.metadata ?? {}
    const slugBase = (meta.piece_slug ?? meta.slug) as string | undefined
    return {
      id: row.id,
      peca: normalizarSlug(slugBase ?? row.title ?? ""),
      titulo: row.title,
      tipo: mapearTipoPeca(row.content_type, row.platform),
      rede: (row.platform as Rede) ?? null,
      estado: row.published_at ? "publicado" : "agendado",
      data: paraIso(row.published_at ?? row.scheduled_at, inicio),
      url: row.publish_url,
      origem: "sala",
    }
  })

  const daSincronizacao = await lerPublicacoesSincronizadas(cliente, inicio, fim)

  return deduplicarItens([...doBanco, ...daSincronizacao, ...lerPlanejadosDoDisco(cliente, inicio, fim)])
}
