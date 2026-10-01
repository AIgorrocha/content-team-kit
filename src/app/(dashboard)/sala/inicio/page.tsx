import { SalaHeader } from "@/components/sala/SalaHeader"
import { InicioCliente } from "@/components/sala/inicio/InicioCliente"
import { getSala } from "@/lib/sala/data"

export default async function SalaInicioPage() {
  const cliente = await getSala().clienteAtivo()
  return (
    <div className="space-y-4">
      <SalaHeader
        titulo="Início"
        descricao="Converse com o assistente, confira sua marca e conecte as ferramentas da equipe."
      />
      <InicioCliente clienteInicial={cliente} />
    </div>
  )
}
