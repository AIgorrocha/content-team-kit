"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import type { Etapa, Peca, Rede } from "@/lib/sala/types"
import { ETAPAS } from "@/lib/sala/types"

interface AcoesAprovacaoProps {
  peca: Peca
  onAprovado: (pecaAtualizada: Peca) => void
}

// Seletores de etapa/rede/revisão + os dois botões de decisão do dono da conta sobre a etapa
// atual da peça. Ao aprovar ou pedir ajuste, chama a rota e devolve a peça atualizada
// (etapaAtual pode ter mudado: quem decide mover o cartão de coluna é o pai).
export function AcoesAprovacao({ peca, onAprovado }: AcoesAprovacaoProps) {
  const etapasAplicaveis = useMemo(() => peca.etapas.filter((e) => e.status !== "nao_se_aplica"), [peca.etapas])
  const numerosEtapa = useMemo(
    () => Array.from(new Set(etapasAplicaveis.map((e) => e.etapa))).sort((a, b) => a - b),
    [etapasAplicaveis]
  )
  const revisaoMaisRecente = peca.revisoes[peca.revisoes.length - 1] ?? null

  const [etapaSelecionada, setEtapaSelecionada] = useState<Etapa>(
    numerosEtapa.includes(peca.etapaAtual) ? peca.etapaAtual : numerosEtapa[0]
  )
  const redesDaEtapa = useMemo(
    () => etapasAplicaveis.filter((e) => e.etapa === etapaSelecionada).map((e) => e.rede),
    [etapasAplicaveis, etapaSelecionada]
  )
  const [redeSelecionada, setRedeSelecionada] = useState<Rede | null>(redesDaEtapa[0] ?? null)
  const [revisaoId, setRevisaoId] = useState(revisaoMaisRecente?.id ?? "")
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState<"aprovar" | "ajuste" | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // "Pedir ajuste" cria uma revisão nova sem mudar a etapa atual, então o `key={peca.etapaAtual}`
  // do pai não remonta este componente. Ressincroniza o padrão pra revisão mais recente sempre
  // que o número de revisões mudar (o usuário ainda pode trocar manualmente depois).
  useEffect(() => {
    setRevisaoId(revisaoMaisRecente?.id ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peca.revisoes.length])

  function mudarEtapa(novaEtapa: Etapa) {
    setEtapaSelecionada(novaEtapa)
    const redes = etapasAplicaveis.filter((e) => e.etapa === novaEtapa).map((e) => e.rede)
    setRedeSelecionada(redes[0] ?? null)
  }

  async function enviar(acao: "aprovar" | "ajuste") {
    if (acao === "ajuste" && !motivo.trim()) return
    if (!revisaoId) return
    setEnviando(acao)
    setErro(null)
    try {
      const resp = await fetch(`/api/sala/pecas/${peca.slug}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapa: etapaSelecionada,
          rede: redeSelecionada,
          revisaoId,
          acao,
          motivo: acao === "ajuste" ? motivo.trim() : undefined,
        }),
      })
      const dados = await resp.json()
      if (!resp.ok) {
        setErro(dados.erro ?? "erro ao processar a decisão")
        return
      }
      setMotivo("")
      onAprovado(dados.peca as Peca)
    } catch {
      setErro("falha de rede ao enviar a decisão")
    } finally {
      setEnviando(null)
    }
  }

  const revisaoAntiga = revisaoMaisRecente != null && revisaoId !== revisaoMaisRecente.id

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Etapa
          <Select
            value={etapaSelecionada}
            onChange={(e) => mudarEtapa(Number(e.target.value) as Etapa)}
          >
            {numerosEtapa.map((numero) => (
              <option key={numero} value={numero}>
                {numero}. {ETAPAS[numero]}
              </option>
            ))}
          </Select>
        </label>
        {redesDaEtapa.length > 0 && redesDaEtapa[0] !== null && (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Rede
            <Select value={redeSelecionada ?? ""} onChange={(e) => setRedeSelecionada(e.target.value as Rede)}>
              {redesDaEtapa.map((rede) => (
                <option key={rede} value={rede ?? ""}>
                  {rede}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Revisão
          <Select value={revisaoId} onChange={(e) => setRevisaoId(e.target.value)}>
            {peca.revisoes.length === 0 && <option value="">Sem revisão</option>}
            {[...peca.revisoes].reverse().map((revisao) => (
              <option key={revisao.id} value={revisao.id}>
                Revisão {revisao.numero}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {revisaoAntiga && (
        <p className="text-xs text-warning">Existe revisão mais nova.</p>
      )}
      {erro && <p className="text-xs text-error">{erro}</p>}

      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo do ajuste (obrigatório pra pedir ajuste)"
        className="min-h-[70px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      />

      <div className="flex gap-2">
        <Button onClick={() => enviar("aprovar")} disabled={enviando !== null || !revisaoId}>
          Aprovar
        </Button>
        <Button
          variant="outline"
          onClick={() => enviar("ajuste")}
          disabled={enviando !== null || !motivo.trim()}
        >
          Pedir ajuste
        </Button>
      </div>
    </div>
  )
}
