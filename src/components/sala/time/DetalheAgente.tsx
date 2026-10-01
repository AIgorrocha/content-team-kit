"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import Link from "next/link"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Agente } from "@/lib/sala/types"
import { EditorPrompt } from "./EditorPrompt"
import { ContextoAgente } from "./ContextoAgente"
import { MemoriaAgente } from "./MemoriaAgente"

interface DetalheAgenteProps {
  slug: string | null
  onFechar: () => void
}

interface MensagemSalvar {
  tipo: "sucesso" | "conflito" | "erro"
  texto: string
  atual?: string
  hashAtual?: string
}

const CAPACIDADE_FAMILIA: Record<Agente["familia"], string> = {
  base: "Produção e operação editorial, do planejamento à adaptação por rede.",
  bridge: "Integração com motores e ferramentas especializadas acionadas pelo diretor.",
  ads: "Auditoria especializada de Meta Ads: os cinco subagentes cobrem conversão, criativo, orçamento e estrutura da conta sob coordenação do ct-ads-audit.",
}

function nomeDaSkill(skill: string): string {
  return skill
    .replace(/\s+\[(?:local|cmd|plugin externo)\]$/i, "")
    .replace(/^\{slug\}-/, "cliente: ")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase())
}

// Painel lateral (Dialog do Radix, ancorado à direita) com o detalhe do agente: prompt
// editável, contexto, skills, memória recente e últimas peças.
export function DetalheAgente({ slug, onFechar }: DetalheAgenteProps) {
  const [agente, setAgente] = useState<Agente | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState("")
  const [hashBase, setHashBase] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<MensagemSalvar | null>(null)

  useEffect(() => {
    if (!slug) {
      setAgente(null)
      setMensagem(null)
      return
    }
    let cancelado = false
    setAgente(null)
    setCarregando(true)
    setErro(null)
    setMensagem(null)
    fetch(`/api/sala/agentes/${slug}`)
      .then((r) => r.json())
      .then((dados) => {
        if (cancelado) return
        if (dados.erro) {
          setErro(dados.erro)
        } else {
          const carregado = dados.agente as Agente
          setAgente(carregado)
          setRascunho(carregado.promptMd)
          setHashBase(carregado.promptHash)
        }
      })
      .catch(() => {
        if (!cancelado) setErro("falha de rede ao carregar o agente")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })
    return () => {
      cancelado = true
    }
  }, [slug])

  async function salvar() {
    if (!agente) return
    setSalvando(true)
    setMensagem(null)
    try {
      const resp = await fetch(`/api/sala/agentes/${agente.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptMd: rascunho, baseHash: hashBase }),
      })
      const dados = await resp.json()
      if (resp.status === 409) {
        setMensagem({
          tipo: "conflito",
          texto: dados.erro ?? "o prompt mudou desde que foi carregado",
          atual: dados.atual,
          hashAtual: dados.hashAtual,
        })
        return
      }
      if (!resp.ok) {
        setMensagem({ tipo: "erro", texto: dados.erro ?? "erro ao salvar o prompt" })
        return
      }
      setHashBase(dados.hash)
      setAgente({ ...agente, promptMd: rascunho, promptHash: dados.hash })
      setMensagem({
        tipo: "sucesso",
        texto: dados.sincronizado ? "Salvo no arquivo e sincronizado" : "Salvo (exemplo)",
      })
    } catch {
      setMensagem({ tipo: "erro", texto: "falha de rede ao salvar o prompt" })
    } finally {
      setSalvando(false)
    }
  }

  function recarregar() {
    if (!mensagem?.atual || !mensagem.hashAtual) return
    setRascunho(mensagem.atual)
    setHashBase(mensagem.hashAtual)
    setMensagem(null)
  }

  return (
    <Dialog.Root open={slug !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] min-w-0 flex-col gap-5 overflow-x-hidden overflow-y-auto border-l border-border bg-surface p-5 focus-visible:outline-none">
          <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border pb-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-lg font-semibold text-text-primary">{agente?.nome ?? "Detalhe do agente"}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-text-secondary">{agente ? `${agente.slug}, ${agente.funcao}` : "Informações, prompt e histórico do agente."}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" />
              <span>Fechar</span>
            </Dialog.Close>
          </div>

          {carregando && <p className="text-sm text-text-secondary">Carregando agente...</p>}
          {erro && <p className="rounded-md border border-error/40 bg-error/10 p-3 text-sm text-error">{erro}</p>}
          {agente && (
            <div className="flex min-w-0 flex-col gap-5">
              <section className="rounded-md border border-border bg-background p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">Tarefa atual</h2>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary">{agente.status}</span>
                </div>
                <p className="text-sm leading-relaxed text-text-primary">{agente.tarefaAtual ?? "Sem tarefa em andamento."}</p>
              </section>

              <section className="flex min-w-0 flex-col gap-3">
                <h2 className="text-sm font-semibold text-text-primary">Prompt</h2>
                <div className="min-w-0 overflow-hidden rounded-md border border-border bg-background p-2">
                  <EditorPrompt value={rascunho} onChange={setRascunho} disabled={salvando} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={salvar} disabled={salvando || rascunho === agente.promptMd}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </Button>
                  {mensagem?.tipo === "sucesso" && <p className="text-sm text-success">{mensagem.texto}</p>}
                  {mensagem?.tipo === "erro" && <p className="text-sm text-error">{mensagem.texto}</p>}
                </div>
                {mensagem?.tipo === "conflito" && (
                  <div className="rounded-md border border-warning/40 bg-background p-3">
                    <p className="text-sm font-medium text-warning">{mensagem.texto}</p>
                    <p className="mt-2 text-xs text-text-secondary">Sua versão (ainda não salva):</p>
                    <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-surface p-2 text-xs text-text-primary">{rascunho}</pre>
                    <p className="mt-2 text-xs text-text-secondary">Versão atual (salva por outra sessão):</p>
                    <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-surface p-2 text-xs text-text-primary">{mensagem.atual}</pre>
                    <Button size="sm" variant="outline" className="mt-2" onClick={recarregar}>
                      Recarregar
                    </Button>
                  </div>
                )}
              </section>

              <section className="min-w-0 border-t border-border pt-4">
                <h2 className="mb-2 text-sm font-semibold text-text-primary">Contexto</h2>
                <ContextoAgente arquivos={agente.contexto} />
              </section>

              <section className="min-w-0 border-t border-border pt-4">
                <h2 className="mb-1 text-sm font-semibold text-text-primary">Capacidades</h2>
                <p className="mb-2 text-xs text-text-secondary">{CAPACIDADE_FAMILIA[agente.familia]} Cada skill abaixo é uma capacidade catalogada para este agente.</p>
                {agente.skills.length === 0 ? (
                  <p className="text-sm text-text-secondary">Nenhuma capacidade mapeada pra este agente.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {agente.skills.map((skill) => (
                      <li key={skill} className="rounded-md border border-border bg-background px-2.5 py-2">
                        <p className="text-xs font-medium text-text-primary">{nomeDaSkill(skill)}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-text-secondary">{skill}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="min-w-0 border-t border-border pt-4">
                <h2 className="mb-2 text-sm font-semibold text-text-primary">Memória recente</h2>
                <MemoriaAgente itens={agente.memoriaRecente} />
              </section>

              <section className="min-w-0 border-t border-border pt-4">
                <h2 className="mb-2 text-sm font-semibold text-text-primary">Últimas peças</h2>
                {agente.ultimasPecas.length === 0 ? (
                  <p className="text-sm text-text-secondary">Sem peças recentes pra este agente.</p>
                ) : (
                  <ul className="flex min-w-0 flex-col gap-2">
                    {agente.ultimasPecas.map((slugPeca) => (
                      <li key={slugPeca}>
                        <Link
                          href="/sala/pecas"
                          className="block truncate rounded-md border border-border bg-background p-2 text-sm text-accent hover:bg-surface-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {slugPeca}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
