import type { TenantDB } from "@/lib/tenant-db"
import type { PipelineStage, Deal } from "@/lib/types"

export interface DealWithContact extends Deal {
  contact_name: string | null
}

export interface StageWithDeals extends PipelineStage {
  deals: DealWithContact[]
}

export interface PipelineData {
  stages: StageWithDeals[]
}

export async function listPipelineWithDeals(db: TenantDB): Promise<PipelineData> {
  const stages = await db.query<PipelineStage>(
    "SELECT * FROM ct_pipeline_stages ORDER BY position ASC"
  )

  const deals = await db.query<DealWithContact & { stage_id: string }>(
    `SELECT d.*, c.name as contact_name
     FROM ct_deals d
     LEFT JOIN ct_contacts c ON c.id = d.contact_id
     ORDER BY d.created_at DESC`
  )

  const dealsByStage = new Map<string, DealWithContact[]>()
  for (const deal of deals) {
    const stageId = deal.stage_id ?? ""
    const existing = dealsByStage.get(stageId) ?? []
    dealsByStage.set(stageId, [...existing, deal])
  }

  const stagesWithDeals: StageWithDeals[] = stages.map((stage) => ({
    ...stage,
    deals: dealsByStage.get(stage.id) ?? [],
  }))

  return { stages: stagesWithDeals }
}

export async function updateDealStage(
  db: TenantDB,
  dealId: string,
  stageId: string
): Promise<Deal | null> {
  return db.queryOne<Deal>(
    `UPDATE ct_deals
     SET stage_id = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [stageId, dealId]
  )
}

interface UpdateDealData {
  stage_id?: string
  status?: string
  notes?: string
}

export async function updateDeal(
  db: TenantDB,
  dealId: string,
  data: UpdateDealData
): Promise<Deal | null> {
  const setClauses: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (data.stage_id !== undefined) {
    setClauses.push(`stage_id = $${paramIndex++}`)
    params.push(data.stage_id)
  }

  if (data.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`)
    params.push(data.status)
  }

  if (data.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex++}`)
    params.push(data.notes)
  }

  if (setClauses.length === 0) {
    return db.queryOne<Deal>("SELECT * FROM ct_deals WHERE id = $1", [dealId])
  }

  setClauses.push("updated_at = NOW()")

  return db.queryOne<Deal>(
    `UPDATE ct_deals SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    [...params, dealId]
  )
}

interface CreateDealData {
  title: string
  contact_id?: string
  stage_id: string
  value?: number
  expected_close_at?: string
}

export async function createDeal(db: TenantDB, data: CreateDealData): Promise<Deal | null> {
  return db.queryOne<Deal>(
    `INSERT INTO ct_deals (title, contact_id, stage_id, value, expected_close_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.title,
      data.contact_id ?? null,
      data.stage_id,
      data.value ?? null,
      data.expected_close_at ?? null,
    ]
  )
}
