import { SalaHeader } from "@/components/sala/SalaHeader"
import { CalendarioSala, BotaoSincronizarCalendario } from "@/components/sala/calendario/CalendarioSala"
import { getSala } from "@/lib/sala/data"

export default function SalaCalendarioPage() {
  const agora = getSala().agora()
  return (
    <div className="space-y-4">
      <SalaHeader
        titulo="Calendário"
        descricao="Peças planejadas, agendadas e publicadas por dia."
        acoes={<BotaoSincronizarCalendario />}
      />
      <CalendarioSala agora={agora} />
    </div>
  )
}
