import type { CartaoTrabalho } from "@/lib/sala/types"

const AGENTES_ADS = new Set([
  "ct-ads-audit",
  "ct-ads-conversion-audit",
  "ct-ads-creative-audit",
  "ct-ads-budget-audit",
  "ct-ads-account-structure-audit",
])

const AGENTES_BRIDGE = new Set([
  "ct-video-higgsfield",
  "ct-video-remotion",
  "ct-video-mpt",
  "ct-video-hypit",
  "ct-video-editor",
])

export type GrupoCartoesId = "conteudo" | "anuncios" | "integracoes" | "aliases"

export interface GrupoCartoes {
  id: GrupoCartoesId
  titulo: string
  descricao: string
  cartoes: CartaoTrabalho[]
}

function grupoDoCartao(cartao: CartaoTrabalho): GrupoCartoesId {
  if (cartao.apelido.startsWith("Alias ") || cartao.agente.startsWith("terminal-")) return "aliases"
  if (AGENTES_ADS.has(cartao.agente)) return "anuncios"
  if (AGENTES_BRIDGE.has(cartao.agente)) return "integracoes"
  return "conteudo"
}

const METADADOS_GRUPO: Record<GrupoCartoesId, Omit<GrupoCartoes, "cartoes">> = {
  conteudo: {
    id: "conteudo",
    titulo: "Conteúdo e operação",
    descricao: "Planejamento, pesquisa, criação e acompanhamento do conteúdo.",
  },
  anuncios: {
    id: "anuncios",
    titulo: "Anúncios",
    descricao: "Um coordenador e quatro especialistas: conversão, criativos, orçamento e campanhas.",
  },
  integracoes: {
    id: "integracoes",
    titulo: "Integrações especializadas",
    descricao: "Ferramentas de vídeo, animação e pesquisa no Drive.",
  },
  aliases: {
    id: "aliases",
    titulo: "Outros trabalhos do terminal",
    descricao: "Tarefas recebidas dos terminais conectados à Sala.",
  },
}

export function agruparCartoesTrabalho(cartoes: CartaoTrabalho[]): GrupoCartoes[] {
  const porGrupo = new Map<GrupoCartoesId, CartaoTrabalho[]>()
  for (const cartao of cartoes) {
    const id = grupoDoCartao(cartao)
    porGrupo.set(id, [...(porGrupo.get(id) ?? []), cartao])
  }

  return (Object.keys(METADADOS_GRUPO) as GrupoCartoesId[])
    .filter((id) => porGrupo.has(id))
    .map((id) => ({ ...METADADOS_GRUPO[id], cartoes: porGrupo.get(id)! }))
}
