"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LABEL_REDE, LABEL_STATUS_ETAPA, LABEL_STATUS_PUBLICACAO, LABEL_TIPO, VARIANTE_STATUS_PUBLICACAO } from "@/lib/sala/rotulos"
import type { Peca } from "@/lib/sala/types"

interface RecortesPecaProps {
  slug: string
}

interface TrilhaResposta {
  mae: Peca
  filhos: Peca[]
}

interface CartaoPecaRecorteProps {
  peca: Peca
  mae?: boolean
  onAbrir: (slug: string) => void
}

function CartaoPecaRecorte({ peca, mae = false, onAbrir }: CartaoPecaRecorteProps) {
  const publicacao = peca.publicacoes[0]
  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(peca.slug)}
        aria-label={`Abrir peça: ${peca.titulo}`}
        className="flex w-full min-w-0 items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className={`shrink-0 overflow-hidden rounded bg-surface ${mae ? "h-16 w-24" : "h-16 w-10"}`}>
          {peca.capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={peca.capaUrl} alt={`Capa de ${peca.titulo}`} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-secondary">sem capa</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-text-primary">{peca.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {mae ? "Peça mãe" : LABEL_TIPO[peca.tipo]}
            </Badge>
            {peca.redes.map((rede) => (
              <Badge key={rede} variant="secondary" className="text-[10px]">
                {LABEL_REDE[rede]}
              </Badge>
            ))}
            <Badge variant={publicacao ? VARIANTE_STATUS_PUBLICACAO[publicacao.status] : "secondary"} className="text-[10px]">
              {publicacao ? LABEL_STATUS_PUBLICACAO[publicacao.status] : LABEL_STATUS_ETAPA[peca.statusEtapa]}
            </Badge>
          </div>
        </div>
      </button>
    </li>
  )
}

// Aba "Recortes" do detalhe da peça youtube_longo (Batelada B4): mostra a árvore que antes
// vivia na tela Trilha (mãe + recortes/filhos) e o botão que pede o corte novo pra skill
// ct-openshorts. A geração em si roda no terminal; aqui só registra o pedido.
export function RecortesPeca({ slug }: RecortesPecaProps) {
  const router = useRouter()
  const [trilha, setTrilha] = useState<TrilhaResposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [pedindo, setPedindo] = useState(false)
  const [mensagemPedido, setMensagemPedido] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    setErro(null)
    fetch(`/api/sala/trilha/${slug}`)
      .then((r) => r.json())
      .then((dados) => {
        if (cancelado) return
        if (dados.erro) setErro(dados.erro)
        else setTrilha(dados as TrilhaResposta)
      })
      .catch(() => {
        if (!cancelado) setErro("falha de rede ao carregar os recortes")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [slug])

  async function gerarRecortes() {
    setPedindo(true)
    setMensagemPedido(null)
    try {
      const resp = await fetch(`/api/sala/pecas/${slug}/recortes`, {
        method: "POST",
      })
      const dados = await resp.json()
      setMensagemPedido(resp.ok ? (dados.mensagem ?? "Pedido enviado ao terminal") : (dados.erro ?? "erro ao pedir os recortes"))
    } catch {
      setMensagemPedido("falha de rede ao pedir os recortes")
    } finally {
      setPedindo(false)
    }
  }

  function abrirPeca(slugPeca: string) {
    router.push(`/sala/pecas?peca=${slugPeca}`)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Recortes deste vídeo</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">Abra a peça mãe ou um recorte para consultar seus detalhes.</p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" onClick={gerarRecortes} disabled={pedindo}>
          {pedindo ? "Enviando..." : "Gerar recortes"}
        </Button>
      </div>
      {mensagemPedido && (
        <p role="status" className="text-sm text-success">
          {mensagemPedido}
        </p>
      )}
      {erro && <p className="rounded-md border border-error/40 bg-error/10 p-3 text-sm text-error">{erro}</p>}
      {carregando && !trilha && !erro && <p className="text-sm text-text-secondary">Carregando recortes...</p>}
      {trilha && (
        <div className="flex min-w-0 flex-col gap-4">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Peça mãe</h3>
            <ul>
              <CartaoPecaRecorte peca={trilha.mae} mae onAbrir={abrirPeca} />
            </ul>
          </section>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-secondary">Recortes e peças filhas</h3>
              <span className="text-xs text-text-secondary">{trilha.filhos.length}</span>
            </div>
            {trilha.filhos.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-sm text-text-secondary">Nenhum recorte gerado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {trilha.filhos.map((filho) => (
                  <CartaoPecaRecorte key={filho.slug} peca={filho} onAbrir={abrirPeca} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
