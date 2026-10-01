import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ETAPAS, type Rede, type VisaoGeral } from "@/lib/sala/types"

const REDE_LABEL: Record<Rede, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  meta_ads: "Meta Ads",
  email: "E-mail",
}

interface CartoesResumoProps {
  emProducao: VisaoGeral["emProducao"]
  publicadosSemana: VisaoGeral["publicadosSemana"]
}

export function CartoesResumo({ emProducao, publicadosSemana }: CartoesResumoProps) {
  const totalProducao = emProducao.reduce((soma, item) => soma + item.quantidade, 0)
  const maiorEtapa = Math.max(1, ...emProducao.map((item) => item.quantidade))

  const porRede = new Map<Rede, number>()
  for (const publicacao of publicadosSemana) {
    porRede.set(publicacao.rede, (porRede.get(publicacao.rede) ?? 0) + 1)
  }
  const redes = Array.from(porRede.entries())

  return (
    <Card className="rounded-md">
      <CardHeader className="flex-row items-center justify-between p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Em produção e publicados
        </CardTitle>
        <Link
          href="/sala/pecas"
          className="rounded text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver peças
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-0 grid gap-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2 text-3xl font-semibold tabular-nums">
            {totalProducao}{" "}
            <span className="align-middle text-xs font-normal uppercase tracking-wide text-text-secondary">
              peças em produção
            </span>
          </p>
          {emProducao.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {emProducao.map((item) => (
                <li key={item.etapa} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 truncate text-text-secondary">{ETAPAS[item.etapa]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(item.quantidade / maiorEtapa) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 text-right tabular-nums">{item.quantidade}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-text-secondary">Nada em produção agora.</p>
          )}
        </div>
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2 text-3xl font-semibold tabular-nums">
            {publicadosSemana.length}{" "}
            <span className="align-middle text-xs font-normal uppercase tracking-wide text-text-secondary">
              publicadas na semana
            </span>
          </p>
          {redes.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {redes.map(([rede, quantidade]) => (
                <li key={rede} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
                  <span className="text-text-secondary">{REDE_LABEL[rede]}</span>
                  <span className="text-right tabular-nums">{quantidade}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-text-secondary">Nenhuma publicação na semana.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
