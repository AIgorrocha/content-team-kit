import { SalaHeader } from "@/components/sala/SalaHeader"
import { CartaoRede } from "@/components/sala/redes/CartaoRede"
import { Aprendizados } from "@/components/sala/padroes/Aprendizados"
import { SecaoRegras } from "@/components/sala/redes/SecaoRegras"
import { getSala } from "@/lib/sala/data"
import type { CapaGrade } from "@/components/sala/padroes/GradeCapas"
import type { Aprendizado, PadraoVisual, Peca, Rede } from "@/lib/sala/types"

// Aprendizado que cita uma peça publicada nesta rede entra aqui; sem peça correspondente
// (ou peça "geral"/sem rede) sobra pra seção "Gerais" no fim da página.
function separarPorRede(aprendizados: Aprendizado[], redesPorPeca: Map<string, Rede[]>) {
  const porRede = new Map<Rede, Aprendizado[]>()
  const gerais: Aprendizado[] = []

  for (const item of aprendizados) {
    const redes = redesPorPeca.get(item.peca) ?? []
    if (redes.length === 0) {
      gerais.push(item)
      continue
    }
    for (const rede of redes) {
      const lista = porRede.get(rede) ?? []
      lista.push(item)
      porRede.set(rede, lista)
    }
  }
  return { porRede, gerais }
}

function tresUltimos(itens: Aprendizado[]): Aprendizado[] {
  return [...itens].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3)
}

function capasDaRede(padroes: PadraoVisual[], rede: Rede): CapaGrade[] {
  return padroes
    .filter((p) => p.rede === rede)
    .flatMap((p) => p.exemplos.map((exemplo) => ({ slug: exemplo.peca, titulo: exemplo.peca, url: exemplo.url, rodada: null })))
}

export default async function SalaRedesPage() {
  const sala = getSala()
  const [redes, conexoes, padroes, aprendizados, pecas, regras] = await Promise.all([
    sala.redes(),
    sala.conexoes(),
    sala.padroes(),
    sala.aprendizados(),
    sala.pecas(),
    sala.regras(),
  ])

  const conexoesPorId = new Map(conexoes.map((c) => [c.id, c]))
  const redesPorPeca = new Map<string, Rede[]>(pecas.map((p: Peca) => [p.slug, p.redes]))
  const { porRede, gerais } = separarPorRede(aprendizados, redesPorPeca)

  return (
    <div className="space-y-6">
      <SalaHeader
        titulo="Redes"
        descricao="Conta, conexão, últimos posts, capas aprovadas e aprendizados de cada rede."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {redes.map((resumo) => (
          <CartaoRede
            key={resumo.rede}
            resumo={resumo}
            conexao={conexoesPorId.get(resumo.rede) ?? null}
            capas={capasDaRede(padroes, resumo.rede)}
            aprendizados={tresUltimos(porRede.get(resumo.rede) ?? [])}
          />
        ))}
      </div>
      <Aprendizados itens={gerais} titulo="Gerais" />
      <SecaoRegras regrasIniciais={regras} />
    </div>
  )
}
