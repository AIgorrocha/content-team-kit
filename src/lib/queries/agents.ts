import type { TenantDB } from "@/lib/tenant-db"
import type { Agent, Task } from "@/lib/types"

export interface AgentWithTaskCount extends Agent {
  pending_tasks: number
}

export async function listAgents(db: TenantDB): Promise<AgentWithTaskCount[]> {
  const rows = await db.query<AgentWithTaskCount>(`
    SELECT
      a.*,
      COALESCE((
        SELECT COUNT(*)::int FROM ct_tasks
        WHERE assigned_agent = a.slug AND status = 'pending'
      ), 0) as pending_tasks
    FROM ct_agents a
    ORDER BY
      CASE a.status
        WHEN 'active' THEN 0
        WHEN 'idle' THEN 1
        WHEN 'error' THEN 2
      END,
      a.display_name
  `)
  return rows
}

export async function getAgentBySlug(db: TenantDB, slug: string): Promise<Agent | null> {
  return db.queryOne<Agent>(
    "SELECT * FROM ct_agents WHERE slug = $1",
    [slug]
  )
}

export async function getAgentTasks(db: TenantDB, slug: string, limit = 20): Promise<Task[]> {
  return db.query<Task>(
    `SELECT * FROM ct_tasks
     WHERE assigned_agent = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [slug, limit]
  )
}

export interface AuditLogEntry {
  id: string
  agent: string | null
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface AgentDetail {
  agent: Agent
  tasks: Task[]
  auditLogs: AuditLogEntry[]
  pendingTasks: number
}

export async function getAgentDetail(db: TenantDB, slug: string): Promise<AgentDetail | null> {
  const agent = await getAgentBySlug(db, slug)
  if (!agent) return null

  const tasks = await getAgentTasks(db, slug, 10)
  const [countRow] = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM ct_tasks WHERE assigned_agent = $1 AND status = 'pending'",
    [slug]
  )

  const auditLogs = await db.query<AuditLogEntry>(
    `SELECT id, agent, action, details, created_at
     FROM ct_audit_log WHERE agent = $1
     ORDER BY created_at DESC LIMIT 20`,
    [slug]
  )

  return {
    agent,
    tasks,
    auditLogs,
    pendingTasks: parseInt(countRow?.count ?? "0"),
  }
}
