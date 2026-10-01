import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Agente, Conexao, VisaoGeral } from "@/lib/sala/types"

type Tom = "neutro" | "accent" | "warning"

interface Indicador {
  valor: string
  rotulo: string
  href: string
  tom: Tom
}

const COR_TOM: Record<Tom, string> = {
  neutro: "text-text-primary",
  accent: "text-accent",
  warning: "text-warning",
}

interface FaixaStatusProps {
  visaoGeral: VisaoGeral
  agentes: Agente[]
  conexoes: Conexao[]
}

// Faixa de status no topo da Visão geral: números grandes, cada indicador é um link
// pra aba correspondente. Rótulos propositalmente diferentes dos textos afirmados
// pelos testes (que ficam nos cartões) pra não duplicar string na página.
export function FaixaStatus({ visaoGeral, agentes, conexoes }: FaixaStatusProps) {
  const trabalhando = agentes.filter((agente) => agente.status === "trabalhando").length
  const emProducao = visaoGeral.emProducao.reduce((soma, item) => soma + item.quantidade, 0)
  const conexoesAtencao = conexoes.filter((conexao) => conexao.status !== "ok").length
  const aguardando = visaoGeral.aguardandoAprovacao.length

  const indicadores: Indicador[] = [
    { valor: `${trabalhando}/${agentes.length}`, rotulo: "agentes trabalhando", href: "/sala/time", tom: trabalhando > 0 ? "accent" : "neutro" },
    { valor: String(emProducao), rotulo: "em produção", href: "/sala/pecas", tom: "neutro" },
    { valor: String(visaoGeral.publicadosSemana.length), rotulo: "posts na semana", href: "/sala/redes", tom: "neutro" },
    { valor: String(conexoesAtencao), rotulo: "conexões com atenção", href: "/sala/conexoes", tom: conexoesAtencao > 0 ? "warning" : "neutro" },
    { valor: String(aguardando), rotulo: "para aprovar", href: "/sala/pecas", tom: aguardando > 0 ? "accent" : "neutro" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {indicadores.map((indicador) => (
        <Link
          key={indicador.rotulo}
          href={indicador.href}
          className="rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <p className={cn("text-2xl font-semibold tabular-nums", COR_TOM[indicador.tom])}>
            {indicador.valor}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">{indicador.rotulo}</p>
        </Link>
      ))}
    </div>
  )
}
