"use client"

import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BlocoOnboarding } from "@/lib/sala/types"

function formatarResposta(resposta: string | string[] | null | undefined): string {
  if (resposta == null || resposta === "") return "(sem resposta)"
  return Array.isArray(resposta) ? resposta.join(", ") : resposta
}

interface ResumoBlocoProps {
  bloco: BlocoOnboarding
  respostas: Record<string, string | string[] | null>
  carregando: boolean
  erro: string | null
  onGravar: () => void
  onVoltar: () => void
  onAvancar: () => void
}

// Resumo do bloco antes de gravar: mostra cada resposta, o arquivo de destino e o
// botão "Gravar bloco". Depois de gravado mostra o check e libera avançar.
export function ResumoBloco({ bloco, respostas, carregando, erro, onGravar, onVoltar, onAvancar }: ResumoBlocoProps) {
  return (
    <Card className="rounded-md" data-testid="inicio-resumo-bloco">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Resumo do bloco {bloco.numero}: {bloco.titulo}
          {bloco.gravado && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        <ul className="space-y-2">
          {bloco.perguntas.map((pergunta) => (
            <li key={pergunta.id} className="text-sm">
              <span className="text-text-secondary">{pergunta.texto}: </span>
              <span className="text-text-primary">{formatarResposta(respostas[pergunta.id])}</span>
            </li>
          ))}
        </ul>
        {bloco.resumo && <p className="text-sm text-text-secondary">{bloco.resumo}</p>}
        <p className="text-xs text-text-secondary">Arquivo de destino: {bloco.arquivoDestino}</p>
        {erro && <p className="text-sm text-error">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onVoltar}>
            Anterior
          </Button>
          <Button size="sm" onClick={onGravar} disabled={carregando}>
            {bloco.gravado ? "Gravar de novo" : "Gravar bloco"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onAvancar}>
            {bloco.numero === 7 ? "Ver fechamento" : "Próximo bloco"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
