import Link from "next/link"
import type { Aprendizado } from "@/lib/sala/types"

interface AprendizadosRedeProps {
  itens: Aprendizado[]
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-")
  if (!ano || !mes || !dia) return iso
  return `${dia}/${mes}`
}

// Versão enxuta de padroes/Aprendizados.tsx (sem Card próprio) pra viver dentro do cartão
// grande de cada rede em /sala/redes (Batelada B5): já vem filtrada pela página, então todo
// item aqui sempre aponta pra uma peça publicada nesta rede (nunca "geral").
export function AprendizadosRede({ itens }: AprendizadosRedeProps) {
  if (itens.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum aprendizado registrado ainda.</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item, indice) => (
        <li key={`${item.data}-${indice}`} className="border-l-2 border-border pl-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">{formatarData(item.data)}</span>
            <Link
              href={`/sala/pecas?peca=${item.peca}`}
              className="rounded text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {item.peca}
            </Link>
          </div>
          <p className="mt-1 text-sm text-text-primary">{item.texto}</p>
        </li>
      ))}
    </ul>
  )
}
