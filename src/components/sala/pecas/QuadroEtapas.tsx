"use client"

import { useState } from "react"
import { ETAPAS, type Etapa, type Peca } from "@/lib/sala/types"
import { CartaoPeca } from "./CartaoPeca"

const NUMEROS_ETAPA = Object.keys(ETAPAS).map(Number) as Etapa[]
const TODAS_ETAPAS = "todas" as const

interface QuadroEtapasProps {
  pecas: Peca[]
  onAbrir: (slug: string) => void
}

// Quadro com as 8 etapas fixas. No celular as colunas ocupam a largura disponível; no
// desktop o quadro preserva a leitura horizontal.
export function QuadroEtapas({ pecas, onAbrir }: QuadroEtapasProps) {
  const [etapaSelecionada, setEtapaSelecionada] = useState<Etapa | typeof TODAS_ETAPAS>(TODAS_ETAPAS)
  const [modo, setModo] = useState<"galeria" | "etapas">("galeria")

  if (pecas.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
        Nenhuma peça ainda. Comece pelo Início.
      </div>
    )
  }
  const etapasVisiveis = etapaSelecionada === TODAS_ETAPAS ? NUMEROS_ETAPA : [etapaSelecionada]
  const galeria = pecas.filter(p => etapaSelecionada === TODAS_ETAPAS || p.etapaAtual === etapaSelecionada)
    .sort((a, b) => Number(a.statusEtapa === "concluido") - Number(b.statusEtapa === "concluido") || new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime())

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm"><span className="text-text-secondary">{pecas.length} peças</span>{(["galeria", "etapas"] as const).map(valor => <button key={valor} type="button" aria-pressed={modo === valor} onClick={() => setModo(valor)} className={`rounded-md border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${modo === valor ? "border-accent bg-accent/10 text-text-primary" : "border-border text-text-secondary"}`}>{valor === "galeria" ? "Galeria" : "Ver por etapas"}</button>)}</div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="sr-only">Filtrar etapas</span>
          <select
            aria-label="Filtrar etapas"
            value={etapaSelecionada}
            onChange={(evento) => {
              const valor = evento.target.value
              setEtapaSelecionada(valor === TODAS_ETAPAS ? TODAS_ETAPAS : (Number(valor) as Etapa))
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={TODAS_ETAPAS}>Todas as etapas</option>
            {NUMEROS_ETAPA.map((numero) => (
              <option key={numero} value={numero}>
                {numero}. {ETAPAS[numero]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {modo === "galeria" ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="galeria-pecas">
        {galeria.map(peca => <CartaoPeca key={peca.slug} peca={peca} onClick={() => onAbrir(peca.slug)} />)}
      </div> : <div className="grid grid-cols-1 gap-3 md:flex md:overflow-x-auto md:pb-2">
        {etapasVisiveis.map((numero) => {
          const doEtapa = pecas.filter((p) => p.etapaAtual === numero)
          return (
            <div key={numero} className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-3 md:w-[214px] md:shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-text-primary">
                  {numero}. {ETAPAS[numero]}
                </h2>
                <span className="text-xs text-text-secondary">{doEtapa.length}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {doEtapa.map((peca) => (
                  <li key={peca.slug}>
                    <CartaoPeca peca={peca} onClick={() => onAbrir(peca.slug)} />
                  </li>
                ))}
                {doEtapa.length === 0 && <li className="px-1 text-xs text-text-secondary">Sem peças</li>}
              </ul>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
