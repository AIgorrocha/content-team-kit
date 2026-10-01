import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { VisaoGeral } from "@/lib/sala/types"

type Nivel = VisaoGeral["alertas"][number]["nivel"]

const COR_NIVEL: Record<Nivel, string> = {
  critico: "bg-error",
  atencao: "bg-warning",
  info: "bg-accent",
}

const LABEL_NIVEL: Record<Nivel, string> = {
  critico: "crítico",
  atencao: "atenção",
  info: "informativo",
}

interface AlertasProps {
  alertas: VisaoGeral["alertas"]
}

export function Alertas({ alertas }: AlertasProps) {
  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {alertas.length > 0 ? (
          <ul className="space-y-3">
            {alertas.map((alerta, indice) => (
              <li key={indice} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COR_NIVEL[alerta.nivel]}`}
                  role="img"
                  aria-label={`nível ${LABEL_NIVEL[alerta.nivel]}`}
                />
                <Link
                  href={alerta.link}
                  className="flex-1 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {alerta.texto}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum alerta agora.</p>
        )}
      </CardContent>
    </Card>
  )
}
