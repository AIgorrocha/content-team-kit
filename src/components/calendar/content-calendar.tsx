"use client"

import { useState, useCallback, useMemo } from "react"
import { DndProvider, useDrop } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CalendarItem, CALENDAR_ITEM_TYPE } from "./CalendarItem"
import type { ContentItem, Platform, ContentStatus } from "@/lib/types"

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const DAY_NAMES_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"]

type ViewMode = "month" | "week"

interface ContentCalendarProps {
  contentItems: ContentItem[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onItemClick: (id: string) => void
  onReschedule: (itemId: string, newDate: Date) => void
  onDayClick: (date: Date) => void
  platformFilter: Platform | "all"
  statusFilter: ContentStatus | "all"
  onPlatformFilterChange: (value: Platform | "all") => void
  onStatusFilterChange: (value: ContentStatus | "all") => void
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function getWeekDates(baseDate: Date): Date[] {
  const dayOfWeek = baseDate.getDay()
  const start = new Date(baseDate)
  start.setDate(start.getDate() - dayOfWeek)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

function buildItemsByDay(items: ContentItem[]): Map<string, ContentItem[]> {
  const map = new Map<string, ContentItem[]>()
  for (const item of items) {
    if (!item.scheduled_at) continue
    const d = new Date(item.scheduled_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const existing = map.get(key) ?? []
    map.set(key, [...existing, item])
  }
  return map
}

// Drop target cell
interface DayCellProps {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  items: ContentItem[]
  onItemClick: (id: string) => void
  onReschedule: (itemId: string, newDate: Date) => void
  onDayClick: (date: Date) => void
  compact: boolean
}

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  items,
  onItemClick,
  onReschedule,
  onDayClick,
  compact,
}: DayCellProps) {
  const sunday = isSunday(date)

  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: CALENDAR_ITEM_TYPE,
    canDrop: () => !sunday,
    drop: (dragItem: { id: string }) => {
      onReschedule(dragItem.id, date)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })

  const hasMultiple = items.length > 1
  const maxDisplay = compact ? 3 : 10

  function handleCellClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button[data-calendar-item]")) return
    if (!sunday) {
      onDayClick(date)
    }
  }

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      onClick={handleCellClick}
      className={cn(
        "min-w-0 min-h-[56px] sm:min-h-[120px] p-3 sm:p-1.5 transition-colors",
        !isCurrentMonth && "hidden bg-background/70 sm:block",
        isCurrentMonth && !sunday && "bg-background cursor-pointer hover:bg-surface-hover/30",
        isCurrentMonth && sunday && "bg-surface/20",
        sunday && "opacity-50",
        isToday && "ring-1 ring-inset ring-accent",
        isOver && canDrop && "bg-accent/10 ring-1 ring-accent",
        isOver && !canDrop && "bg-error/10"
      )}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={cn(
            "text-xs font-medium inline-flex items-center justify-center",
            isCurrentMonth ? "text-text-primary" : "text-text-secondary/50",
            isToday && "bg-accent text-white rounded-full w-5 h-5 text-[10px]"
          )}
        >
          {date.getDate()}
        </span>
        <span className="text-xs text-text-secondary sm:hidden">
          {date.toLocaleDateString("pt-BR", { weekday: "long", month: "long" })}
        </span>
        {hasMultiple && isCurrentMonth && (
          <span className="flex items-center text-[9px] text-warning">
            <AlertTriangle aria-hidden="true" className="w-2.5 h-2.5 mr-0.5" />
            {items.length}
          </span>
        )}
      </div>
      {sunday && isCurrentMonth && items.length === 0 && (
        <span className="text-[9px] text-text-secondary/60 italic">Sem post</span>
      )}
      <div className="space-y-0.5">
        {items.slice(0, maxDisplay).map((item) => (
          <div key={item.id} data-calendar-item>
            <CalendarItem item={item} onClick={onItemClick} compact={compact} />
          </div>
        ))}
        {items.length > maxDisplay && (
          <span className="text-[10px] text-text-secondary px-1">
            +{items.length - maxDisplay} mais
          </span>
        )}
      </div>
    </div>
  )
}

