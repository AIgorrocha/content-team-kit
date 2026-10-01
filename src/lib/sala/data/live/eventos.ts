// Eventos ao vivo no provedor live (Tarefa A3, leitura): ct_agent_events (Tarefa A1). A
// ingestão (hook do terminal) é da Tarefa B2; aqui só lemos o que existir e
// assinamos por Realtime com fallback de polling. Tabela pode estar vazia até a B2 rodar: os
// dois métodos abaixo funcionam normalmente com zero linhas.
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"
import { type EventoAoVivo, type EventoTipo, type FamiliaAgente } from "@/lib/sala/types"
import { query } from "@/lib/db"
import { clienteAtivoSlug } from "@/lib/sala/cliente"

interface LinhaEvento {
  id: number
  ts: string
  agent: string | null
  event: string | null
  tool: string | null
  piece_slug: string | null
  payload: Record<string, unknown> | null
  source: string | null
}

const TIPOS_VALIDOS: EventoTipo[] = [
  "pedido", "diretor_planejou", "agente_iniciou", "agente_ferramenta", "agente_concluiu",
  "aprovacao_pedida", "aprovado", "ajuste_pedido", "publicado", "registrado", "erro",
]

// ponytail: sem convenção fixa ainda de `event` -> tipo/caixa (isso nasce na Tarefa B2, no
// hook-forward.mjs). Até lá, aceita tipo/caixa vindos prontos no payload (o jeito que a B2 vai
// gravar) e cai numa heurística por palavra-chave só pra não quebrar a tela com dado antigo.
function inferirTipo(event: string | null): EventoTipo {
  const e = (event ?? "").toLowerCase()
  if (TIPOS_VALIDOS.includes(e as EventoTipo)) return e as EventoTipo
  if (e.includes("prompt") || e.includes("pedido")) return "pedido"
  if (e.includes("subagentstart")) return "agente_iniciou"
  if (e.includes("subagentstop") || e.includes("concluiu")) return "agente_concluiu"
  if (e.includes("posttooluse") || e.includes("ferramenta")) return "agente_ferramenta"
  if (e.includes("stop")) return "registrado"
  if (e.includes("erro") || e.includes("error") || e.includes("failed")) return "erro"
  return "agente_ferramenta"
}

function inferirCaixa(tipo: EventoTipo): EventoAoVivo["caixa"] {
  switch (tipo) {
    case "pedido": return 1
    case "diretor_planejou": return 2
    case "agente_iniciou":
    case "agente_ferramenta": return 3
    case "aprovacao_pedida":
    case "aprovado":
    case "ajuste_pedido": return 4
    case "publicado": return 5
    default: return 6
  }
}

const FAMILIAS_VALIDAS: FamiliaAgente[] = ["claude", "codex", "grok", "kimi"]

function mapearLinha(r: LinhaEvento): EventoAoVivo {
  const payload = r.payload ?? {}
  const tipo = (payload.tipo as EventoTipo | undefined) ?? inferirTipo(r.event)
  const caixa = (payload.caixa as EventoAoVivo["caixa"] | undefined) ?? inferirCaixa(tipo)
  const familiaBruta = payload.familia as string | undefined
  return {
    id: String(r.id),
    ts: new Date(r.ts).toISOString(),
    caixa,
    tipo,
    agente: r.agent ?? (payload.agente as string | undefined) ?? null,
    peca: r.piece_slug ?? (payload.peca as string | undefined) ?? null,
    ferramenta: r.tool ?? (payload.ferramenta as string | undefined) ?? null,
    resumo: (payload.resumo as string | undefined) ?? r.event ?? "",
    origem: r.source === "terminal" ? "terminal" : "site",
    // familia/modelo vem de payload (a Batelada B7 ja grava os dois no ingest, ver
    // src/app/api/sala/eventos/ingest/route.ts); evento antigo sem os campos cai em null
    // e o cartao de Trabalho mostra sem esse detalhe.
    familia: familiaBruta && FAMILIAS_VALIDAS.includes(familiaBruta as FamiliaAgente) ? (familiaBruta as FamiliaAgente) : null,
    modelo: (payload.modelo as string | undefined) ?? null,
  }
}

