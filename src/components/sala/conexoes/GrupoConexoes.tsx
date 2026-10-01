import type { Conexao } from "@/lib/sala/types"
import { CartaoConexao } from "./CartaoConexao"

interface GrupoConexoesProps {
  titulo: string
  conexoes: Conexao[]
}

export function GrupoConexoes({ titulo, conexoes }: GrupoConexoesProps) {
  if (conexoes.length === 0) return null

  return (
    <section aria-labelledby={`grupo-conexoes-${titulo}`}>
      <h2 id={`grupo-conexoes-${titulo}`} className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        {titulo}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conexoes.map((conexao) => (
          <CartaoConexao key={conexao.id} conexao={conexao} />
        ))}
      </div>
    </section>
  )
}
// ponytail: o grupo some por completo quando vazio (nunca acontece hoje: o cenário
// genérico sempre lista as 7 redes + infra + MCP como "ainda não conectado"), em vez de
// mostrar um título com zero cartões embaixo. Se um dia existir categoria sem nenhuma
// conexão cadastrada, trocar o `return null` acima por uma mensagem tipo "Nenhuma conexão
// desta categoria ainda.".
