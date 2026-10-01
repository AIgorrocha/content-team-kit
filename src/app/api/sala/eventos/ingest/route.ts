import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { safeEqual } from "@/lib/security/request-guard"
import { validarClienteDisponivel } from "@/lib/sala/cliente"
import type { FamiliaAgente } from "@/lib/sala/types"

// Ingestao de eventos ao vivo pra ct_agent_events (Tarefa B2). Rota EXEMPTA da auth
// Supabase (authCheck): quem chama e o hook do terminal (scripts/sala/hook-forward.mjs),
// autenticado pelo
// header x-sala-token. Precisa estar na allowlist de src/middleware.ts.
interface EventoEntrada {
  ts?: string | null
  client_slug?: string | null
  agent?: string | null
  event: string
  tool?: string | null
  task_id?: string | null
  parent_id?: string | null
  piece_slug?: string | null
  payload?: Record<string, unknown> | null
  source: "site" | "terminal"
  dedupe_key?: string | null
  // Batelada B7: qual CLI/terminal originou o evento e, quando informado, o modelo usado.
  // Sem coluna propria ainda (ver tabela): entra dentro de payload no insert abaixo.
  familia?: FamiliaAgente | null
  modelo?: string | null
}

function valido(e: unknown): e is EventoEntrada {
  if (!e || typeof e !== "object") return false
  const o = e as Record<string, unknown>
  return (
    typeof o.event === "string" &&
    o.event.length > 0 &&
    (o.source === "site" || o.source === "terminal") &&
    clienteSlugValido(o.client_slug)
  )
}

// O token autentica o serviço que encaminha eventos, não limita o serviço a um
// cliente ativo. A lista de clientes cadastrados é a fonte única para impedir
// slugs inexistentes e tentativas de traversal.
function clienteSlugValido(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true
  if (typeof valor !== "string" || valor.length === 0 || valor.trim() !== valor) return false
  try {
    validarClienteDisponivel(valor)
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.SALA_HOOK_TOKEN
  if (!token) {
    return NextResponse.json(
      { erro: "Serviço indisponível: SALA_HOOK_TOKEN não configurado" },
      { status: 503 }
    )
  }
  if (!safeEqual(req.headers.get("x-sala-token"), token)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erro: "Body inválido" }, { status: 400 })
  }

  const eventos = Array.isArray(body) ? body : [body]
  if (
    eventos.some((evento) => {
      if (!evento || typeof evento !== "object") return false
      return !clienteSlugValido((evento as Record<string, unknown>).client_slug)
    })
  ) {
    return NextResponse.json({ erro: "Cliente não cadastrado no workspace" }, { status: 400 })
  }
  let inseridos = 0
  let ignorados = 0

  for (const bruto of eventos) {
    if (!valido(bruto)) {
      ignorados++
      continue
    }
    try {
      const linhas = await query<{ id: number }>(
        `insert into ct_agent_events
           (ts, client_slug, agent, event, tool, task_id, parent_id, piece_slug, payload, source, dedupe_key)
         values (coalesce($1::timestamptz, now()), $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         on conflict (dedupe_key) do nothing
         returning id`,
        [
          bruto.ts ?? null,
          bruto.client_slug ?? null,
          bruto.agent ?? null,
          bruto.event,
          bruto.tool ?? null,
          bruto.task_id ?? null,
          bruto.parent_id ?? null,
          bruto.piece_slug ?? null,
          JSON.stringify({
            ...(bruto.payload ?? {}),
            ...(bruto.familia ? { familia: bruto.familia } : {}),
            ...(bruto.modelo ? { modelo: bruto.modelo } : {}),
          }),
          bruto.source,
          bruto.dedupe_key ?? null,
        ]
      )
      if (linhas.length > 0) inseridos++
      else ignorados++ // duplicado, on conflict do nothing
    } catch {
      ignorados++
    }
  }

  return NextResponse.json({ inseridos, ignorados })
}
