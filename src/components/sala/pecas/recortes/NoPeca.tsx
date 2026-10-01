"use client"

import type { KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ICONE_REDE, LABEL_REDE, LABEL_TIPO, LABEL_STATUS_PUBLICACAO, VARIANTE_STATUS_PUBLICACAO } from "@/lib/sala/rotulos"
import type { Peca } from "@/lib/sala/types"

export interface DadosNoPeca {
  peca: Peca
  ehMae: boolean
  planejado: boolean
  [chave: string]: unknown
}

// Nó custom da árvore da Trilha: renderiza a peça mãe (capa 16:9, status e link de
// publicação) e as peças filhas (capa mini, tipo, redes, status por rede e CTA de
// automação de comentário). Clicar em qualquer nó abre a peça em /sala/pecas.
export function NoPeca({ data }: NodeProps<Node<DadosNoPeca>>) {
  const { peca, ehMae, planejado } = data
  const router = useRouter()

  const abrirPeca = () => router.push(`/sala/pecas?peca=${peca.slug}`)
  const aoTeclar = (evento: KeyboardEvent) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault()
      abrirPeca()
    }
  }

  if (ehMae) {
    const publicacao = peca.publicacoes[0] ?? null
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={abrirPeca}
        onKeyDown={aoTeclar}
        aria-label={`Abrir peça: ${peca.titulo}`}
        className="flex w-[260px] cursor-pointer flex-col gap-1.5 rounded-md border border-border bg-surface p-2 text-left shadow-sm transition-shadow hover:ring-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="aspect-video w-full overflow-hidden rounded bg-background">
          {peca.capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={peca.capaUrl} alt={`Capa de ${peca.titulo}`} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-secondary">sem capa</span>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-text-primary">{peca.titulo}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {LABEL_TIPO.youtube_longo}
          </Badge>
          {publicacao ? (
            <Badge variant={VARIANTE_STATUS_PUBLICACAO[publicacao.status]} className="text-[10px]">
              {LABEL_STATUS_PUBLICACAO[publicacao.status]}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              sem publicação
            </Badge>
          )}
          <Badge variant={publicacao?.automacaoComentario?.ativa ? "default" : "secondary"} className="text-[10px]">
            {publicacao?.automacaoComentario?.ativa
              ? `responde comentário: ${publicacao.automacaoComentario.palavra ?? "?"}`
              : "sem automação"}
          </Badge>
        </div>
        {publicacao?.url && (
          <a
            href={publicacao.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(evento) => evento.stopPropagation()}
            onKeyDown={(evento) => evento.stopPropagation()}
            className="w-fit text-xs text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            abrir no YouTube
          </a>
        )}
        <Handle type="source" position={Position.Bottom} style={{ background: "rgb(var(--ct-border))" }} />
      </div>
    )
  }

  const statusesUnicos = Array.from(new Set(peca.publicacoes.map((p) => p.status)))
  const automacaoAtiva = peca.publicacoes.find((p) => p.automacaoComentario?.ativa)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={abrirPeca}
      onKeyDown={aoTeclar}
      aria-label={`Abrir peça: ${peca.titulo}`}
      className={cn(
        "flex w-[220px] cursor-pointer gap-2 rounded-md border p-2 text-left shadow-sm transition-shadow hover:ring-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        planejado ? "border-dashed border-border/70 bg-surface/60" : "border-border bg-surface"
      )}
    >
      <Handle type="target" position={Position.Top} style={{ background: "rgb(var(--ct-border))" }} />
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded bg-background",
          peca.tipo === "carrossel" ? "h-14 w-14" : "h-16 w-9"
        )}
      >
        {peca.capaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peca.capaUrl} alt={`Capa de ${peca.titulo}`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center px-0.5 text-center text-[8px] text-text-secondary">sem capa</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-xs font-medium text-text-primary">{peca.titulo}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="text-[9px]">
            {LABEL_TIPO[peca.tipo]}
          </Badge>
          {peca.redes.map((rede) => {
            const Icone = ICONE_REDE[rede]
            return <Icone key={rede} className="h-3 w-3 text-text-secondary" role="img" aria-label={LABEL_REDE[rede]} />
          })}
        </div>
        {planejado ? (
          <Badge variant="secondary" className="w-fit text-[9px]">
            planejado
          </Badge>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {statusesUnicos.map((status) => (
                <Badge key={status} variant={VARIANTE_STATUS_PUBLICACAO[status]} className="text-[9px]">
                  {LABEL_STATUS_PUBLICACAO[status]}
                </Badge>
              ))}
            </div>
            <Badge variant={automacaoAtiva ? "default" : "secondary"} className="w-fit text-[9px]">
              {automacaoAtiva
                ? `responde comentário: ${automacaoAtiva.automacaoComentario?.palavra ?? "?"}`
                : "sem automação"}
            </Badge>
          </>
        )}
      </div>
    </div>
  )
}
