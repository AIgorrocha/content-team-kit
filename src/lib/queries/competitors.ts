import type { TenantDB } from "@/lib/tenant-db"
import type { Competitor, CompetitorPost } from "@/lib/types"

export interface CompetitorFilters {
  search?: string
}

export async function listCompetitors(db: TenantDB, filters: CompetitorFilters = {}): Promise<Competitor[]> {
  const conditions: string[] = ["is_active = true"]
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.search) {
    conditions.push(`(display_name ILIKE $${paramIndex} OR handle ILIKE $${paramIndex} OR niche ILIKE $${paramIndex})`)
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  const where = `WHERE ${conditions.join(" AND ")}`
  return db.query<Competitor>(
    `SELECT * FROM ct_competitors ${where} ORDER BY display_name ASC`,
    params
  )
}

export interface CompetitorPostFilters {
  post_type?: string
  is_viral?: boolean
  page?: number
  limit?: number
}

export interface CompetitorWithPosts {
  competitor: Competitor
  posts: CompetitorPost[]
  total: number
}

export async function getCompetitorWithPosts(
  db: TenantDB,
  id: string,
  filters: CompetitorPostFilters = {}
): Promise<CompetitorWithPosts | null> {
  const competitor = await db.queryOne<Competitor>(
    "SELECT * FROM ct_competitors WHERE id = $1",
    [id]
  )

  if (!competitor) return null

  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = ["competitor_id = $1"]
  const params: unknown[] = [id]
  let paramIndex = 2

  if (filters.post_type) {
    conditions.push(`post_type = $${paramIndex++}`)
    params.push(filters.post_type)
  }

  if (filters.is_viral !== undefined) {
    conditions.push(`is_viral = $${paramIndex++}`)
    params.push(filters.is_viral)
  }

  const where = `WHERE ${conditions.join(" AND ")}`

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_competitor_posts ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const posts = await db.query<CompetitorPost>(
    `SELECT * FROM ct_competitor_posts ${where}
     ORDER BY posted_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { competitor, posts, total }
}
