"use client"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { ICONE_REDE, LABEL_REDE, LABEL_STATUS_ETAPA, LABEL_TIPO } from "@/lib/sala/rotulos"
import { ETAPAS, type Peca } from "@/lib/sala/types"

interface CartaoPecaProps {
  peca: Peca
  onClick: () => void
}

const VARIANTE_STATUS: Record<Peca["statusEtapa"], NonNullable<BadgeProps["variant"]>> = {
  pendente: "secondary",
  em_andamento: "default",
  aguardando_aprovacao: "warning",
  aprovado: "success",
  ajuste: "warning",
  concluido: "success",
}

const BORDA_STATUS: Record<Peca["statusEtapa"], string> = {
  pendente: "border-l-border",
  em_andamento: "border-l-accent",
  aguardando_aprovacao: "border-l-warning",
  aprovado: "border-l-success",
  ajuste: "border-l-warning",
  concluido: "border-l-success",
}

export function CartaoPeca({ peca, onClick }: CartaoPecaProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Abrir peça: ${peca.titulo}`}
      className={`flex w-full min-w-0 flex-col gap-2 rounded-md border border-border border-l-2 ${BORDA_STATUS[peca.statusEtapa]} bg-background p-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-hover">
        {peca.capaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peca.capaUrl} alt={`Capa de ${peca.titulo}`} className="h-full w-full object-contain" />
        ) : (
          <span className="px-3 text-center text-sm text-text-secondary">{LABEL_TIPO[peca.tipo]}<br /><span className="text-xs">Prévia ainda não disponível</span></span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary">{peca.titulo}</p>
        <p className="text-xs text-text-secondary">{ETAPAS[peca.etapaAtual]}</p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="w-fit text-[10px]">
            {LABEL_TIPO[peca.tipo]}
          </Badge>
          <Badge variant={VARIANTE_STATUS[peca.statusEtapa]} className="w-fit max-w-full truncate text-[10px]">
            {LABEL_STATUS_ETAPA[peca.statusEtapa]}
          </Badge>
          {peca.redes.map((rede) => {
            const Icone = ICONE_REDE[rede]
            return (
              <Icone
                key={rede}
                className="h-3.5 w-3.5 text-text-secondary"
                role="img"
                aria-label={LABEL_REDE[rede]}
              />
            )
          })}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-border bg-surface-hover text-[9px] text-text-secondary">
            {peca.donoEtapa.slice(0, 1).toUpperCase()}
          </span>
          <p className="truncate text-xs text-text-secondary">{peca.donoEtapa || "sem dono"}</p>
        </div>
        {peca.diasParado > 3 && peca.statusEtapa !== "concluido" && (
          <p className="text-xs font-medium text-error">parado há {peca.diasParado} dias</p>
        )}
      </div>
    </button>
  )
}
