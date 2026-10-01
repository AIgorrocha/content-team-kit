// Parser de clients/{slug}/design-system.md em PadraoVisual[], compartilhado pelo mock e
// pelo provedor live (Tarefa A2). Cada heading H2/H3/H4 cujo titulo bate com uma palavra-chave
// vira um padrao daquele tipo de peca; os itens de lista (bullet) do corpo viram `regras`.
// Sem exemplos ainda (a Tarefa A3/B3 liga exemplo real via fontes/pecas-disco + asset).
import { type PadraoVisual, type Rede, type TipoPeca } from "@/lib/sala/types"
import { caminhoCliente } from "./cliente"
import { lerArquivo } from "./arquivos"

const MAPA_TIPO: Array<{ chave: string; tipo: TipoPeca }> = [
  { chave: "Capa 9:16", tipo: "capa" },
  { chave: "Thumbnail", tipo: "youtube_longo" },
  { chave: "Carrossel", tipo: "carrossel" },
  { chave: "Story", tipo: "story" },
  { chave: "Legenda", tipo: "reel" },
  { chave: "LinkedIn", tipo: "post_linkedin" },
]

// Rede de cada tipo de peça (Batelada B5), usada pra ligar padrão visual e capa aprovada à
// rede certa em /sala/redes. Pura, sem I/O: usada aqui e pelo mock (data/mock/index.ts).
export function redeDoTipo(tipo: TipoPeca): Rede | null {
  switch (tipo) {
    case "reel":
    case "reel_faceless":
    case "carrossel":
    case "story":
    case "capa":
      return "instagram"
    case "post_linkedin":
      return "linkedin"
    case "youtube_longo":
    case "recorte":
      return "youtube"
    case "email":
      return "email"
    default:
      return null
  }
}

export function lerPadroesDoDesignSystem(cliente: string): PadraoVisual[] {
  const arquivo = caminhoCliente(cliente, "design-system.md")
  const raw = lerArquivo(arquivo)
  if (!raw) return []
  const linhas = raw.split(/\r?\n/)
  const padroes: PadraoVisual[] = []

  for (let i = 0; i < linhas.length; i++) {
    const heading = linhas[i].match(/^(#{2,4})\s+(.+)$/)
    if (!heading) continue
    const titulo = heading[2].trim()
    const casado = MAPA_TIPO.find((m) => titulo.includes(m.chave))
    if (!casado) continue
    const nivel = heading[1].length
    const regras: string[] = []
    for (let j = i + 1; j < linhas.length; j++) {
      const proxHeading = linhas[j].match(/^(#{1,6})\s+/)
      if (proxHeading && proxHeading[1].length <= nivel) break
      const bullet = linhas[j].match(/^\s*[-*]\s+(.+)/)
      if (bullet) regras.push(bullet[1].trim())
    }
    padroes.push({ tipoConteudo: casado.tipo, rede: redeDoTipo(casado.tipo), titulo, regras, exemplos: [], arquivo })
  }
  return padroes
}
