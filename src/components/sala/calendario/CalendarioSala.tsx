"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Instagram, Linkedin, Youtube, Music2, Twitter, Megaphone, Mail } from "lucide-react"
import { ContentCalendar } from "@/components/calendar/content-calendar"
import type { ContentItem, Platform, ContentStatus } from "@/lib/types"
import type { ItemCalendario, Rede } from "@/lib/sala/types"
import { itensParaContentItems } from "@/lib/sala/adaptadores/calendario"

const ICONE_REDE: Record<Rede, typeof Instagram> = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  x: Twitter,
  meta_ads: Megaphone, // não aparece no calendário de conteúdo, só por completude do tipo
  email: Mail,
}
const REDES_LEGENDA: Array<{ rede: Rede; label: string }> = [
  { rede: "instagram", label: "Instagram" },
  { rede: "linkedin", label: "LinkedIn" },
  { rede: "youtube", label: "YouTube" },
  { rede: "tiktok", label: "TikTok" },
  { rede: "x", label: "X" },
]

function formatDateParam(date: Date, fimDoDia = false): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return fimDoDia ? `${y}-${m}-${d}T23:59:59-03:00` : `${y}-${m}-${d}`
}

interface CalendarioSalaProps {
  agora: string // ISO de SalaData.agora(): RELOGIO_MOCK no mock, Date.now() no live. Vem
  // do server component da página, nunca importado direto do provedor de dados aqui.
}

// Item pode carregar `origem` (Batelada B6, campo novo em src/lib/sala/data/live/calendario.ts,
// ainda fora do contrato ItemCalendario em types.ts). "sala" e a peça publicada pela própria
// Sala; "api" e "manual" vieram de fora e ganham o selo "fora da Sala".
type ItemComOrigem = ItemCalendario & { origem?: "sala" | "api" | "manual" }

// Botão do cabeçalho (SalaHeader/prop acoes, em page.tsx). Fica fora do corpo do calendário
// de propósito: dispara o sync e avisa o resultado por um evento simples no window, sem
// prop-drilling entre o server component da página e o client component da lista.
export function BotaoSincronizarCalendario() {
  const [sincronizando, setSincronizando] = useState(false)
  const [resumo, setResumo] = useState<string | null>(null)

  const sincronizar = useCallback(async () => {
    setSincronizando(true)
    setResumo(null)
    try {
      const resp = await fetch("/api/sala/calendario/sincronizar", { method: "POST" })
      const dados = await resp.json()
      if (!resp.ok) {
        setResumo(dados.erro ?? "falha ao sincronizar")
        return
      }
      const porRede = (dados.porRede ?? {}) as Record<string, number>
      const partes = Object.entries(porRede).map(([rede, n]) => `${rede} ${n}`)
      const avisos = Array.isArray(dados.avisos) ? dados.avisos.filter((aviso: unknown): aviso is string => typeof aviso === "string") : []
      setResumo([partes.length ? partes.join(", ") : "nada novo", ...avisos].join(". "))
      window.dispatchEvent(new Event("sala:calendario:sincronizado"))
    } catch {
      setResumo("falha de rede ao sincronizar")
    } finally {
      setSincronizando(false)
    }
  }, [])

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sincronizar}
        disabled={sincronizando}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
      </button>
      {resumo && <span role="status" className="max-w-lg text-right text-xs text-text-secondary">{resumo}</span>}
    </div>
  )
}

export function CalendarioSala({ agora }: CalendarioSalaProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const data = new Date(agora)
    return new Date(data.getFullYear(), data.getMonth(), 1)
  })
  const [itens, setItens] = useState<ItemCalendario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all")
  const [itemSelecionado, setItemSelecionado] = useState<ItemCalendario | null>(null)

  const inicio = useMemo(() => formatDateParam(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -6)), [currentMonth])
  const fim = useMemo(() => formatDateParam(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 7), true), [currentMonth])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const resp = await fetch(`/api/sala/calendario?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`)
      const dados = await resp.json()
      if (!resp.ok) {
        setErro(dados.erro ?? "erro ao carregar o calendário")
        return
      }
      setItens(dados.itens as ItemCalendario[])
      setErro(null)
    } catch {
      setErro("falha de rede ao carregar o calendário")
    } finally {
      setCarregando(false)
    }
  }, [inicio, fim])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Botão "Sincronizar agora" do cabeçalho avisa por esse evento quando termina; recarrega
  // a lista pra mostrar o que acabou de entrar em ct_publications.
  useEffect(() => {
    const recarregar = () => carregar()
    window.addEventListener("sala:calendario:sincronizado", recarregar)
    return () => window.removeEventListener("sala:calendario:sincronizado", recarregar)
  }, [carregar])

  const contentItems = useMemo(() => itensParaContentItems(itens), [itens])

  const handleReschedule = useCallback(
    async (itemId: string, novaData: Date) => {
      setErro(null)
      const y = novaData.getFullYear()
      const m = String(novaData.getMonth() + 1).padStart(2, "0")
      const d = String(novaData.getDate()).padStart(2, "0")
      try {
        const resp = await fetch("/api/sala/calendario", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: itemId, novaData: `${y}-${m}-${d}` }),
        })
        const dados = await resp.json()
        if (!resp.ok) {
          setErro(dados.erro ?? "não foi possível reprogramar")
          return
        }
        await carregar()
      } catch {
        setErro("falha de rede ao reprogramar")
      }
    },
    [carregar]
  )

  const handleItemClick = useCallback(
    (id: string) => {
      setItemSelecionado(itens.find((i) => i.id === id) ?? null)
    },
    [itens]
  )

  return (
    <div className="sala-calendario min-w-0 max-w-full space-y-4">
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-text-secondary" aria-hidden="true" />
            Planejado
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Agendado
          </span>
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            Publicado
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-text-secondary" aria-label="Redes do calendário">
          {REDES_LEGENDA.map(({ rede, label }) => {
            const Icone = ICONE_REDE[rede]
            return (
              <span key={rede} className="inline-flex items-center gap-1" title={label}>
                <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </span>
            )
          })}
        </div>
      </div>

      {erro && <p className="text-xs text-error">{erro}</p>}

      {!carregando && itens.length === 0 && !erro && (
        <p className="text-sm text-text-secondary">Nenhuma peça programada ainda.</p>
      )}

      {carregando ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
      ) : (
        <ContentCalendar
          contentItems={contentItems}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onItemClick={handleItemClick}
          onReschedule={handleReschedule}
          onDayClick={() => {}}
          platformFilter={platformFilter}
          statusFilter={statusFilter}
          onPlatformFilterChange={setPlatformFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      {itemSelecionado && (
        <div className="rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{itemSelecionado.titulo}</span>
          {" · "}peça {itemSelecionado.peca}
          {" · "}estado {itemSelecionado.estado}
          {(itemSelecionado as ItemComOrigem).origem &&
            (itemSelecionado as ItemComOrigem).origem !== "sala" && (
              <>
                {" · "}
                <span className="rounded border border-warning bg-surface-hover px-1.5 py-0.5 text-warning">
                  fora da Sala
                </span>
              </>
            )}
          {itemSelecionado.url && (
            <>
              {" · "}
              <a href={itemSelecionado.url} target="_blank" rel="noreferrer" className="underline">
                ver publicação
              </a>
            </>
          )}
        </div>
      )}

      <p className="rounded-md border border-border bg-surface p-3 text-xs text-text-secondary">
        Reprogramar aqui muda a data no painel; a publicação real segue o agendamento confirmado pelo time.
      </p>
    </div>
  )
}
