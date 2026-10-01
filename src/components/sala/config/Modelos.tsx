import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Configuracao } from "@/lib/sala/types"

const NOME_FAMILIA: Record<Configuracao["modelos"][number]["familia"], string> = {
  claude: "Claude",
  codex: "Codex",
  grok: "Grok",
}

interface ModelosProps {
  modelos: Configuracao["modelos"]
}

// Somente leitura na Fase 1: a escada de modelo por família (condutor, subagente,
// esforço) é editável só na Fase 2.
export function Modelos({ modelos }: ModelosProps) {
  return (
    <Card className="rounded-md" data-testid="config-modelos">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Modelos</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-secondary">
                <th className="pb-2 pr-3 font-medium">Família</th>
                <th className="pb-2 pr-3 font-medium">Condutor</th>
                <th className="pb-2 pr-3 font-medium">Subagente</th>
                <th className="pb-2 font-medium">Esforço</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr key={m.familia} className="border-t border-border">
                  <td className="py-2 pr-3 text-text-primary">{NOME_FAMILIA[m.familia]}</td>
                  <td className="py-2 pr-3 text-text-primary">{m.condutor}</td>
                  <td className="py-2 pr-3 text-text-secondary">{m.subagente ?? "sem subagente"}</td>
                  <td className="py-2 text-text-secondary">{m.esforco}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-secondary">Configuração dos agentes instalados nesta máquina.</p>
      </CardContent>
    </Card>
  )
}
