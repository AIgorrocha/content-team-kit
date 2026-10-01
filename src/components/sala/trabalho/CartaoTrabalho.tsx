import { Badge } from "@/components/ui/badge"
import type { CartaoTrabalho as CartaoTrabalhoTipo } from "@/lib/sala/types"

interface CartaoTrabalhoProps {
  cartao: CartaoTrabalhoTipo
  agora: string
  onClick: () => void
  // Cor da coluna (bg-*) pro pontinho no rodapé do cartão, mesmo padrão do desenho B12.
  cor?: string
}

const NOME_FAMILIA: Record<NonNullable<CartaoTrabalhoTipo["familia"]>, string> = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok",
  kimi: "Kimi",
}

function formatarRelativo(iso: string | null, agora: string): string {
  if (!iso) return "sem atividade registrada"
  const diffMs = new Date(agora).getTime() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffDias = Math.round(diffH / 24)
  return `há ${diffDias} dia${diffDias === 1 ? "" : "s"}`
}

// Cartão de um agente no kanban de Trabalho (Batelada B3). Clique abre o mesmo painel de
// detalhe que a antiga tela Time usava (DetalheAgente, com prompt/contexto/memória).
export function CartaoTrabalho({ cartao, agora, onClick, cor = "bg-accent" }: CartaoTrabalhoProps) {
  const terminal = cartao.agente.startsWith("terminal-")
  const alias = cartao.apelido.startsWith("Alias ")
  const Elemento = terminal || alias ? "div" : "button"
  return (
    <Elemento
      type={terminal || alias ? undefined : "button"}
      onClick={terminal || alias ? undefined : onClick}
      data-testid="cartao-trabalho"
      data-agente={cartao.agente}
      className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-text-primary">{cartao.apelido.replace(/^Alias /, "Tarefa: ")}</p>
        {cartao.familia && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {NOME_FAMILIA[cartao.familia]}{cartao.modelo ? ` ${cartao.modelo}` : ""}
          </Badge>
        )}
      </div>
      <p className="truncate text-xs text-text-secondary">{cartao.tarefa ?? "Sem tarefa em andamento"}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-text-secondary">{formatarRelativo(cartao.desde, agora)}</p>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cor}`} aria-hidden="true" />
      </div>
    </Elemento>
  )
}