export async function lerEventosRecentesLive(limite = 50): Promise<EventoAoVivo[]> {
  const cliente = await clienteAtivoSlug()
  const linhas = await query<LinhaEvento>(
    "select id, ts, agent, event, tool, piece_slug, payload, source from ct_agent_events where client_slug = $1 order by ts desc limit $2",
    [cliente, limite]
  )
  return linhas.reverse().map(mapearLinha)
}

// O polling busca novos IDs do cliente. Realtime antecipa essa consulta, mas sua
// indisponibilidade não desliga o polling periódico. O feed não substitui um log
// durável de auditoria: transações longas podem confirmar IDs fora de ordem.
export function assinarEventosLive(): AsyncIterable<EventoAoVivo> {
  return {
    [Symbol.asyncIterator]() {
      const fila: EventoAoVivo[] = []
      let resolvePendente: ((v: IteratorResult<EventoAoVivo>) => void) | null = null
      let fechado = false
      let ultimoId = 0
      let cliente = "generico"
      let emPoll = false
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let canal: RealtimeChannel | null = null
      let client: SupabaseClient | null = null

      const emitir = (evento: EventoAoVivo) => {
        if (resolvePendente) {
          const r = resolvePendente
          resolvePendente = null
          r({ value: evento, done: false })
        } else {
          fila.push(evento)
        }
      }

      async function poll() {
        if (emPoll || fechado) return
        emPoll = true
        try {
          const linhas = await query<LinhaEvento>(
            "select id, ts, agent, event, tool, piece_slug, payload, source from ct_agent_events where client_slug = $1 and id > $2 order by id asc limit 50",
            [cliente, ultimoId]
          )
          if (fechado) return
          for (const l of linhas) {
            ultimoId = l.id
            emitir(mapearLinha(l))
          }
        } catch {
          // tenta de novo no próximo tick, nunca derruba a assinatura
        } finally {
          emPoll = false
        }
      }

      function iniciarPolling() {
        if (pollTimer) return
        pollTimer = setInterval(poll, 3000)
      }

      async function iniciar() {
        cliente = await clienteAtivoSlug()
        if (fechado) return

        try {
          const recentes = await query<LinhaEvento>(
            "select id, ts, agent, event, tool, piece_slug, payload, source from ct_agent_events where client_slug = $1 order by id desc limit 50",
            [cliente]
          )
          if (fechado) return
          // Reenvia o início do feed: cobre eventos entre a renderização da página
          // e a abertura do SSE. O navegador deduplica os IDs recebidos.
          for (const linha of recentes.reverse()) {
            ultimoId = linha.id
            emitir(mapearLinha(linha))
          }
        } catch {
          ultimoId = 0
        }
        if (fechado) return

        iniciarPolling()

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !chave) return

        try {
          client = createClient(url, chave)
          const canalCriado = client.channel(`sala-agent-events-${cliente}`)
          canalCriado
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "ct_agent_events", filter: `client_slug=eq.${cliente}` },
              () => { void poll() }
            )
            .subscribe()
          if (fechado) {
            client.removeChannel(canalCriado)
            return
          }
          canal = canalCriado
        } catch {
          // sem Realtime: o polling já cobre sozinho.
        }
      }

      const promessaInicial = iniciar()

      return {
        async next(): Promise<IteratorResult<EventoAoVivo>> {
          await promessaInicial
          if (fechado) return { value: undefined, done: true }
          if (fila.length > 0) return { value: fila.shift()!, done: false }
          return new Promise((resolve) => {
            resolvePendente = resolve
          })
        },
        async return(): Promise<IteratorResult<EventoAoVivo>> {
          fechado = true
          if (pollTimer) clearInterval(pollTimer)
          if (canal && client) client.removeChannel(canal)
          if (resolvePendente) {
            const r = resolvePendente
            resolvePendente = null
            r({ value: undefined, done: true })
          }
          return { value: undefined, done: true }
        },
      }
    },
  }
}
