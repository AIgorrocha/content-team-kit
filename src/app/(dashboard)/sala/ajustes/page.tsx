import { getSala } from "@/lib/sala/data"
import { SalaHeader } from "@/components/sala/SalaHeader"
import { Banco } from "@/components/sala/config/Banco"
import { Modelos } from "@/components/sala/config/Modelos"
import { Chaves } from "@/components/sala/config/Chaves"
import { Kit } from "@/components/sala/config/Kit"
import { GrupoConexoes } from "@/components/sala/conexoes/GrupoConexoes"
import { Cofre } from "@/components/sala/config/Cofre"
import Link from "next/link"

export default async function SalaAjustesPage() {
  const sala = getSala()
  const [configuracao, conexoes] = await Promise.all([sala.configuracao(), sala.conexoes()])
  const infra = conexoes.filter((c) => c.categoria === "infra")
  const mcps = conexoes.filter((c) => c.categoria === "mcp")

  return (
    <div className="space-y-6">
      <SalaHeader titulo="Ajustes" descricao="Banco, modelos, chaves e infraestrutura." />
      <p className="text-sm text-text-secondary">Quer configurar com ajuda? <Link href="/sala/inicio" className="text-accent underline">Abra a entrevista e o passo a passo das integrações.</Link></p>
      <Cofre cliente={configuracao.kit.cliente} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Banco banco={configuracao.banco} />
        <Modelos modelos={configuracao.modelos} />
        <Chaves chaves={configuracao.chaves} />
        <Kit kit={configuracao.kit} />
      </div>
      {/* Infraestrutura (Supabase, ai-memory, Telegram e MCPs): migrou de /sala/conexoes
          nesta batelada (B5); as conexões de rede ficaram no cartão de cada rede em
          /sala/redes. */}
      <GrupoConexoes titulo="Infraestrutura" conexoes={infra} />
      <GrupoConexoes titulo="MCPs" conexoes={mcps} />
    </div>
  )
}
