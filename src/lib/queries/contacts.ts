import type { TenantDB } from "@/lib/tenant-db"
import type { Contact, DealActivity } from "@/lib/types"

export interface ContactFilters {
  search?: string
  source?: string
  page?: number
  limit?: number
}

export interface ContactListResult {
  data: Contact[]
  total: number
}

export interface ContactWithActivities {
  contact: Contact
  activities: DealActivity[]
}

export async function listContacts(db: TenantDB, filters: ContactFilters = {}): Promise<ContactListResult> {
  const { page = 1, limit = 20 } = filters
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`)
    params.push(`%${filters.search}%`)
    paramIndex++
  }

  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`)
    params.push(filters.source)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const countRows = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ct_contacts ${where}`,
    params
  )
  const total = parseInt(countRows[0]?.count ?? "0")

  const dataParams = [...params, limit, offset]
  const data = await db.query<Contact>(
    `SELECT * FROM ct_contacts ${where}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    dataParams
  )

  return { data, total }
}

export async function getContactById(db: TenantDB, id: string): Promise<ContactWithActivities | null> {
  const contact = await db.queryOne<Contact>(
    "SELECT * FROM ct_contacts WHERE id = $1",
    [id]
  )

  if (!contact) {
    return null
  }

  const activities = await db.query<DealActivity>(
    "SELECT * FROM ct_deal_activities WHERE contact_id = $1 ORDER BY performed_at DESC",
    [id]
  )

  return { contact, activities }
}
