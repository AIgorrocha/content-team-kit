import type { ReactNode } from "react"

interface SalaHeaderProps {
  titulo: string
  descricao: string
  acoes?: ReactNode
}

export function SalaHeader({ titulo, descricao, acoes }: SalaHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          {titulo}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">{descricao}</p>
      </div>
      {acoes ? <div className="flex shrink-0 items-center gap-2">{acoes}</div> : null}
    </div>
  )
}
