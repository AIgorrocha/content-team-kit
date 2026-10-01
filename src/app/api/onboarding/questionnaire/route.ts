import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getOrCreateBrandProfile, saveQuestionnaire } from "@/lib/queries/brand-profile"
import { z } from "zod"

const BodySchema = z.object({
  answers: z.record(z.unknown()),
})

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const { answers } = BodySchema.parse(body)

    const profile = await getOrCreateBrandProfile(db)
    const updated = await saveQuestionnaire(db, profile.id, answers)

    return updated
  })
}
