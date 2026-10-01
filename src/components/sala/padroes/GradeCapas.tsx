"use client"

import { useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface CapaGrade {
  slug: string
  titulo: string
  url: string
  rodada: string | null
}

interface GradeCapasProps {
  capas: CapaGrade[]
  titulo?: string
  semCard?: boolean
}

// Todas as capas do seed lado a lado (9:16), com o nome da peça e a rodada aprovada
// (versão do artefato de capa marcado como aprovado). Clique abre no lightbox. `titulo`
// (Batelada B5) deixa o cartão de rede em /sala/redes chamar a seção de "Capas aprovadas"
// em vez do rótulo genérico. `semCard` (design B12) tira a moldura própria quando o
// componente já vive dentro do cartão grande da rede, pra não desenhar cartão dentro de
// cartão (o desenho mostra a grade como uma seção plana, só com o rótulo em cima).
export function GradeCapas({ capas, titulo = "Grade de capas", semCard = false }: GradeCapasProps) {
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null)

  const grade = (
    <>
      {capas.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma capa aprovada ainda.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {capas.map((capa, indice) => (
            <li key={`${capa.slug}-${indice}`} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setIndiceAberto(indice)}
                className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capa.url} alt={`Capa de ${capa.titulo}`} className="h-full w-full object-cover" />
              </button>
              <p className="truncate text-xs text-text-primary">{capa.titulo}</p>
              <p className="text-[11px] text-text-secondary">
                {capa.rodada ? `Aprovado: ${capa.rodada}` : "sem rodada aprovada registrada"}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Lightbox
        open={indiceAberto !== null}
        close={() => setIndiceAberto(null)}
        index={indiceAberto ?? 0}
        slides={capas.map((c) => ({ src: c.url, alt: c.titulo }))}
      />
    </>
  )

  if (semCard) {
    return (
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">{titulo}</p>
        {grade}
      </div>
    )
  }

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{grade}</CardContent>
    </Card>
  )
}
