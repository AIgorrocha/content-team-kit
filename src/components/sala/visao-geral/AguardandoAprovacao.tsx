import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ETAPAS, type Peca } from "@/lib/sala/types"
import { LABEL_TIPO } from "@/lib/sala/rotulos"

interface AguardandoAprovacaoProps {
  pecas: Peca[]
}

export function AguardandoAprovacao({ pecas }: AguardandoAprovacaoProps) {
  return (
    <Card className="rounded-md border-accent/60">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Aguardando sua aprovação
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-3xl font-semibold tabular-nums">
          {pecas.length}{" "}
          <span className="align-middle text-xs font-normal uppercase tracking-wide text-text-secondary">
            {pecas.length === 1 ? "peça aguardando aprovação" : "peças aguardando aprovação"}
          </span>
        </p>
        {pecas.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {pecas.map((peca) => (
              <li key={peca.slug} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{peca.titulo}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {LABEL_TIPO[peca.tipo]} · {ETAPAS[peca.etapaAtual]}
                  </p>
                </div>
                <Link
                  href={`/sala/pecas/${peca.slug}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">Nada esperando aprovação agora.</p>
        )}
      </CardContent>
    </Card>
  )
}
