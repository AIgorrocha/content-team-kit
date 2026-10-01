import { formatarDataCivil } from "@/lib/sala/rotulos"
import type { Agente } from "@/lib/sala/types"

interface MemoriaAgenteProps {
  itens: Agente["memoriaRecente"]
}

export function MemoriaAgente({ itens }: MemoriaAgenteProps) {
  if (itens.length === 0) {
    return <p className="text-sm text-text-secondary">Sem memória recente registrada pra este agente.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li key={`${item.caminho}-${item.data}`} className="rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium text-text-primary">{item.titulo}</p>
          <p className="mt-1 truncate font-mono text-xs text-text-secondary">
            {formatarDataCivil(item.data)}, {item.caminho}
          </p>
        </li>
      ))}
    </ul>
  )
}
