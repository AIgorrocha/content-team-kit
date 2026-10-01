import type { TenantDB } from "@/lib/tenant-db"
import type {
  Subscriber,
  SubscriberStatus,
  EmailCampaign,
  CampaignStatus,
} from "@/lib/types"

export interface SubscriberFilters {
  search?: string
  status?: SubscriberStatus
  page?: number
  limit?: number
}

export interface SubscriberListResult {
  data: Subscriber[]
  total: number
}

export interface SubscriberStats {
  total: number
  active: number
  unsubscribed: number
  bounced: number
}

export interface CampaignFilters {
  status?: CampaignStatus
  page?: number
  limit?: number
}

export interface CampaignListResult {
  data: EmailCampaign[]
  total: number
}

export async function listSubscribers(
  db: TenantDB,
  filters: SubscriberFilters = {}
): Promise<SubscriberListResult> {
  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.search) {
    conditions.push(
      `(email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`
    )
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(filters.status)
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_subscribers ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const data = await db.query<Subscriber>(
    `SELECT * FROM ct_subscribers ${where}
     ORDER BY subscribed_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { data, total }
}

export async function getSubscriberStats(db: TenantDB): Promise<SubscriberStats> {
  const rows = await db.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM ct_subscribers GROUP BY status`
  )

  const stats: SubscriberStats = { total: 0, active: 0, unsubscribed: 0, bounced: 0 }

  for (const row of rows) {
    const count = parseInt(row.count)
    stats.total += count
    if (row.status === "active") stats.active = count
    if (row.status === "unsubscribed") stats.unsubscribed = count
    if (row.status === "bounced") stats.bounced = count
  }

  return stats
}

export async function listCampaigns(
  db: TenantDB,
  filters: CampaignFilters = {}
): Promise<CampaignListResult> {
  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(filters.status)
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_email_campaigns ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const data = await db.query<EmailCampaign>(
    `SELECT * FROM ct_email_campaigns ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { data, total }
}

export async function getCampaignById(
  db: TenantDB,
  id: string
): Promise<EmailCampaign | null> {
  return db.queryOne<EmailCampaign>(
    "SELECT * FROM ct_email_campaigns WHERE id = $1",
    [id]
  )
}

export interface CreateCampaignInput {
  name: string
  subject: string
  campaign_type?: string
  status?: string
}

export async function createCampaign(
  db: TenantDB,
  input: CreateCampaignInput
): Promise<EmailCampaign> {
  const rows = await db.query<EmailCampaign>(
    `INSERT INTO ct_email_campaigns (name, subject, campaign_type, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.subject, input.campaign_type ?? "broadcast", input.status ?? "draft"]
  )
  return rows[0]
}
