import type { TenantDB } from "@/lib/tenant-db"
import type { ContentItem, ContentStatus, ContentType, Platform, ApprovalStatus } from "@/lib/types"

export interface ContentFilters {
  status?: ContentStatus
  platform?: Platform
  content_type?: ContentType
  search?: string
  client_slug?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface ContentListResult {
  data: ContentItem[]
  total: number
}

export async function listContent(db: TenantDB, filters: ContentFilters = {}): Promise<ContentListResult> {
  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(filters.status)
  } else {
    conditions.push(`status != 'published'`)
  }

  if (filters.platform) {
    conditions.push(`platform = $${paramIndex++}`)
    params.push(filters.platform)
  }

  if (filters.content_type) {
    conditions.push(`content_type = $${paramIndex++}`)
    params.push(filters.content_type)
  }

  if (filters.client_slug) {
    conditions.push(`client_slug = $${paramIndex++}`)
    params.push(filters.client_slug)
  }

  if (filters.search) {
    conditions.push(`title ILIKE $${paramIndex++}`)
    params.push(`%${filters.search}%`)
  }

  if (filters.from) {
    conditions.push(`scheduled_at >= $${paramIndex++}`)
    params.push(filters.from)
  }

  if (filters.to) {
    conditions.push(`scheduled_at <= $${paramIndex++}::date + INTERVAL '1 day'`)
    params.push(filters.to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_content_items ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const data = await db.query<ContentItem>(
    `SELECT * FROM ct_content_items ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { data, total }
}

export async function getContentById(db: TenantDB, id: string): Promise<ContentItem | null> {
  return db.queryOne<ContentItem>(
    "SELECT * FROM ct_content_items WHERE id = $1",
    [id]
  )
}

interface ContentUpdateData {
  approval_status?: ApprovalStatus
  status?: ContentStatus
  approval_notes?: string | null
  scheduled_at?: string | null
}

export async function updateContent(db: TenantDB, id: string, data: ContentUpdateData): Promise<ContentItem | null> {
  const setClauses: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (data.approval_status !== undefined) {
    setClauses.push(`approval_status = $${paramIndex++}`)
    params.push(data.approval_status)
  }

  if (data.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`)
    params.push(data.status)
  }

  if (data.approval_notes !== undefined) {
    setClauses.push(`approval_notes = $${paramIndex++}`)
    params.push(data.approval_notes)
  }

  if (data.scheduled_at !== undefined) {
    setClauses.push(`scheduled_at = $${paramIndex++}`)
    params.push(data.scheduled_at)
  }

  if (setClauses.length === 0) {
    return getContentById(db, id)
  }

  setClauses.push(`updated_at = NOW()`)

  return db.queryOne<ContentItem>(
    `UPDATE ct_content_items SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    [...params, id]
  )
}

export async function deleteContent(db: TenantDB, id: string): Promise<boolean> {
  const result = await db.query(
    "DELETE FROM ct_content_items WHERE id = $1 RETURNING id",
    [id]
  )
  return result.length > 0
}
