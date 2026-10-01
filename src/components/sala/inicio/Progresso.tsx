"use client"

import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BlocoOnboarding } from "@/lib/sala/types"

interface ProgressoProps {
  blocos: BlocoOnboarding[]
  blocoAtual: number | null // null = tela de fechamento (depois do bloco 7)
  onSelecionar: (numero: number) => void
}

// Trilha com os 8 blocos do onboarding e o estado de cada um: concluído (gravado),
// atual (sendo respondido agora) ou pendente.
export function Progresso({ blocos, blocoAtual, onSelecionar }: ProgressoProps) {
  return (
    <nav aria-label="Progresso do onboarding" data-testid="inicio-progresso">
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {blocos.map((bloco) => {
          const atual = bloco.numero === blocoAtual
          return (
            <li key={bloco.numero} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelecionar(bloco.numero)}
                aria-current={atual ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  atual
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                )}
              >
                {bloco.gravado ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap lg:whitespace-normal">
                  {bloco.numero}. {bloco.titulo}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
