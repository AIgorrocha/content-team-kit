"use client"

import { useEffect, useMemo, useState } from "react"
import { CartaoTrabalho } from "./CartaoTrabalho"
import { agruparCartoesTrabalho, type GrupoCartoes } from "./grupos"
import { DetalheAgente } from "@/components/sala/time/DetalheAgente"
import { useSalaEventos } from "@/hooks/use-sala-eventos"
import type { ColunaTrabalho, ColunaTrabalhoId } from "@/lib/sala/types"

interface KanbanTrabalhoProps {
  colunasIniciais: ColunaTrabalho[]
  agora: string
}

const TITULO_COLUNA: Record<ColunaTrabalhoId, string> = {
  esperando: "Esperando",
  trabalhando: "Trabalhando",
  aguardando_aprovacao: "Aguardando aprovação",
  concluido_hoje: "Concluído hoje",
}

// Cor por coluna (desenho B12: bolinha de 8px ao lado do nome de cada coluna, mesma cor
// usada no ponto do rodapé de cada cartão).
const COR_COLUNA: Record<ColunaTrabalhoId, string> = {
  esperando: "bg-text-secondary",
  trabalhando: "bg-accent",
  aguardando_aprovacao: "bg-warning",
  concluido_hoje: "bg-success",
}

// Kanban ao vivo dos agentes (Batelada B3): substitui Ao vivo + Time por um quadro só.
// Atualização "ao vivo" reaproveita a MESMA assinatura SSE que Ao vivo já usava
// (useSalaEventos, /api/sala/eventos/stream): a cada evento novo, busca de novo o
// snapshot de colunas em /api/sala/trabalho, porque montar coluna exige juntar agentes
// e eventos no servidor, não só o evento isolado que chegou.
export function KanbanTrabalho({ colunasIniciais, agora }: KanbanTrabalhoProps) {
  const [colunas, setColunas] = useState(colunasIniciais)
  const [slugAberto, setSlugAberto] = useState<string | null>(null)
  const [filtro, setFiltro] = useState("")
  const { ultimoEvento } = useSalaEventos()

  useEffect(() => {
    if (!ultimoEvento) return
    let cancelado = false
    fetch("/api/sala/trabalho")
      .then((r) => r.json())
      .then((dados) => {
        if (!cancelado && dados.colunas) setColunas(dados.colunas)
      })
      .catch(() => {
        // sem rede: o próximo evento tenta de novo
      })
    return () => {
      cancelado = true
    }
  }, [ultimoEvento?.id])

  const colunasFiltradas = useMemo(() => {
    const termo = filtro.trim().toLocaleLowerCase()
    if (!termo) return colunas
    return colunas.map((coluna) => ({
      ...coluna,
      agentes: coluna.agentes.filter((cartao) => [cartao.apelido, cartao.agente, cartao.modelo, cartao.tarefa]
        .some((campo) => campo?.toLocaleLowerCase().includes(termo))),
    }))
  }, [colunas, filtro])

  const totalEncontrado = colunasFiltradas.reduce((total, coluna) => total + coluna.agentes.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
        <p className="text-xs text-text-secondary">Agentes coordenam; capacidades são as ferramentas que eles usam.</p>
        <label className="flex min-w-[220px] flex-1 items-center gap-2 md:max-w-xs">
          <span className="sr-only">Buscar agente, tarefa ou modelo</span>
          <input
            type="search"
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value)}
            placeholder="Buscar agente, tarefa ou modelo"
            aria-label="Buscar agente, tarefa ou modelo"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        {filtro.trim() && <p className="w-full text-[11px] text-text-secondary">{totalEncontrado} agente(s) encontrado(s).</p>}
      </div>
      {colunas.every(c => c.id === "esperando" || c.agentes.length === 0) && <p className="rounded-md border border-border bg-surface p-3 text-sm text-text-secondary">Nenhuma atividade recente recebida para este cliente. Se há um terminal trabalhando, confira se ele envia eventos para esta instalação da Sala.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="colunas-trabalho">
        {colunasFiltradas.map((coluna) => (
          <section
            key={coluna.id}
            className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3"
            data-testid={`coluna-${coluna.id}`}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <span className={`h-2 w-2 shrink-0 rounded-full ${COR_COLUNA[coluna.id]}`} aria-hidden="true" />
              {TITULO_COLUNA[coluna.id]} ({coluna.agentes.length})
            </h2>
            <div className="flex flex-col gap-2">
              {coluna.agentes.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-text-secondary">
                  {filtro.trim() ? "Nenhum agente corresponde à busca." : "Nenhum agente aqui agora."}
                </p>
              )}
              {agruparCartoesTrabalho(coluna.agentes).map((grupo) => (
                <GrupoDeCartoes
                  key={grupo.id}
                  grupo={grupo}
                  compacto={coluna.id === "esperando" && !filtro.trim()}
                  agora={agora}
                  cor={COR_COLUNA[coluna.id]}
                  onAbrir={(slug) => setSlugAberto(slug)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <DetalheAgente slug={slugAberto} onFechar={() => setSlugAberto(null)} />
    </div>
  )
}

interface GrupoDeCartoesProps {
  grupo: GrupoCartoes
  compacto: boolean
  agora: string
  cor: string
  onAbrir: (slug: string) => void
}

function GrupoDeCartoes({ grupo, compacto, agora, cor, onAbrir }: GrupoDeCartoesProps) {
  const [aberto, setAberto] = useState(!compacto)
  useEffect(() => { setAberto(!compacto) }, [compacto])
  const exemplos = grupo.cartoes.slice(0, 3).map((cartao) => cartao.apelido).join(", ")
  return (
    <details
      className="rounded-md border border-border/70 bg-background/40"
      open={aberto}
      onToggle={(evento) => setAberto(evento.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-xs text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span className="font-medium text-text-primary">{grupo.titulo}</span> ({grupo.cartoes.length})
        <span className="ml-1">{compacto ? `, exemplos: ${exemplos}` : `, ${grupo.descricao}`}</span>
      </summary>
      <div className="flex flex-col gap-2 px-2 pb-2">
        {grupo.cartoes.map((cartao) => (
          <CartaoTrabalho
            key={cartao.agente}
            cartao={cartao}
            agora={agora}
            cor={cor}
            onClick={() => onAbrir(cartao.agente)}
          />
        ))}
      </div>
    </details>
  )
}
