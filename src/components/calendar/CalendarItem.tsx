"use client"

import { useDrag } from "react-dnd"
import { cn } from "@/lib/utils"
import type { ContentItem, Platform, ContentStatus } from "@/lib/types"
import { CLIENTS, DEFAULT_CLIENT_SLUG } from "@/lib/clients"

export const CALENDAR_ITEM_TYPE = "CALENDAR_ITEM"

const PLATFORM_ICONS: Record<Platform, { label: string }> = {
  instagram: { label: "Instagram" },
  youtube: { label: "YouTube" },
  linkedin: { label: "LinkedIn" },
  x: { label: "X" },
  email: { label: "E-mail" },
  tiktok: { label: "TikTok" },
}

const CLIENT_BADGE: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.values(CLIENTS)
    .filter((c) => c.calendarBadge)
    .map((c) => [c.slug, c.calendarBadge!])
)

const TYPE_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
  story: "Story",
  post: "Post",
  article: "Artigo",
  email: "Email",
  thread: "Thread",
}

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft: "bg-text-secondary",
  scheduled: "bg-accent",
  published: "bg-success",
  rejected: "bg-error",
}

const STATUS_BORDERS: Record<ContentStatus, string> = {
  draft: "border-l-text-secondary border-l-dashed",
  scheduled: "border-l-accent",
  published: "border-l-success",
  rejected: "border-l-error",
}

interface CalendarItemProps {
  item: ContentItem
  onClick: (id: string) => void
  compact?: boolean
}

export function CalendarItem({ item, onClick, compact = true }: CalendarItemProps) {
  const [{ isDragging }, dragRef] = useDrag({
    type: CALENDAR_ITEM_TYPE,
    item: { id: item.id, scheduledAt: item.scheduled_at },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const platform = item.platform ? PLATFORM_ICONS[item.platform] : null
  const statusColor = STATUS_COLORS[item.status] ?? "bg-text-secondary"

  const client = CLIENT_BADGE[item.client_slug] ?? null
  const typeLabel = TYPE_LABELS[item.content_type] ?? null
  const metadata = (item.metadata ?? {}) as { origem?: unknown }
  const foraDaSala = metadata.origem === "api" || metadata.origem === "manual"

  const compactTime = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  if (compact) {
    return (
      <button
        type="button"
        ref={dragRef as unknown as React.Ref<HTMLButtonElement>}
        onClick={() => onClick(item.id)}
        aria-label={`${item.title}${foraDaSala ? ", fora da Sala" : ""}`}
        className={cn(
          "w-full min-w-0 rounded px-1.5 py-1 text-left group",
          "hover:bg-surface-hover transition-colors cursor-grab active:cursor-grabbing",
          "border-l-2",
          STATUS_BORDERS[item.status] ?? STATUS_BORDERS.draft,
          isDragging && "opacity-40"
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1 mb-0.5">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColor)} />
          {compactTime && (
            <span className="text-[9px] text-text-secondary font-medium">{compactTime}</span>
          )}
          {typeLabel && (
            <span className="text-[9px] text-text-secondary">· {typeLabel}</span>
          )}
          {platform && (
            <span className="text-[9px] text-text-secondary">· {platform.label}</span>
          )}
          {foraDaSala && (
            <span className="rounded border border-warning px-1 text-[9px] leading-4 text-warning">
              fora da Sala
            </span>
          )}
          {client && item.client_slug !== DEFAULT_CLIENT_SLUG && (
            <span className="text-[8px] font-medium text-accent">· {client.label}</span>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-text-primary leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {item.title}
        </span>
      </button>
    )
  }

  const time = item.scheduled_at
    ? new Date(item.scheduled_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <button
      type="button"
      ref={dragRef as unknown as React.Ref<HTMLButtonElement>}
      onClick={() => onClick(item.id)}
      aria-label={`${item.title}${foraDaSala ? ", fora da Sala" : ""}`}
      className={cn(
        "w-full min-w-0 flex items-center gap-2 rounded border border-border border-l-2 bg-surface/80 px-2 py-1.5 text-left group",
        STATUS_BORDERS[item.status] ?? STATUS_BORDERS.draft,
        "hover:bg-surface-hover transition-colors",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", statusColor)} />
      {platform && (
        <span
          className={cn(
            "shrink-0 rounded border border-border bg-surface-hover px-1.5 py-0.5 text-[9px] font-bold text-text-secondary"
          )}
        >
          {platform.label}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-text-primary truncate block group-hover:text-accent transition-colors">
          {item.title}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          {typeLabel && (
            <span className="text-[9px] text-text-secondary">{typeLabel}</span>
          )}
          {client && (
            <span className="text-[9px] font-medium text-accent">
              {client.label}
            </span>
          )}
          {foraDaSala && (
            <span className="rounded border border-warning px-1 text-[9px] leading-4 text-warning">
              fora da Sala
            </span>
          )}
        </div>
      </div>
      {time && (
        <span className="text-[10px] text-text-secondary shrink-0">{time}</span>
      )}
    </button>
  )
}
