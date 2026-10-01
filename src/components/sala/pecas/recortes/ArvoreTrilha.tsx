"use client"

import { useEffect, useMemo, useRef } from "react"
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { NoPeca, type DadosNoPeca } from "./NoPeca"
import { cn } from "@/lib/utils"
import type { Peca } from "@/lib/sala/types"

const NODE_TYPES = { peca: NoPeca }

const LARGURA_MAE = 260
const ALTURA_MAE = 230
const LARGURA_FILHO = 220
const ALTURA_FILHO = 140
// A árvore é sempre mãe + uma fileira de filhos (2 níveis), então a altura do canvas é
// constante: mãe + espaço do dagre (ranksep) + filho + margem.
const ALTURA_CANVAS = 480
// Abaixo do breakpoint sm, trava uma largura mínima legível e deixa o container externo
// rolar; a partir do sm, remove o piso e deixa o fitView encolher a árvore pra caber
// inteira na coluna do dashboard (evita corte nas pontas em 1280px com muitos filhos).
const LARGURA_MINIMA_MOBILE = "min-w-[640px] sm:min-w-0"

// Ordem de rede usada na produção: Reel IG, TikTok, Short (YouTube), Carrossel, LinkedIn.
// Filho planejado (sem rede definida ainda) vai por último, na ordem em que foi criado.
function familiaDoFilho(peca: Peca): number {
  if (peca.tipo === "carrossel") return 3
  if (peca.tipo === "post_linkedin" || peca.redes.includes("linkedin")) return 4
  if (peca.redes.includes("instagram")) return 0
  if (peca.redes.includes("tiktok")) return 1
  if (peca.redes.includes("youtube")) return 2
  return 5
}

function ehPlanejado(peca: Peca): boolean {
  return peca.artefatos.length === 0 && peca.publicacoes.length === 0
}

interface ArvoreTrilhaProps {
  mae: Peca
  filhos: Peca[]
}

// Árvore da Trilha: mãe (youtube_longo) no topo, filhos por rede embaixo, layout
// calculado com dagre (top-down). ponytail: sem drag/zoom por scroll, é só leitura.
export function ArvoreTrilha({ mae, filhos }: ArvoreTrilhaProps) {
  const { nodes, edges } = useMemo(() => {
    const filhosOrdenados = [...filhos].sort((a, b) => familiaDoFilho(a) - familiaDoFilho(b))

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 70 })
    g.setNode(mae.slug, { width: LARGURA_MAE, height: ALTURA_MAE })
    for (const filho of filhosOrdenados) {
      g.setNode(filho.slug, { width: LARGURA_FILHO, height: ALTURA_FILHO })
      g.setEdge(mae.slug, filho.slug)
    }
    dagre.layout(g)

    function posicao(id: string, largura: number, altura: number) {
      const n = g.node(id)
      return { x: n.x - largura / 2, y: n.y - altura / 2 }
    }

    const nodes: Node<DadosNoPeca>[] = [
      {
        id: mae.slug,
        type: "peca",
        position: posicao(mae.slug, LARGURA_MAE, ALTURA_MAE),
        data: { peca: mae, ehMae: true, planejado: false },
        draggable: false,
      },
      ...filhosOrdenados.map((filho) => ({
        id: filho.slug,
        type: "peca",
        position: posicao(filho.slug, LARGURA_FILHO, ALTURA_FILHO),
        data: { peca: filho, ehMae: false, planejado: ehPlanejado(filho) },
        draggable: false,
      })),
    ]

    const edges: Edge[] = filhosOrdenados.map((filho) => {
      const planejado = ehPlanejado(filho)
      return {
        id: `${mae.slug}->${filho.slug}`,
        source: mae.slug,
        target: filho.slug,
        type: "smoothstep",
        style: planejado
          ? { stroke: "rgb(var(--ct-border))", strokeDasharray: "6 4" }
          : { stroke: "rgb(var(--ct-border))" },
      }
    })

    return { nodes, edges }
  }, [mae, filhos])

  // A mãe fica centralizada acima dos filhos (dagre), então centralizar o scroll horizontal
  // na carga mostra a mãe de cara em vez de abrir cortado na ponta esquerda da árvore.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [nodes])

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto rounded-md border border-border bg-surface">
      <div className={cn("w-full", LARGURA_MINIMA_MOBILE)} style={{ height: ALTURA_CANVAS }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          zoomOnScroll={false}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
        </ReactFlow>
      </div>
    </div>
  )
}
