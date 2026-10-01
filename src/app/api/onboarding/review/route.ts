import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getOrCreateBrandProfile, updateBrandProfile } from "@/lib/queries/brand-profile"
import { z } from "zod"

const BodySchema = z.object({
  brand_voice: z.record(z.unknown()).optional(),
  visual_identity: z.record(z.unknown()).optional(),
  content_strategy: z.record(z.unknown()).optional(),
  audience: z.record(z.unknown()).optional(),
  approved: z.boolean(),
})

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const { brand_voice, visual_identity, content_strategy, audience, approved } = BodySchema.parse(body)

    const profile = await getOrCreateBrandProfile(db)

    const updates: Record<string, unknown> = {}
    if (brand_voice) updates.brand_voice = brand_voice
    if (visual_identity) updates.visual_identity = visual_identity
    if (content_strategy) updates.content_strategy = content_strategy
    if (audience) updates.audience = audience

    if (approved) {
      updates.onboarding_step = "questionnaire"
    }

    const updated = await updateBrandProfile(db, profile.id, updates as Parameters<typeof updateBrandProfile>[2])

    return updated
  })
}
