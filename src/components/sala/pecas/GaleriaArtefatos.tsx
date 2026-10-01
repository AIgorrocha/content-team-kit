"use client"

import { useMemo, useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { Badge } from "@/components/ui/badge"
import type { Artefato } from "@/lib/sala/types"

const TIPOS_VISUAIS: Artefato["tipo"][] = ["capa", "slide", "story", "thumbnail", "clip", "video", "fluxograma"]
const TIPOS_VIDEO: Artefato["tipo"][] = ["clip", "video"]

interface GaleriaArtefatosProps {
  artefatos: Artefato[]
}

// Grade de prévias visuais da peça. Imagens abrem no lightbox; clip/vídeo mostram só o
// poster (Fase 1 não reproduz vídeo, é só a Fase 2 que traz o player real).
export function GaleriaArtefatos({ artefatos }: GaleriaArtefatosProps) {
  const visuais = useMemo(() => artefatos.filter((a) => TIPOS_VISUAIS.includes(a.tipo)), [artefatos])
  const imagens = useMemo(() => visuais.filter((a) => !TIPOS_VIDEO.includes(a.tipo) && a.url), [visuais])
  const [indiceAberto, setIndiceAberto] = useState<number | null>(null)

  if (visuais.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum artefato visual nesta peça.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visuais.map((artefato) => {
          const ehVideo = TIPOS_VIDEO.includes(artefato.tipo)
          const src = ehVideo ? artefato.poster ?? null : artefato.url
          const indiceNaGaleria = imagens.findIndex((a) => a.id === artefato.id)
          return (
            <div key={artefato.id} className="flex flex-col gap-1">
              <button
                type="button"
                disabled={ehVideo || !src}
                onClick={() => {
                  if (!ehVideo && indiceNaGaleria >= 0) setIndiceAberto(indiceNaGaleria)
                }}
                className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`Prévia de ${artefato.nome}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-xs text-text-secondary">sem arquivo</span>
                )}
              </button>
              <p className="truncate text-xs text-text-secondary">{artefato.nome}</p>
              {artefato.versao && (
                <Badge variant="secondary" className="w-fit text-[10px]">
                  {artefato.versao}
                </Badge>
              )}
              {ehVideo && <p className="text-xs text-text-secondary">vídeo disponível na Fase 2</p>}
            </div>
          )
        })}
      </div>
      <Lightbox
        open={indiceAberto !== null}
        close={() => setIndiceAberto(null)}
        index={indiceAberto ?? 0}
        slides={imagens.map((a) => ({ src: a.url as string, alt: a.nome }))}
      />
    </div>
  )
}
