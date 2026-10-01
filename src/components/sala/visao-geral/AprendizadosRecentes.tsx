import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Aprendizado } from "@/lib/sala/types"
import { formatarDataCivil } from "@/lib/sala/rotulos"

interface AprendizadosRecentesProps {
  itens: Aprendizado[]
}

export function AprendizadosRecentes({ itens }: AprendizadosRecentesProps) {
  const recentes = itens.slice(0, 3)

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Aprendizados recentes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {recentes.length > 0 ? (
          <ul className="space-y-3">
            {recentes.map((item, indice) => (
              <li key={`${item.peca}-${indice}`} className="text-sm">
                <p className="line-clamp-2 text-text-primary">{item.texto}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {item.peca} · {formatarDataCivil(item.data)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">Nenhum aprendizado registrado ainda.</p>
        )}
        <Link
          href="/sala/padroes"
          className="mt-4 inline-block rounded text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver padrões
        </Link>
      </CardContent>
    </Card>
  )
}
