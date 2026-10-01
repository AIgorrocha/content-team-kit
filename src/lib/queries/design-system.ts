import type { TenantDB } from "@/lib/tenant-db"
import type { DesignSystem } from "@/lib/types"

export async function getDesignSystem(db: TenantDB): Promise<DesignSystem | null> {
  return db.queryOne<DesignSystem>("SELECT * FROM ct_design_system LIMIT 1")
}

export async function updateDesignSystem(
  db: TenantDB,
  data: Partial<DesignSystem>
): Promise<DesignSystem | null> {
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (data.logo_url !== undefined) {
    fields.push(`logo_url = $${idx++}`)
    values.push(data.logo_url)
  }
  if (data.fonts !== undefined) {
    fields.push(`fonts = $${idx++}`)
    values.push(JSON.stringify(data.fonts))
  }
  if (data.colors !== undefined) {
    fields.push(`colors = $${idx++}`)
    values.push(JSON.stringify(data.colors))
  }
  if (data.carousel_style !== undefined) {
    fields.push(`carousel_style = $${idx++}`)
    values.push(JSON.stringify(data.carousel_style))
  }
  if (data.brand_voice !== undefined) {
    fields.push(`brand_voice = $${idx++}`)
    values.push(data.brand_voice)
  }

  if (fields.length === 0) {
    return getDesignSystem(db)
  }

  fields.push("updated_at = NOW()")

  const sql = `
    UPDATE ct_design_system
    SET ${fields.join(", ")}
    WHERE id = (SELECT id FROM ct_design_system LIMIT 1)
    RETURNING *
  `

  return db.queryOne<DesignSystem>(sql, values)
}
