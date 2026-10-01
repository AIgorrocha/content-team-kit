import { SalaHeader } from "@/components/sala/SalaHeader"
import { KanbanTrabalho } from "@/components/sala/trabalho/KanbanTrabalho"
import { getSala } from "@/lib/sala/data"

export default async function SalaTrabalhoPage() {
  const sala = getSala()
  const { colunas } = await sala.trabalho()

  return (
    <div className="space-y-4">
      <SalaHeader titulo="Trabalho" descricao="O que cada agente está fazendo agora, em tempo real." />
      <KanbanTrabalho colunasIniciais={colunas} agora={sala.agora()} />
    </div>
  )
}
