"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BlocoOnboarding } from "@/lib/sala/types"
import { Progresso } from "./Progresso"
import { Bloco } from "./Bloco"

// Assistente de onboarding: 8 blocos (0 a 7) do ct-onboarding, uma pergunta por vez,
// com resumo e gravação por bloco. Depois do bloco 7 (ou já na entrada, se todos os
// blocos já estiverem gravados), mostra a tela de fechamento/resumo.
export function AssistenteBlocos() {
  const [blocos, setBlocos] = useState<BlocoOnboarding[] | null>(null)
  const [blocoAtual, setBlocoAtual] = useState<number | null>(0)
  const [erro, setErro] = useState<string | null>(null)
  const primeiraCarga = useRef(true)

  const carregar = useCallback(async () => {
    try {
      const resp = await fetch("/api/sala/onboarding")
      const dados = await resp.json()
      if (!resp.ok) throw new Error(dados.erro ?? "erro ao carregar o onboarding")
      const novosBlocos = dados.blocos as BlocoOnboarding[]
      setBlocos(novosBlocos)
      setErro(null)
      // Cliente que já respondeu tudo abre direto no resumo, não no bloco 0. Só na
      // primeira carga: recarregar depois de gravar um bloco não deve chutar de volta
      // pro resumo no meio de uma edição.
      if (primeiraCarga.current) {
        primeiraCarga.current = false
        setBlocoAtual(novosBlocos.every((b) => b.gravado) ? null : 0)
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro ao carregar o onboarding")
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <p className="text-sm text-error">{erro}</p>
  if (!blocos) return <p className="text-sm text-text-secondary">Carregando onboarding...</p>

  function atualizarBloco(blocoAtualizado: BlocoOnboarding) {
    setBlocos((atual) => atual?.map((b) => (b.numero === blocoAtualizado.numero ? blocoAtualizado : b)) ?? atual)
  }

  const bloco = blocoAtual !== null ? blocos.find((b) => b.numero === blocoAtual) ?? null : null

  const pendenciasVisuais = blocos.flatMap((b) =>
    b.perguntas.filter((p) => p.resposta == null).map((p) => `${b.titulo}: ${p.texto}`)
  )
  const bloco7 = blocos.find((b) => b.numero === 7)
  const integracoesFaltando = (bloco7?.perguntas ?? [])
    .filter((p) => p.resposta && p.resposta !== "ligada")
    .map((p) => `${p.texto.replace(": já tem as chaves?", "")}: ${p.resposta}`)
  const arquivosCriados = Array.from(new Set(blocos.filter((b) => b.gravado).map((b) => b.arquivoDestino)))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <Progresso blocos={blocos} blocoAtual={blocoAtual} onSelecionar={setBlocoAtual} />

      {bloco ? (
        <Bloco
          key={bloco.numero}
          bloco={bloco}
          onBlocoAtualizado={atualizarBloco}
          onVoltarBloco={() => setBlocoAtual((n) => (n !== null && n > 0 ? n - 1 : n))}
          onAvancarBloco={() => setBlocoAtual((n) => (n !== null && n < 7 ? n + 1 : null))}
        />
      ) : (
        <Card className="rounded-md" data-testid="inicio-fechamento">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Fechamento do onboarding</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-text-primary">O que foi criado</h3>
              {arquivosCriados.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum bloco gravado ainda.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {arquivosCriados.map((arquivo) => (
                    <li key={arquivo} className="text-sm text-text-secondary">
                      {arquivo}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-text-primary">[HIPÓTESE] pendentes</h3>
              {pendenciasVisuais.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma pendência sem resposta.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {pendenciasVisuais.map((item) => (
                    <li key={item} className="text-sm text-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-text-primary">Integrações que faltam</h3>
              {integracoesFaltando.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma, todas as redes citadas já estão ligadas.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5">
                  {integracoesFaltando.map((item) => (
                    <li key={item} className="text-sm text-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm font-medium text-text-primary">Nada é publicado sem o seu pode.</p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBlocoAtual(7)}>
                Voltar pro bloco 7
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBlocoAtual(0)}>
                Editar blocos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("escolha-cliente")?.scrollIntoView({ behavior: "smooth" })}
              >
                Trocar cliente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
