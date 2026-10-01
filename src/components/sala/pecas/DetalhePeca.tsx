"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import { LABEL_REDE, LABEL_STATUS_ETAPA, LABEL_STATUS_PUBLICACAO, VARIANTE_STATUS_PUBLICACAO } from "@/lib/sala/rotulos"
import { ETAPAS, type Peca } from "@/lib/sala/types"
import { GaleriaArtefatos } from "./GaleriaArtefatos"
import { TextosPeca } from "./TextosPeca"
import { Revisoes } from "./Revisoes"
import { AcoesAprovacao } from "./AcoesAprovacao"
import { RecortesPeca } from "./recortes/RecortesPeca"

interface DetalhePecaProps {
  slug: string | null
  onFechar: () => void
  onPecaMudou: (pecaAtualizada: Peca) => void
}

// Painel lateral (Dialog do Radix, ancorado à direita) com o detalhe completo de uma
// peça: prévias, textos, revisões, etapas, publicações, pendências, e as ações de
// aprovação no rodapé.
export function DetalhePeca({ slug, onFechar, onPecaMudou }: DetalhePecaProps) {
  const [peca, setPeca] = useState<Peca | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setPeca(null)
      return
    }
    let cancelado = false
    setPeca(null)
    setCarregando(true)
    setErro(null)
    fetch(`/api/sala/pecas/${slug}`)
      .then((r) => r.json())
      .then((dados) => {
        if (cancelado) return
        if (dados.erro) setErro(dados.erro)
        else setPeca(dados.peca as Peca)
      })
      .catch(() => {
        if (!cancelado) setErro("falha de rede ao carregar a peça")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [slug])

  return (
    <Dialog.Root open={slug !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto border-l border-border bg-surface p-5 focus-visible:outline-none">
          <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border pb-4">
            <div className="min-w-0">
              <Dialog.Title className="break-words text-lg font-semibold leading-tight text-text-primary">{peca?.titulo ?? "Detalhe da peça"}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-text-secondary">
                {peca ? `${peca.slug}, etapa atual: ${peca.etapaAtual}. ${ETAPAS[peca.etapaAtual]}` : "Informações, textos e aprovação da peça."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" />
              <span>Fechar</span>
            </Dialog.Close>
          </div>
          {carregando && <p className="text-sm text-text-secondary">Carregando peça...</p>}
          {erro && <p className="rounded-md border border-error/40 bg-error/10 p-3 text-sm text-error">{erro}</p>}
          {peca && (
            <>
              <Tabs defaultValue="previas">
                <div className="overflow-x-auto">
                  <TabsList>
                    <TabsTrigger className="shrink-0" value="previas">Prévias</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="textos">Textos</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="revisoes">Revisões</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="etapas">Etapas</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="publicacoes">Publicações</TabsTrigger>
                    <TabsTrigger className="shrink-0" value="pendencias">Pendências</TabsTrigger>
                    {peca.tipo === "youtube_longo" && (
                      <TabsTrigger className="shrink-0" value="recortes">Recortes</TabsTrigger>
                    )}
                  </TabsList>
                </div>
                <TabsContent value="previas">
                  <GaleriaArtefatos artefatos={peca.artefatos} />
                </TabsContent>
                <TabsContent value="textos">
                  <TextosPeca artefatos={peca.artefatos} />
                </TabsContent>
                <TabsContent value="revisoes">
                  <Revisoes revisoes={peca.revisoes} artefatos={peca.artefatos} />
                </TabsContent>
                <TabsContent value="etapas">
                  <ul className="flex flex-col gap-2">
                    {peca.etapas.map((estado, indice) => (
                      <li
                        key={`${estado.etapa}-${estado.rede ?? "geral"}-${indice}`}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text-primary">
                            {estado.etapa}. {ETAPAS[estado.etapa]}
                            {estado.rede ? ` (${estado.rede})` : ""}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {LABEL_STATUS_ETAPA[estado.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          Dono: {estado.dono ?? "sem dono"}. Revisão: {estado.revisaoId ?? "nenhuma"}
                        </p>
                        {estado.motivoAjuste && (
                          <p className="mt-1 text-xs text-warning">Motivo do ajuste: {estado.motivoAjuste}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                <TabsContent value="publicacoes">
                  {peca.publicacoes.length === 0 ? (
                    <p className="text-sm text-text-secondary">Ainda sem publicação registrada.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {peca.publicacoes.map((pub, indice) => (
                        <li key={`${pub.rede}-${indice}`} className="rounded-md border border-border bg-background p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-text-primary">{LABEL_REDE[pub.rede]}</p>
                            <Badge variant={VARIANTE_STATUS_PUBLICACAO[pub.status]} className="text-[10px]">
                              {LABEL_STATUS_PUBLICACAO[pub.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            {pub.publicadoEm
                              ? `Publicado em ${formatDateTime(pub.publicadoEm)}`
                              : pub.agendadoPara
                                ? `Agendado para ${formatDateTime(pub.agendadoPara)}`
                                : "Sem data"}
                          </p>
                          {pub.url && (
                            <a
                              href={pub.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              Ver publicação
                            </a>
                          )}
                          {pub.automacaoComentario?.ativa && (
                            <p className="mt-1 text-xs text-text-secondary">
                              Automação de comentário ativa{pub.automacaoComentario.palavra ? ` (palavra: ${pub.automacaoComentario.palavra})` : ""}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
                <TabsContent value="pendencias">
                  {peca.pendenciasHumanas.length === 0 ? (
                    <p className="text-sm text-text-secondary">Sem pendências.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5">
                      {peca.pendenciasHumanas.map((pendencia, indice) => (
                        <li key={indice} className="text-sm text-text-secondary">
                          {pendencia}
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
                {peca.tipo === "youtube_longo" && (
                  <TabsContent value="recortes">
                    <RecortesPeca slug={peca.slug} />
                  </TabsContent>
                )}
              </Tabs>

              <AcoesAprovacao
                key={peca.etapaAtual}
                peca={peca}
                onAprovado={(pecaAtualizada) => {
                  setPeca(pecaAtualizada)
                  onPecaMudou(pecaAtualizada)
                }}
              />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
