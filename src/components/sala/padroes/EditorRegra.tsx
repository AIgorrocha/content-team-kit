"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { Regra, Selo } from "@/lib/sala/types"

const MDEditor = dynamic(() => import("@uiw/react-md-editor").then((mod) => mod.default), { ssr: false })

const OPCOES_SELO: { valor: Selo; rotulo: string }[] = [
  { valor: "REINCIDENTE", rotulo: "Reincidente" },
  { valor: "FIXA", rotulo: "Fixa" },
  { valor: "HIPOTESE", rotulo: "Hipótese" },
  { valor: "MEDIDO", rotulo: "Medido" },
  { valor: "MECANICA", rotulo: "Mecânica" },
]

export interface ResultadoSalvarRegra {
  ok: boolean
  regra?: Regra
  conflito?: { atual: string; hashAtual: string }
  erro?: string
}

interface EditorRegraProps {
  regra: Regra | null
  onFechar: () => void
  onSalvar: (id: string, texto: string, selo: Selo, baseHash: string) => Promise<ResultadoSalvarRegra>
}

// Editor Markdown de uma regra (título, texto integral e selo). 409 mostra as duas
// versões lado a lado e oferece "Recarregar" em vez de sobrescrever sem avisar, mesmo
// padrão do EditorPrompt/DetalheAgente da tela Time.
export function EditorRegra({ regra, onFechar, onSalvar }: EditorRegraProps) {
  const [texto, setTexto] = useState("")
  const [selo, setSelo] = useState<Selo>("REINCIDENTE")
  const [hashBase, setHashBase] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [modoCor, setModoCor] = useState<"light" | "dark">("dark")
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "conflito" | "erro"; texto: string; atual?: string; hashAtual?: string } | null>(null)

  useEffect(() => {
    setModoCor(document.documentElement.classList.contains("light") ? "light" : "dark")
  }, [])

  // Reinicia o rascunho só quando ABRE uma regra (id muda), não a cada re-render depois
  // de salvar: um save bem-sucedido troca a referência de `regra` no pai (mesmo id), e se
  // este efeito reagisse a isso apagaria a mensagem de sucesso que acabou de aparecer.
  useEffect(() => {
    if (!regra) return
    setTexto(regra.texto)
    setSelo(regra.selo)
    setHashBase(regra.hash)
    setMensagem(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regra?.id])

  if (!regra) return null

  async function salvar() {
    if (!regra) return
    setSalvando(true)
    setMensagem(null)
    const resultado = await onSalvar(regra.id, texto, selo, hashBase)
    setSalvando(false)
    if (resultado.conflito) {
      setMensagem({
        tipo: "conflito",
        texto: resultado.erro ?? "a regra mudou desde que foi carregada",
        atual: resultado.conflito.atual,
        hashAtual: resultado.conflito.hashAtual,
      })
      return
    }
    if (!resultado.ok || !resultado.regra) {
      setMensagem({ tipo: "erro", texto: resultado.erro ?? "erro ao salvar a regra" })
      return
    }
    setHashBase(resultado.regra.hash)
    setMensagem({ tipo: "sucesso", texto: "Regra salva (exemplo, ainda não grava no arquivo)" })
  }

  function recarregar() {
    if (!mensagem?.atual || !mensagem.hashAtual) return
    setTexto(mensagem.atual)
    setHashBase(mensagem.hashAtual)
    setMensagem(null)
  }

  return (
    <Dialog.Root open={regra !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-6 focus-visible:outline-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-text-primary">{regra.titulo}</Dialog.Title>
              <Dialog.Description className="font-mono text-xs text-text-secondary">{regra.arquivo}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="rounded-md p-1 text-text-secondary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="selo-regra" className="text-sm text-text-secondary">
              Selo
            </label>
            <Select
              id="selo-regra"
              className="w-44"
              value={selo}
              onChange={(e) => setSelo(e.target.value as Selo)}
              disabled={salvando}
            >
              {OPCOES_SELO.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Select>
          </div>

          <div data-color-mode={modoCor}>
            <MDEditor
              value={texto}
              onChange={(v) => setTexto(v ?? "")}
              height={360}
              preview="live"
              visibleDragbar={false}
              textareaProps={{ disabled: salvando, "aria-label": "Texto da regra em Markdown" }}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={salvar} disabled={salvando || (texto === regra.texto && selo === regra.selo)}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
            {mensagem?.tipo === "sucesso" && <p className="text-sm text-success">{mensagem.texto}</p>}
            {mensagem?.tipo === "erro" && <p className="text-sm text-error">{mensagem.texto}</p>}
          </div>

          {mensagem?.tipo === "conflito" && (
            <div className="rounded-md border border-warning/40 bg-background p-3">
              <p className="text-sm font-medium text-warning">{mensagem.texto}</p>
              <p className="mt-2 text-xs text-text-secondary">Sua versão (ainda não salva):</p>
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-surface p-2 text-xs text-text-primary">
                {texto}
              </pre>
              <p className="mt-2 text-xs text-text-secondary">Versão atual (salva por outra sessão):</p>
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-surface p-2 text-xs text-text-primary">
                {mensagem.atual}
              </pre>
              <Button size="sm" variant="outline" className="mt-2" onClick={recarregar}>
                Recarregar
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
