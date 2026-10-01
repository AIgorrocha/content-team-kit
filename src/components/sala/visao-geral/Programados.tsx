import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FUSO, type ItemCalendario } from "@/lib/sala/types"
import { LABEL_REDE, LABEL_TIPO } from "@/lib/sala/rotulos"

interface ProgramadosProps {
  itens: ItemCalendario[]
  agora: string
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function somarDias(diaStr: string, dias: number): string {
  const data = new Date(`${diaStr}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

function rotuloDia(diaStr: string, hojeStr: string): string {
  if (diaStr === hojeStr) return "Hoje"
  if (diaStr === somarDias(hojeStr, 1)) return "Amanhã"
  return new Date(`${diaStr}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
}

export function Programados({ itens, agora }: ProgramadosProps) {
  const hojeStr = agora.slice(0, 10)
  const limiteStr = somarDias(hojeStr, 7)

  const hoje = itens.filter((item) => item.data.slice(0, 10) === hojeStr)
  const semana = itens
    .filter((item) => {
      const dia = item.data.slice(0, 10)
      return dia >= hojeStr && dia <= limiteStr
    })
    .sort((a, b) => a.data.localeCompare(b.data))

  const porDia = new Map<string, ItemCalendario[]>()
  for (const item of semana) {
    const dia = item.data.slice(0, 10)
    const grupo = porDia.get(dia) ?? []
    grupo.push(item)
    porDia.set(dia, grupo)
  }
  const dias = Array.from(porDia.keys()).sort()

  return (
    <Card className="rounded-md">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold text-text-primary">
          Programados
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-6">
          <p className="text-3xl font-semibold tabular-nums">
            {hoje.length}{" "}
            <span className="align-middle text-xs font-normal uppercase tracking-wide text-text-secondary">
              hoje
            </span>
          </p>
          <p className="text-3xl font-semibold tabular-nums">
            {semana.length}{" "}
            <span className="align-middle text-xs font-normal uppercase tracking-wide text-text-secondary">
              na semana
            </span>
          </p>
        </div>
        {dias.length > 0 ? (
          <div className="mt-4 space-y-4">
            {dias.map((dia) => (
              <section key={dia} aria-label={rotuloDia(dia, hojeStr)}>
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  {rotuloDia(dia, hojeStr)}
                </p>
                <ul className="mt-2 space-y-2">
                  {(porDia.get(dia) ?? []).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 tabular-nums text-text-secondary">
                        {formatarHora(item.data)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-text-primary">{item.titulo}</span>
                      <span
                        title={item.rede ? `${LABEL_REDE[item.rede]} · ${LABEL_TIPO[item.tipo]}` : LABEL_TIPO[item.tipo]}
                        className="max-w-[45%] shrink-0 truncate text-right text-xs text-text-secondary"
                      >
                        {item.rede
                          ? `${LABEL_REDE[item.rede]} · ${LABEL_TIPO[item.tipo]}`
                          : LABEL_TIPO[item.tipo]}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">Nada programado nos próximos dias.</p>
        )}
        <Link
          href="/sala/calendario"
          className="mt-4 inline-block rounded text-sm text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Ver calendário
        </Link>
      </CardContent>
    </Card>
  )
}
