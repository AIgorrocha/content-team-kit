import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getBrandProfile, updateBrandProfile, getOrCreateBrandProfile } from "@/lib/queries/brand-profile"
import { z } from "zod"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const profile = await getBrandProfile(db)
    return profile
  })
}

const PatchSchema = z.object({
  brand_voice: z.record(z.unknown()).optional(),
  visual_identity: z.record(z.unknown()).optional(),
  content_strategy: z.record(z.unknown()).optional(),
  audience: z.record(z.unknown()).optional(),
  social_links: z.record(z.string()).optional(),
  site_url: z.string().nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const updates = PatchSchema.parse(body)

    const profile = await getOrCreateBrandProfile(db)
    const updated = await updateBrandProfile(db, profile.id, updates as Parameters<typeof updateBrandProfile>[2])

    return updated
  })
}
