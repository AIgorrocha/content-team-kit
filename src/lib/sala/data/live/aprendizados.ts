// Aprendizados no provedor live (Tarefa A3): páginas de encerramento no ai-memory (busca
// "encerramento", que é a convenção real de nomeação usada pelo projeto pra essas notas, ver
// notes/*-encerramento.md). Reaproveita o CLI wrapper de agentes.ts (mesmo cache/timeout).
import { type Aprendizado } from "@/lib/sala/types"
import { buscarMemoria } from "./agentes"

export async function lerAprendizadosLive(cliente: string): Promise<Aprendizado[]> {
  const resultados = await buscarMemoria("encerramento", 8, cliente)
  return resultados.map((r) => ({
    data: r.data,
    peca: r.caminho.replace(/^notes\//, "").replace(/-encerramento\.md$/, ""),
    texto: r.titulo,
    fonte: r.caminho,
  }))
}
