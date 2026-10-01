import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Agente } from "@/lib/sala/types"

interface TimeProps {
  agentes: Agente[]
}

export function Time({ agentes }: TimeProps) {
  const trabalhando = agentes.filter((agente) => agente.status === "trabalhando")
  const parados = agentes.filter((agente) => agente.status === "parado").slice(0, 3)

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {trabalhando.length > 0 ? (
          <ul className="space-y-3">
            {trabalhando.map((agente) => (
              <li key={agente.slug} className="flex items-start gap-3 text-sm">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success"
                  role="img"
                  aria-label="trabalhando"
                />
                <div className="min-w-0">
                  <p className="text-text-primary">{agente.nome}</p>
                  {agente.tarefaAtual ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                      {agente.tarefaAtual}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : parados.length > 0 ? (
          <ul className="space-y-2">
            {parados.map((agente) => (
              <li
                key={agente.slug}
                className="flex items-center gap-3 text-sm text-text-secondary"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-border"
                  role="img"
                  aria-label="parado"
                />
                <span>{agente.nome}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum agente cadastrado ainda.</p>
        )}
        <Link
          href="/sala/time"
          className="mt-4 inline-block rounded text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver time
        </Link>
      </CardContent>
    </Card>
  )
}
