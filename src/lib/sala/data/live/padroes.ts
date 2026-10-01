// Padrões visuais no provedor live (Tarefa A3): reaproveita o parser compartilhado de
// clients/{slug}/design-system.md (fontes/padroes). Ligar exemplo real de peça (artefatoIds
// -> asset) é a Tarefa B3, quando a rota /api/sala/asset existir.
import { lerPadroesDoDesignSystem } from "@/lib/sala/fontes"

export async function lerPadroesLive(cliente: string) {
  return lerPadroesDoDesignSystem(cliente)
}
