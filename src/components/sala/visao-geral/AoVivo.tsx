import Link from "next/link"
import { formatDistance } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventoAoVivo } from "@/lib/sala/types"

interface AoVivoProps {
  eventos: EventoAoVivo[]
  agora: string
}

function horaRelativa(ts: string, agora: string): string {
  return formatDistance(new Date(ts), new Date(agora), { addSuffix: true, locale: ptBR })
}

export function AoVivo({ eventos, agora }: AoVivoProps) {
  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Ao vivo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {eventos.length > 0 ? (
          <ul className="space-y-3">
            {eventos.slice(0, 6).map((evento) => (
              <li key={evento.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">
                    {horaRelativa(evento.ts, agora)}
                  </span>
                  {evento.agente ? (
                    <Badge variant="default" className="text-[10px]">
                      {evento.agente}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-text-primary">{evento.resumo}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum evento agora.</p>
        )}
        <Link
          href="/sala/ao-vivo"
          className="mt-4 inline-block rounded text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver ao vivo
        </Link>
      </CardContent>
    </Card>
  )
}
