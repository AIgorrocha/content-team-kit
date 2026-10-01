import { SalaHeader } from "@/components/sala/SalaHeader"
import { FaixaStatus } from "@/components/sala/visao-geral/FaixaStatus"
import { AguardandoAprovacao } from "@/components/sala/visao-geral/AguardandoAprovacao"
import { CartoesResumo } from "@/components/sala/visao-geral/CartoesResumo"
import { Programados } from "@/components/sala/visao-geral/Programados"
import { UltimosPosts } from "@/components/sala/visao-geral/UltimosPosts"
import { Ritmo } from "@/components/sala/visao-geral/Ritmo"
import { Alertas } from "@/components/sala/visao-geral/Alertas"
import { AoVivo } from "@/components/sala/visao-geral/AoVivo"
import { Time } from "@/components/sala/visao-geral/Time"
import { AprendizadosRecentes } from "@/components/sala/visao-geral/AprendizadosRecentes"
import { getSala } from "@/lib/sala/data"
import type { Agente, Aprendizado, Conexao, EventoAoVivo, ResumoRede } from "@/lib/sala/types"

export default async function SalaVisaoGeralPage() {
  const sala = getSala()
  // Chamadas além de visaoGeral() são tolerantes a falha: uma fonte fora do ar
  // devolve lista vazia pro cartão dela em vez de derrubar a tela inteira.
  const [visaoGeral, agentes, conexoes, eventos, redes, aprendizados] = await Promise.all([
    sala.visaoGeral(),
    sala.agentes().catch((): Agente[] => []),
    sala.conexoes().catch((): Conexao[] => []),
    sala.eventosRecentes(6).catch((): EventoAoVivo[] => []),
    sala.redes().catch((): ResumoRede[] => []),
    sala.aprendizados().catch((): Aprendizado[] => []),
  ])
  const agora = sala.agora()

  return (
    <div className="space-y-6">
      <SalaHeader
        titulo="Visão geral"
        descricao="Resumo do que está em produção, aguardando aprovação e programado."
      />
      <FaixaStatus visaoGeral={visaoGeral} agentes={agentes} conexoes={conexoes} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <UltimosPosts redes={redes} agora={agora} />
        </div>
        <CartoesResumo emProducao={visaoGeral.emProducao} publicadosSemana={visaoGeral.publicadosSemana} />
        <AguardandoAprovacao pecas={visaoGeral.aguardandoAprovacao} />
        <Programados itens={visaoGeral.programados} agora={agora} />
        <Ritmo semanas={visaoGeral.ritmo} />
        <Alertas alertas={visaoGeral.alertas} />
        <AoVivo eventos={eventos} agora={agora} />
        <Time agentes={agentes} />
        <AprendizadosRecentes itens={aprendizados} />
      </div>
    </div>
  )
}