// Weekly view cell (taller, more detail)
function WeekDayCell({
  date,
  isToday,
  items,
  onItemClick,
  onReschedule,
  onDayClick,
}: Omit<DayCellProps, "isCurrentMonth" | "compact">) {
  const sunday = isSunday(date)

  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: CALENDAR_ITEM_TYPE,
    canDrop: () => !sunday,
    drop: (dragItem: { id: string }) => {
      onReschedule(dragItem.id, date)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })

  function handleCellClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button[data-calendar-item]")) return
    if (!sunday) {
      onDayClick(date)
    }
  }

  const dayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date)

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      onClick={handleCellClick}
      className={cn(
        "min-w-0 flex-1 min-h-[200px] p-2 transition-colors",
        !sunday && "bg-background cursor-pointer hover:bg-surface-hover/30",
        sunday && "bg-surface/20 opacity-50",
        isToday && "ring-1 ring-inset ring-accent",
        isOver && canDrop && "bg-accent/10 ring-1 ring-accent",
        isOver && !canDrop && "bg-error/10"
      )}
    >
      <div className="mb-2">
        <span
          className={cn(
            "text-xs font-medium capitalize",
            isToday ? "text-accent" : "text-text-primary"
          )}
        >
          {dayLabel}
        </span>
      </div>
      {sunday && (
        <span className="text-[10px] text-text-secondary/60 italic">Sem publicação</span>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} data-calendar-item>
            <CalendarItem item={item} onClick={onItemClick} compact={false} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarInner({
  contentItems,
  currentMonth,
  onMonthChange,
  onItemClick,
  onReschedule,
  onDayClick,
  platformFilter,
  statusFilter,
  onPlatformFilterChange,
  onStatusFilterChange,
}: ContentCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [weekOffset, setWeekOffset] = useState(0)

  const today = useMemo(() => new Date(), [])
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Filter items
  const filteredItems = useMemo(() => {
    return contentItems.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false
      if (statusFilter !== "all" && item.status !== statusFilter) return false
      return true
    })
  }, [contentItems, platformFilter, statusFilter])

  const itemsByDay = useMemo(() => buildItemsByDay(filteredItems), [filteredItems])

  // Stats
  const stats = useMemo(() => {
    const scheduled = contentItems.filter((i) => i.status === "scheduled").length
    const published = contentItems.filter((i) => i.status === "published").length
    const drafts = contentItems.filter((i) => i.status === "draft").length
    return { scheduled, published, drafts, total: contentItems.length }
  }, [contentItems])

  // Month grid cells
  const monthCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfWeek(year, month)
    const prevMonthDays = getDaysInMonth(year, month - 1)
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

    const cells: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = []

    for (let i = 0; i < firstDay; i++) {
      const day = prevMonthDays - firstDay + 1 + i
      cells.push({ day, isCurrentMonth: false, date: new Date(year, month - 1, day) })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) })
    }
    const remaining = totalCells - cells.length
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) })
    }
    return cells
  }, [year, month])

  // Week dates
  const weekDates = useMemo(() => {
    const base = new Date(today)
    base.setDate(base.getDate() + weekOffset * 7)
    return getWeekDates(base)
  }, [today, weekOffset])

  const handlePrev = useCallback(() => {
    if (viewMode === "month") {
      onMonthChange(new Date(year, month - 1, 1))
    } else {
      setWeekOffset((o) => o - 1)
    }
  }, [viewMode, year, month, onMonthChange])

  const handleNext = useCallback(() => {
    if (viewMode === "month") {
      onMonthChange(new Date(year, month + 1, 1))
    } else {
      setWeekOffset((o) => o + 1)
    }
  }, [viewMode, year, month, onMonthChange])

  const handleToday = useCallback(() => {
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))
    setWeekOffset(0)
  }, [today, onMonthChange])

  const headerTitle = viewMode === "month"
    ? `${MONTH_NAMES[month]} ${year}`
    : (() => {
        const start = weekDates[0]
        const end = weekDates[6]
        const fmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" })
        return `${fmt.format(start)} a ${fmt.format(end)}, ${end.getFullYear()}`
      })()

  return (
    <div className="w-full min-w-0 max-w-full">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-text-secondary" />
          <span className="text-text-secondary">{stats.drafts} rascunhos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-text-secondary">{stats.scheduled} agendados</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-text-secondary">{stats.published} publicados</span>
        </div>
        <div className="text-text-secondary/60 ml-auto">
          {stats.total} itens no mês
        </div>
      </div>

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-text-primary">
            {headerTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              aria-label="Visualização mensal"
              aria-pressed={viewMode === "month"}
              onClick={() => setViewMode("month")}
              className={cn(
                "px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "month"
                  ? "bg-accent text-white"
                  : "bg-surface text-text-secondary hover:bg-surface-hover"
              )}
            >
              <Calendar aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Visualização semanal"
              aria-pressed={viewMode === "week"}
              onClick={() => setViewMode("week")}
              className={cn(
                "px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "week"
                  ? "bg-accent text-white"
                  : "bg-surface text-text-secondary hover:bg-surface-hover"
              )}
            >
              <LayoutGrid aria-hidden="true" className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleToday}>
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={viewMode === "month" ? "Mês anterior" : "Semana anterior"}
            onClick={handlePrev}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={viewMode === "month" ? "Próximo mês" : "Próxima semana"}
            onClick={handleNext}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
          <Select
          value={platformFilter}
          onChange={(e) => onPlatformFilterChange(e.target.value as Platform | "all")}
          className="h-8 w-auto max-w-full text-xs"
        >
          <option value="all">Todas plataformas</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
          <option value="x">Threads/X</option>
          <option value="email">Email</option>
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as ContentStatus | "all")}
          className="h-8 w-auto max-w-full text-xs"
        >
          <option value="all">Todos status</option>
          <option value="draft">Rascunho</option>
          <option value="scheduled">Agendado</option>
          <option value="published">Publicado</option>
          <option value="rejected">Rejeitado</option>
        </Select>
      </div>

      {/* Monthly view */}
      {viewMode === "month" && (
        <div className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-7">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name + i}
              className={cn(
                "hidden min-w-0 bg-surface px-1 py-2 text-center text-[10px] font-medium uppercase tracking-[0.06em] sm:block",
                i === 0 ? "text-text-secondary/50" : "text-text-secondary"
              )}
            >
              <span className="hidden sm:inline">{name}</span>
              <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
            </div>
          ))}

          {monthCells.map((cell, i) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
            const dayItems = itemsByDay.get(key) ?? []
            return (
              <DayCell
                key={i}
                date={cell.date}
                isCurrentMonth={cell.isCurrentMonth}
                isToday={isSameDay(cell.date, today)}
                items={dayItems}
                onItemClick={onItemClick}
                onReschedule={onReschedule}
                onDayClick={onDayClick}
                compact={true}
              />
            )
          })}
        </div>
      )}

      {/* Weekly view */}
      {viewMode === "week" && (
        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-border sm:flex-row">
          {weekDates.map((date, i) => {
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const dayItems = itemsByDay.get(key) ?? []
            return (
              <WeekDayCell
                key={i}
                date={date}
                isToday={isSameDay(date, today)}
                items={dayItems}
                onItemClick={onItemClick}
                onReschedule={onReschedule}
                onDayClick={onDayClick}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ContentCalendar(props: ContentCalendarProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <CalendarInner {...props} />
    </DndProvider>
  )
}
