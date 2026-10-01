import { NextRequest, NextResponse } from "next/server"
import { authCheck } from "@/lib/sala/auth"
import { estaEmModoLive } from "@/lib/sala/data"
import { clienteAtivoSlug } from "@/lib/sala/cliente"
import { query } from "@/lib/db"

// Pede o corte do vídeo longo em recortes 9:16 (Batelada B4, fase agora: só registra o
// pedido, quem executa é a skill ct-openshorts rodada à mão no terminal). Grava um evento
// "pedido" em ct_agent_events pelo mesmo caminho que a ingestão de eventos ao vivo usa
// (ver src/app/api/sala/eventos/ingest/route.ts),
// pra aparecer na coluna "Esperando" do kanban de Trabalho. No mock não há banco: devolve o
// mesmo 202 sem gravar nada.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await authCheck(req)
  if (!auth.ok) return NextResponse.json({ erro: auth.error }, { status: 401 })

  const { slug } = params
  if (!slug) return NextResponse.json({ erro: "slug obrigatório" }, { status: 400 })

  if (estaEmModoLive()) {
    const cliente = await clienteAtivoSlug()
    const resumo = `Gerar recortes de ${slug} com a skill ct-openshorts`
    try {
      await query(
        `insert into ct_agent_events (client_slug, agent, event, piece_slug, payload, source)
         values ($1, null, 'pedido', $2, $3::jsonb, 'site')`,
        [cliente, slug, JSON.stringify({ resumo })]
      )
    } catch {
      console.error("sala: falha ao registrar pedido de recortes em ct_agent_events")
      return NextResponse.json({ erro: "não foi possível registrar o pedido de recortes" }, { status: 503 })
    }
  }

  return NextResponse.json({ ok: true, mensagem: "Pedido enviado ao terminal" }, { status: 202 })
}
