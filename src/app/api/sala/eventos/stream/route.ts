import { NextRequest } from "next/server"
import { getSala } from "@/lib/sala/data"
import { authCheck } from "@/lib/sala/auth"
import type { EventoAoVivo } from "@/lib/sala/types"

export const dynamic = "force-dynamic"

// Server-Sent Events dos eventos ao vivo: no mock, reproduz o roteiro de 24 eventos do
// seed em loop (1,5s entre eles, id sufixado por volta); no live, assinarEventos() usa
// Realtime. Cada evento chega como `event: evento\ndata: {EventoAoVivo}\n\n`.
export async function GET(req: NextRequest) {
  const auth = await authCheck(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ erro: auth.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const assinatura = getSala().assinarEventos()[Symbol.asyncIterator]()
  const encerrarAssinatura = () => { void assinatura.return?.().catch(() => {}) }

  const stream = new ReadableStream({
    async start(controller) {
      let fechado = false
      let heartbeat: ReturnType<typeof setInterval> | undefined
      const fechar = () => {
        if (fechado) return
        fechado = true
        clearInterval(heartbeat)
        req.signal.removeEventListener("abort", fechar)
        encerrarAssinatura()
        try {
          controller.close()
        } catch {
          // já fechado
        }
      }
      req.signal.addEventListener("abort", fechar)
      controller.enqueue(encoder.encode(": conectado\n\n"))
      heartbeat = setInterval(() => {
        if (!fechado) controller.enqueue(encoder.encode(": ativo\n\n"))
      }, 15000)

      try {
        while (!req.signal.aborted && !fechado) {
          const { value, done } = await assinatura.next()
          if (done || req.signal.aborted || fechado) break
          const evento = value as EventoAoVivo
          controller.enqueue(encoder.encode(`event: evento\ndata: ${JSON.stringify(evento)}\n\n`))
        }
      } catch {
        // conexão encerrada no meio da emissão: sem problema, o cliente reconecta
      } finally {
        fechar()
      }
    },
    cancel() {
      encerrarAssinatura()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
