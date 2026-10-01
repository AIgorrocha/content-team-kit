"use client"

import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import type { Artefato, Revisao } from "@/lib/sala/types"

interface RevisoesProps {
  revisoes: Revisao[]
  artefatos: Artefato[]
}

// Histórico r1..rN da peça, com os artefatos de cada revisão e marcação da aprovada.
export function Revisoes({ revisoes, artefatos }: RevisoesProps) {
  if (revisoes.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhuma revisão registrada nesta peça.</p>
  }

  const nomeArtefato = (id: string) => artefatos.find((a) => a.id === id)?.nome ?? id

  return (
    <ul className="flex flex-col gap-3">
      {[...revisoes].reverse().map((revisao) => (
        <li key={revisao.id} className="rounded-md border border-border bg-surface p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">
              Revisão {revisao.numero} <span className="text-text-secondary">({revisao.criadaPor})</span>
            </p>
            {revisao.aprovadaEm ? (
              <Badge variant="success" className="text-[10px]">Aprovada</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Não aprovada</Badge>
            )}
          </div>
          <p className="text-xs text-text-secondary">{formatDateTime(revisao.criadaEm)}</p>
          <p className="mt-1 text-sm text-text-secondary">{revisao.oQueMudou}</p>
          {revisao.artefatoIds.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {revisao.artefatoIds.map((id) => (
                <li key={id} className="rounded bg-background px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {nomeArtefato(id)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
