import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Aprendizado } from "@/lib/sala/types"

interface AprendizadosProps {
  itens: Aprendizado[]
  titulo?: string
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-")
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}`
}

// Linha do tempo do que o time aprendeu: data, peça (link pra /sala/pecas quando não for
// "geral"), texto e a fonte do arquivo. Mais recente primeiro. `titulo` (Batelada B5) deixa
// /sala/redes rotular como "Gerais" o que sobrou sem peça de nenhuma rede.
export function Aprendizados({ itens, titulo = "O que o time aprendeu" }: AprendizadosProps) {
  const ordenados = [...itens].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {ordenados.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum aprendizado registrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {ordenados.map((item, indice) => (
              <li key={`${item.data}-${indice}`} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{formatarData(item.data)}</span>
                  {item.peca === "geral" ? (
                    <span>geral</span>
                  ) : (
                    <Link
                      href={`/sala/pecas?peca=${item.peca}`}
                      className="rounded text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {item.peca}
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-primary">{item.texto}</p>
                <p className="mt-1 font-mono text-[11px] text-text-secondary">{item.fonte}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
