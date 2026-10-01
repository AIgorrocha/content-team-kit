"use client"

import { useMemo } from "react"
import type { Artefato } from "@/lib/sala/types"

const TIPOS_TEXTO: Artefato["tipo"][] = ["legenda_ig", "legenda_tiktok", "shorts", "post_linkedin", "roteiro", "titulo", "descricao", "tags"]

const NOME_TIPO: Partial<Record<Artefato["tipo"], string>> = {
  legenda_ig: "Legenda Instagram",
  legenda_tiktok: "Legenda TikTok",
  shorts: "YouTube Shorts",
  post_linkedin: "Post LinkedIn",
  roteiro: "Roteiro",
  titulo: "Título",
  descricao: "Descrição",
  tags: "Tags",
}

function contarHashtags(texto: string): number {
  return (texto.match(/#\w+/g) ?? []).length
}

interface TextosPecaProps {
  artefatos: Artefato[]
}

// Textos publicáveis da peça (legendas, post, roteiro), com contagem de caracteres e
// de hashtags pra caber no limite de cada rede antes de aprovar.
export function TextosPeca({ artefatos }: TextosPecaProps) {
  const textos = useMemo(() => artefatos.filter((a) => TIPOS_TEXTO.includes(a.tipo) && a.texto != null), [artefatos])

  if (textos.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum texto registrado nesta peça.</p>
  }

  return (
    <ul className="flex flex-col gap-4">
      {textos.map((artefato) => {
        const texto = artefato.texto ?? ""
        return (
          <li key={artefato.id} className="rounded-md border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">{NOME_TIPO[artefato.tipo] ?? artefato.nome}</p>
              <p className="whitespace-nowrap text-xs text-text-secondary">
                {texto.length} caracteres, {contarHashtags(texto)} hashtags
              </p>
            </div>
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{texto || "(vazio)"}</p>
          </li>
        )
      })}
    </ul>
  )
}
