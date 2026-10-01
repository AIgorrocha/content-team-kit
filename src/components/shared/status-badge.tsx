import { Badge } from "@/components/ui/badge"
import type { AgentStatus } from "@/lib/types"

const statusConfig: Record<AgentStatus, { label: string; variant: "success" | "error" | "secondary" }> = {
  active: { label: "Ativo", variant: "success" },
  error: { label: "Erro", variant: "error" },
  idle: { label: "Inativo", variant: "secondary" },
}

interface StatusBadgeProps {
  status: AgentStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
