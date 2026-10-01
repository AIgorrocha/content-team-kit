"use client"

import { CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ClienteDisponivel { slug: string; nome: string }
export interface ClienteAtivo { slug: string; nome: string; disponiveis: ClienteDisponivel[] }

interface EscolhaClienteProps {
  cliente: ClienteAtivo
  onEscolher: (slug: string) => void
}

// Primeiro bloco do Início (Batelada B1): escolhe o cliente ativo da Sala. A escolha vale
// pra toda a Sala (cookie sala_cliente): filtros por client_slug no banco e leitura de
// clients/{slug}/. No mock só existe 1 cliente disponível (o do seed), sempre marcado.
export function EscolhaCliente({ cliente, onEscolher }: EscolhaClienteProps) {
  return (
    <Card className="rounded-md" id="escolha-cliente" data-testid="inicio-escolha-cliente">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Escolha o cliente</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cliente.disponiveis.map((c) => {
            const ativo = c.slug === cliente.slug
            return (
              <button
                key={c.slug}
                type="button"
                data-testid={`cliente-card-${c.slug}`}
                aria-pressed={ativo}
                onClick={() => !ativo && onEscolher(c.slug)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  ativo
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover"
                )}
              >
                <span>{c.nome}</span>
                {ativo && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
