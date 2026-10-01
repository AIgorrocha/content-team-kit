"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Regra, Selo } from "@/lib/sala/types"

const ESTILO_SELO: Record<Selo, string> = {
  REINCIDENTE: "border-error text-error",
  FIXA: "border-border text-text-secondary",
  HIPOTESE: "border-warning/50 text-warning",
  MEDIDO: "border-success/50 text-success",
  MECANICA: "border-accent/50 text-accent",
}

interface ListaRegrasProps {
  titulo: string
  regras: Regra[]
  onEditar: (regra: Regra) => void
  onMarcarFixa: (regra: Regra) => void
  colapsavel?: boolean
}

// Lista de regras de uma aba (ou o grupo "Regras gerais" dentro dela, quando colapsavel).
// Cada linha mostra o selo, o título, a primeira linha do texto (com opção de expandir) e
// as ações "Editar" e "Marcar como fixa".
export function ListaRegras({ titulo, regras, onEditar, onMarcarFixa, colapsavel = false }: ListaRegrasProps) {
  const [aberto, setAberto] = useState(!colapsavel)

  if (regras.length === 0) {
    return colapsavel ? null : <p className="text-sm text-text-secondary">Nenhuma regra registrada para este tipo.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {colapsavel ? (
        <h2>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {titulo} ({regras.length})
          </button>
        </h2>
      ) : (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {titulo} ({regras.length})
        </h2>
      )}
      {aberto && (
        <ul className="flex flex-col gap-2">
          {regras.map((regra) => (
            <LinhaRegra key={regra.id} regra={regra} onEditar={onEditar} onMarcarFixa={onMarcarFixa} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LinhaRegra({
  regra,
  onEditar,
  onMarcarFixa,
}: {
  regra: Regra
  onEditar: (regra: Regra) => void
  onMarcarFixa: (regra: Regra) => void
}) {
  const [expandido, setExpandido] = useState(false)
  const primeiraLinha = regra.texto.split("\n")[0]

  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                ESTILO_SELO[regra.selo]
              )}
            >
              {regra.selo === "REINCIDENTE" && <AlertTriangle className="h-3 w-3" />}
              {regra.selo}
            </span>
            <span className="text-sm font-medium text-text-primary">{regra.titulo}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="text-left text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expandido ? (
              <span className="whitespace-pre-wrap">{regra.texto}</span>
            ) : (
              <span className="line-clamp-1">{primeiraLinha}</span>
            )}
          </button>
          <span className="font-mono text-[11px] text-text-secondary">{regra.arquivo}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => onEditar(regra)}>
            Editar
          </Button>
          {regra.selo !== "FIXA" && (
            <Button size="sm" variant="ghost" onClick={() => onMarcarFixa(regra)}>
              Marcar como fixa
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
