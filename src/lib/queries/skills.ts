import type { TenantDB } from "@/lib/tenant-db"

export interface Skill {
  slug: string
  name: string
  description: string | null
  category: string | null
  path: string | null
  updated_at: string
}

export interface SkillDetail extends Skill {
  content: string
}

export async function listSkills(db: TenantDB): Promise<Skill[]> {
  return db.query<Skill>(`
    SELECT slug, name, description, category, path, updated_at
    FROM ct_skills
    ORDER BY category, slug
  `)
}

export async function getSkillBySlug(db: TenantDB, slug: string): Promise<SkillDetail | null> {
  return db.queryOne<SkillDetail>(
    `SELECT slug, name, description, category, path, content, updated_at
     FROM ct_skills WHERE slug = $1`,
    [slug]
  )
}
