"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { BlocoOnboarding } from "@/lib/sala/types"
import { ResumoBloco } from "./ResumoBloco"

type Resposta = string | string[] | null

interface BlocoProps {
  bloco: BlocoOnboarding
  onBlocoAtualizado: (bloco: BlocoOnboarding) => void
  onVoltarBloco: () => void
  onAvancarBloco: () => void
}

// Uma pergunta por vez do bloco atual. Ao chegar na última pergunta, mostra o
// ResumoBloco com o botão "Gravar bloco".
export function Bloco({ bloco, onBlocoAtualizado, onVoltarBloco, onAvancarBloco }: BlocoProps) {
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [modoMultiplo, setModoMultiplo] = useState<Record<string, boolean>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conflito, setConflito] = useState(false)

  useEffect(() => {
    setIndice(0)
    setErro(null)
    const iniciais: Record<string, Resposta> = {}
    const modos: Record<string, boolean> = {}
    for (const pergunta of bloco.perguntas) {
      iniciais[pergunta.id] = pergunta.tipo === "lista" && !Array.isArray(pergunta.resposta) ? [] : (pergunta.resposta ?? null)
      modos[pergunta.id] = Array.isArray(pergunta.resposta)
    }
    setRespostas(iniciais)
    setModoMultiplo(modos)
  }, [bloco.numero])

  const pergunta = bloco.perguntas[indice]
  const naResumo = indice >= bloco.perguntas.length

  async function gravar() {
    setCarregando(true)
    setErro(null)
    setConflito(false)
    try {
      // "lista" vai sem linha em branco; o resto vai como está.
      const corpo: Record<string, unknown> = {}
      for (const [id, valor] of Object.entries(respostas)) {
        corpo[id] = Array.isArray(valor) ? valor.filter((v) => v.trim() !== "") : valor
      }
      const resp = await fetch(`/api/sala/onboarding/${bloco.numero}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas: corpo, hash: bloco.baseHash }),
      })
      const dados = await resp.json()
      if (!resp.ok) {
        if (resp.status === 409) setConflito(true)
        throw new Error(dados.erro ?? "erro ao gravar o bloco")
      }
      onBlocoAtualizado(dados.bloco as BlocoOnboarding)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro desconhecido")
    } finally {
      setCarregando(false)
    }
  }

  // Só o usuário decide recarregar e repetir; nunca reenviamos sozinhos com hash novo.
  async function recarregar() {
    setCarregando(true)
    try {
      const resp = await fetch("/api/sala/onboarding")
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro ?? "erro ao recarregar o onboarding")
      const atualizado = (dados.blocos as BlocoOnboarding[]).find((b) => b.numero === bloco.numero)
      if (atualizado) {
        onBlocoAtualizado(atualizado)
        setRespostas(Object.fromEntries(atualizado.perguntas.map((p) => [p.id, p.resposta ?? null])))
        setIndice(0)
      }
      setErro(null)
      setConflito(false)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro ao recarregar o onboarding")
    } finally {
      setCarregando(false)
    }
  }

  if (naResumo) {
    return (
      <div className="space-y-3">
        {conflito && (
          <div className="space-y-2 rounded-md border border-error/50 bg-error/5 p-3 text-sm text-error" role="alert">
            <p>{erro}</p>
            <Button variant="outline" size="sm" onClick={recarregar} disabled={carregando}>
              Recarregar onboarding
            </Button>
          </div>
        )}
        <ResumoBloco
          bloco={bloco}
          respostas={respostas}
          carregando={carregando}
          erro={conflito ? null : erro}
          onGravar={gravar}
          onVoltar={() => setIndice(bloco.perguntas.length - 1)}
          onAvancar={onAvancarBloco}
        />
      </div>
    )
  }

  return (
    <Card className="rounded-md" data-testid="inicio-bloco">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">
          Bloco {bloco.numero}: {bloco.titulo} ({indice + 1}/{bloco.perguntas.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {bloco.origem === "arquivo" && !bloco.gravado && (
          <p className="rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
            Preenchido a partir dos seus arquivos; confira e grave.
          </p>
        )}

        {bloco.numero === 5 && (
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Disponível na Fase 2"
            aria-label="Extrair paleta do site, disponível na Fase 2"
          >
            Extrair paleta do site
          </Button>
        )}

        <label className="block text-sm font-medium text-text-primary" htmlFor={`pergunta-${pergunta.id}`}>
          {pergunta.texto}
        </label>

        {pergunta.tipo === "texto" && (
          <textarea
            id={`pergunta-${pergunta.id}`}
            className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={typeof respostas[pergunta.id] === "string" ? (respostas[pergunta.id] as string) : ""}
            onChange={(e) => setRespostas((r) => ({ ...r, [pergunta.id]: e.target.value }))}
          />
        )}

        {pergunta.tipo === "lista" && (
          <textarea
            id={`pergunta-${pergunta.id}`}
            aria-label={`${pergunta.texto} (um item por linha)`}
            className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            placeholder="Um item por linha"
            value={(Array.isArray(respostas[pergunta.id]) ? (respostas[pergunta.id] as string[]) : []).join("\n")}
            onChange={(e) => setRespostas((r) => ({ ...r, [pergunta.id]: e.target.value.split("\n") }))}
          />
        )}

        {pergunta.tipo === "multipla" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={pergunta.texto}>
            {(pergunta.opcoes ?? []).map((opcao) => {
              const valorAtual = respostas[pergunta.id]
              const ativo = modoMultiplo[pergunta.id]
                ? Array.isArray(valorAtual) && valorAtual.includes(opcao)
                : valorAtual === opcao
              return (
                <button
                  key={opcao}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() =>
                    setRespostas((r) => {
                      if (modoMultiplo[pergunta.id]) {
                        const atual = Array.isArray(r[pergunta.id]) ? (r[pergunta.id] as string[]) : []
                        const novo = atual.includes(opcao) ? atual.filter((o) => o !== opcao) : [...atual, opcao]
                        return { ...r, [pergunta.id]: novo }
                      }
                      return { ...r, [pergunta.id]: opcao }
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    ativo
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                  )}
                >
                  {opcao}
                </button>
              )
            })}
          </div>
        )}

        {pergunta.tipo === "arquivo" && (
          <div className="space-y-2">
            <input
              id={`pergunta-${pergunta.id}`}
              type="file"
              accept="image/*"
              className="text-sm text-text-secondary"
              onChange={(e) => {
                const arquivo = e.target.files?.[0]
                if (!arquivo) return
                setRespostas((r) => ({ ...r, [pergunta.id]: arquivo.name }))
                setPreviews((p) => ({ ...p, [pergunta.id]: URL.createObjectURL(arquivo) }))
              }}
            />
            <p className="text-xs text-text-secondary">Só uma prévia local: o arquivo não é enviado nesta fase.</p>
            {previews[pergunta.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previews[pergunta.id]}
                alt={`Prévia local do arquivo enviado para: ${pergunta.texto}`}
                className="h-24 w-24 rounded-md border border-border object-cover"
              />
            )}
          </div>
        )}

        {erro && <p className="text-sm text-error">{erro}</p>}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={indice === 0 && bloco.numero === 0}
            onClick={() => (indice === 0 ? onVoltarBloco() : setIndice((i) => i - 1))}
          >
            Anterior
          </Button>
          <Button size="sm" onClick={() => setIndice((i) => i + 1)}>
            {indice === bloco.perguntas.length - 1 ? "Ver resumo" : "Próxima"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
