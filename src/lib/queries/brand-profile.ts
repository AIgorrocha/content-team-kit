import type { TenantDB } from "@/lib/tenant-db"
import type { BrandProfile, OnboardingStep } from "@/lib/types"

export async function getBrandProfile(db: TenantDB): Promise<BrandProfile | null> {
  return db.queryOne<BrandProfile>(
    "SELECT * FROM ct_brand_profile ORDER BY created_at DESC LIMIT 1"
  )
}

export async function createBrandProfile(db: TenantDB): Promise<BrandProfile> {
  const rows = await db.query<BrandProfile>(
    "INSERT INTO ct_brand_profile DEFAULT VALUES RETURNING *"
  )
  return rows[0]
}

export async function getOrCreateBrandProfile(db: TenantDB): Promise<BrandProfile> {
  const existing = await getBrandProfile(db)
  if (existing) return existing
  return createBrandProfile(db)
}

export async function updateBrandProfile(
  db: TenantDB,
  id: string,
  fields: Partial<Pick<BrandProfile,
    | "brand_voice"
    | "visual_identity"
    | "content_strategy"
    | "audience"
    | "social_links"
    | "site_url"
    | "site_analysis"
    | "video_urls"
    | "video_transcripts"
    | "raw_social_data"
    | "questionnaire"
    | "onboarding_step"
    | "onboarding_completed"
  >>
): Promise<BrandProfile | null> {
  const setClauses: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${paramIndex}`)
    values.push(value)
    paramIndex++
  }

  if (setClauses.length === 0) return getBrandProfile(db)

  setClauses.push(`updated_at = NOW()`)
  values.push(id)

  return db.queryOne<BrandProfile>(
    `UPDATE ct_brand_profile
     SET ${setClauses.join(", ")}
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  )
}

export async function updateOnboardingStep(
  db: TenantDB,
  id: string,
  step: OnboardingStep
): Promise<BrandProfile | null> {
  return updateBrandProfile(db, id, {
    onboarding_step: step,
    onboarding_completed: step === "completed",
  })
}

export async function updateSocialLinks(
  db: TenantDB,
  id: string,
  socialLinks: Record<string, string>,
  siteUrl: string | null
): Promise<BrandProfile | null> {
  return updateBrandProfile(db, id, {
    social_links: socialLinks,
    site_url: siteUrl,
    onboarding_step: "upload_videos",
  })
}

export async function updateVideoUrls(
  db: TenantDB,
  id: string,
  videoUrls: string[]
): Promise<BrandProfile | null> {
  return updateBrandProfile(db, id, {
    video_urls: videoUrls,
    onboarding_step: "analyzing",
  })
}

export async function saveAnalysisResults(
  db: TenantDB,
  id: string,
  results: {
    brand_voice: BrandProfile["brand_voice"]
    visual_identity: BrandProfile["visual_identity"]
    content_strategy: BrandProfile["content_strategy"]
    audience: BrandProfile["audience"]
    raw_social_data: Record<string, unknown>
    site_analysis: Record<string, unknown>
    video_transcripts: string[]
  }
): Promise<BrandProfile | null> {
  return updateBrandProfile(db, id, {
    ...results,
    onboarding_step: "review",
  })
}

export async function saveQuestionnaire(
  db: TenantDB,
  id: string,
  questionnaire: Record<string, unknown>
): Promise<BrandProfile | null> {
  return updateBrandProfile(db, id, {
    questionnaire,
    onboarding_step: "completed",
    onboarding_completed: true,
  })
}

export async function deleteBrandProfile(db: TenantDB, id: string): Promise<void> {
  await db.query("DELETE FROM ct_brand_profile WHERE id = $1", [id])
}
