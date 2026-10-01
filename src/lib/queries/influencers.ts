import type { TenantDB } from "@/lib/tenant-db"
import type { Influencer, Collaboration, InfluencerStatus } from "@/lib/types"

export interface InfluencerFilters {
  status?: InfluencerStatus
  search?: string
  page?: number
  limit?: number
}

export interface InfluencerWithCount extends Influencer {
  collaboration_count: number
}

export interface PaginatedInfluencers {
  influencers: InfluencerWithCount[]
  total: number
}

export async function listInfluencers(
  db: TenantDB,
  filters: InfluencerFilters = {}
): Promise<PaginatedInfluencers> {
  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.status) {
    conditions.push(`i.status = $${paramIndex++}`)
    params.push(filters.status)
  }

  if (filters.search) {
    conditions.push(
      `(i.name ILIKE $${paramIndex} OR i.niche ILIKE $${paramIndex})`
    )
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_influencers i ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const influencers = await db.query<InfluencerWithCount>(
    `SELECT i.*, COALESCE(c.cnt, 0)::int as collaboration_count
     FROM ct_influencers i
     LEFT JOIN (
       SELECT influencer_id, COUNT(*)::int as cnt
       FROM ct_collaborations
       GROUP BY influencer_id
     ) c ON c.influencer_id = i.id
     ${where}
     ORDER BY i.name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { influencers, total }
}

export interface InfluencerDetail {
  influencer: Influencer
  collaborations: Collaboration[]
}

export async function getInfluencer(
  db: TenantDB,
  id: string
): Promise<InfluencerDetail | null> {
  const influencer = await db.queryOne<Influencer>(
    "SELECT * FROM ct_influencers WHERE id = $1",
    [id]
  )

  if (!influencer) return null

  const collaborations = await db.query<Collaboration>(
    `SELECT * FROM ct_collaborations
     WHERE influencer_id = $1
     ORDER BY created_at DESC`,
    [id]
  )

  return { influencer, collaborations }
}
